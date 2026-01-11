import { TSESTree } from "@typescript-eslint/types";
import type { Rule } from "eslint";
import Typebox from "typebox";
import { Compile } from "typebox/compile";
import type { EnvironmentMode } from "../types/environment-mode";
import { isEnvironmentMode } from "../types/environment-mode";

export interface HookConfiguration {
	readonly allowAsync: boolean;
	readonly name: string;
}

const DEFAULT_HOOKS: ReadonlyArray<HookConfiguration> = [
	{ allowAsync: false, name: "useEffect" },
	{ allowAsync: false, name: "useLayoutEffect" },
	{ allowAsync: false, name: "useInsertionEffect" },
] as const;

export interface EffectFunctionOptions {
	readonly environment: EnvironmentMode;
	readonly hooks: ReadonlyArray<HookConfiguration>;
}
const isHookConfiguration = Typebox.Object({
	allowAsync: Typebox.Boolean(),
	name: Typebox.String(),
});

const isRuleOptions = Compile(
	Typebox.Object(
		{
			environment: isEnvironmentMode,
			hooks: Typebox.Array(isHookConfiguration),
		},
		{ additionalProperties: true },
	),
);

function parseOptions(options: unknown): EffectFunctionOptions {
	if (options === undefined) {
		return {
			environment: "roblox-ts",
			hooks: DEFAULT_HOOKS,
		};
	}

	if (!isRuleOptions.Check(options)) {
		return {
			environment: "roblox-ts",
			hooks: DEFAULT_HOOKS,
		};
	}

	return {
		environment: options.environment === "standard" ? "standard" : "roblox-ts",
		hooks: options.hooks,
	};
}

interface Callee {
	readonly name?: string;
	readonly property?: { readonly name?: string; readonly type: string };
	readonly type: string;
}
interface CallExpression {
	readonly callee: Callee;
}

function getHookName(callExpression: CallExpression): string | undefined {
	const { callee } = callExpression;
	if (
		callee.type === TSESTree.AST_NODE_TYPES.Identifier &&
		typeof callee.name === "string" &&
		callee.name.length > 0
	) {
		return callee.name;
	}

	if (
		callee.type === TSESTree.AST_NODE_TYPES.MemberExpression &&
		callee.property?.type === TSESTree.AST_NODE_TYPES.Identifier &&
		typeof callee.property.name === "string" &&
		callee.property.name.length > 0
	) {
		return callee.property.name;
	}

	return undefined;
}

interface ResolvedFunction {
	readonly node: TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression | TSESTree.FunctionDeclaration;
	readonly type: "arrow" | "function-expression" | "function-declaration";
	readonly isAsync: boolean;
}

function findVariableInScope(identifier: TSESTree.Identifier, scope: unknown): unknown {
	let variable: unknown;
	let currentScope: unknown = scope;

	while (typeof currentScope === "object" && currentScope !== null) {
		const current = currentScope as { set: Map<string, unknown>; upper?: unknown };
		variable = current.set.get(identifier.name);
		if (typeof variable === "object" && variable !== null) break;
		currentScope = current.upper;
	}

	return variable;
}

function processFunctionDeclaration(node: unknown): ResolvedFunction {
	const castNode = node as { async?: boolean };
	return {
		isAsync: Boolean(castNode.async),
		node: node as TSESTree.FunctionDeclaration,
		type: "function-declaration",
	};
}

function processArrowFunction(init: unknown): ResolvedFunction {
	const arrowNode = init as TSESTree.ArrowFunctionExpression;
	return {
		isAsync: Boolean((init as { async?: boolean }).async),
		node: arrowNode,
		type: "arrow",
	};
}

function processFunctionExpression(init: unknown): ResolvedFunction {
	const exprNode = init as TSESTree.FunctionExpression;
	return {
		isAsync: Boolean((init as { async?: boolean }).async),
		node: exprNode,
		type: "function-expression",
	};
}

function checkVariableDeclaratorDef(node: unknown): ResolvedFunction | undefined {
	const castNode = node as { type?: string; init?: unknown };
	if (castNode.type !== TSESTree.AST_NODE_TYPES.VariableDeclarator) return undefined;
	if (typeof castNode.init !== "object" || castNode.init === null) return undefined;

	const castInit = castNode.init as { type?: string };
	if (castInit.type === TSESTree.AST_NODE_TYPES.ArrowFunctionExpression) return processArrowFunction(castNode.init);
	if (castInit.type === TSESTree.AST_NODE_TYPES.FunctionExpression) return processFunctionExpression(castNode.init);
	return undefined;
}

function processSingleDefinition(definition: unknown): ResolvedFunction | undefined {
	if (typeof definition !== "object" || definition === null) return undefined;

	const castDef = definition as { node?: unknown };
	const { node } = castDef;
	if (typeof node !== "object" || node === null) return undefined;

	const castNode = node as { type?: string };
	if (castNode.type === TSESTree.AST_NODE_TYPES.FunctionDeclaration) return processFunctionDeclaration(node);

	return checkVariableDeclaratorDef(node);
}

function resolveIdentifierToFunction(
	identifier: TSESTree.Identifier,
	context: Rule.RuleContext,
): ResolvedFunction | undefined {
	try {
		const scope = context.sourceCode.getScope?.(identifier) as unknown;
		if (typeof scope !== "object" || scope === null) return undefined;

		const scopeObj = scope as { set: Map<string, unknown>; upper?: unknown };
		const setVal = scopeObj.set;
		if (!(setVal instanceof Map)) return undefined;

		const variable = findVariableInScope(identifier, scope);
		if (typeof variable !== "object" || variable === null) return undefined;

		const castVariable = variable as { defs: Array<unknown> };
		if (!Array.isArray(castVariable.defs) || castVariable.defs.length === 0) return undefined;

		for (const definition of castVariable.defs) {
			const result = processSingleDefinition(definition);
			if (result !== undefined) return result;
		}

		return undefined;
	} catch {
		return undefined;
	}
}

function isCallbackHookResult(identifier: TSESTree.Identifier, context: Rule.RuleContext): boolean {
	try {
		const scope = context.sourceCode.getScope?.(identifier) as unknown;
		if (typeof scope !== "object" || scope === null) return false;

		const scopeObj = scope as { set: Map<string, unknown>; upper?: unknown };
		const setVal = scopeObj.set;
		if (!(setVal instanceof Map)) return false;

		let variable: unknown;
		let currentScope: unknown = scope;

		while (typeof currentScope === "object" && currentScope !== null) {
			const current = currentScope as { set: Map<string, unknown>; upper?: unknown };
			variable = current.set.get(identifier.name);
			if (typeof variable === "object" && variable !== null) break;
			currentScope = current.upper;
		}

		if (typeof variable !== "object" || variable === null) return false;

		const castVariable = variable as { defs: Array<unknown> };
		if (!Array.isArray(castVariable.defs) || castVariable.defs.length === 0) return false;

		for (const definition of castVariable.defs) {
			if (typeof definition !== "object" || definition === null) continue;

			const castDefinition = definition as { node?: unknown };
			const { node } = castDefinition;
			if (typeof node !== "object" || node === null) continue;

			const castNode = node as { type?: string; init?: unknown };
			if (castNode.type !== TSESTree.AST_NODE_TYPES.VariableDeclarator) continue;
			if (typeof castNode.init !== "object" || castNode.init === null) continue;

			const init = castNode.init as { type?: string; callee?: unknown };
			if (init.type !== TSESTree.AST_NODE_TYPES.CallExpression) continue;

			const calleeHookName = getHookName(init as Parameters<typeof getHookName>[0]);
			if (calleeHookName === "useCallback" || calleeHookName === "useMemo") return true;
		}

		return false;
	} catch {
		return false;
	}
}

const requireNamedEffectFunctions: Rule.RuleModule = {
	create(context) {
		const { hooks, environment } = parseOptions(context.options[0]);
		const hookAsyncConfig = new Map(hooks.map((hookConfig) => [hookConfig.name, hookConfig.allowAsync]));
		const effectHooks = new Set(hookAsyncConfig.keys());
		const isRobloxTsMode = environment === "roblox-ts";

		function isAsyncAllowed(hookName: string): boolean {
			const result = hookAsyncConfig.get(hookName);
			return typeof result === "boolean" ? result : false;
		}

		return {
			CallExpression(node: Rule.Node) {
				const callExpression = node as unknown as { arguments: ReadonlyArray<unknown>; callee: unknown };

				const hookName = getHookName(callExpression as Parameters<typeof getHookName>[0]);
				if (typeof hookName !== "string" || !effectHooks.has(hookName)) return;

				const firstArgument = callExpression.arguments?.[0];
				if (firstArgument === undefined) return;

				const argumentNode = firstArgument as { id?: unknown; type: string; async?: boolean };
				if (argumentNode.type === TSESTree.AST_NODE_TYPES.Identifier) {
					const identifier = argumentNode as unknown as TSESTree.Identifier;
					const resolved = resolveIdentifierToFunction(identifier, context);

					if (resolved === undefined) {
						if (isCallbackHookResult(identifier, context)) {
							context.report({
								data: { hook: hookName },
								messageId: "identifierReferencesCallback",
								node,
							});
						}
						return;
					}

					if (resolved.type === "arrow") {
						if (resolved.isAsync) {
							if (!isAsyncAllowed(hookName)) {
								context.report({
									data: { hook: hookName },
									messageId: "identifierReferencesAsyncArrow",
									node,
								});
							}
						} else {
							context.report({
								data: { hook: hookName },
								messageId: "identifierReferencesArrow",
								node,
							});
						}
					} else if (resolved.type === "function-expression") {
						const castNode = resolved.node as unknown as { id?: unknown };
						if (castNode.id === undefined) {
							context.report({
								data: { hook: hookName },
								messageId: "anonymousFunction",
								node,
							});
						} else if (isRobloxTsMode) {
							context.report({
								data: { hook: hookName },
								messageId: "functionExpression",
								node,
							});
						}
					} else if (
						resolved.type === "function-declaration" &&
						resolved.isAsync &&
						!isAsyncAllowed(hookName)
					) {
						context.report({
							data: { hook: hookName },
							messageId: "identifierReferencesAsyncFunction",
							node,
						});
					}
					return;
				}

				if (argumentNode.type === TSESTree.AST_NODE_TYPES.ArrowFunctionExpression) {
					if (argumentNode.async) {
						context.report({
							data: { hook: hookName },
							messageId: "asyncArrowFunction",
							node,
						});
					} else {
						context.report({
							data: { hook: hookName },
							messageId: "arrowFunction",
							node,
						});
					}
					return;
				}

				if (argumentNode.type === TSESTree.AST_NODE_TYPES.FunctionExpression) {
					const functionHasId = Boolean(argumentNode.id);

					if (functionHasId && argumentNode.async) {
						context.report({
							data: { hook: hookName },
							messageId: "asyncFunctionExpression",
							node,
						});
					} else if (functionHasId && isRobloxTsMode) {
						context.report({
							data: { hook: hookName },
							messageId: "functionExpression",
							node,
						});
					} else if (!functionHasId && argumentNode.async) {
						context.report({
							data: { hook: hookName },
							messageId: "asyncAnonymousFunction",
							node,
						});
					} else if (!functionHasId) {
						context.report({
							data: { hook: hookName },
							messageId: "anonymousFunction",
							node,
						});
					}
				}
			},
		};
	},
	meta: {
		docs: {
			description:
				"Enforce named effect functions for better debuggability. Prevents inline arrow functions in useEffect and similar hooks.",
			recommended: false,
		},
		messages: {
			anonymousFunction:
				"Anonymous function passed to {{hook}}. debug.info returns empty string for anonymous functions, making stack traces useless for debugging. Extract to: function effectName() { ... } then pass effectName.",
			arrowFunction:
				"Arrow function passed to {{hook}}. Arrow functions have no debug name and create new instances each render. Extract to: function effectName() { ... } then pass effectName.",
			asyncAnonymousFunction:
				"Async anonymous function in {{hook}}. Two issues: (1) no debug name makes stack traces useless, (2) async effects require cancellation logic for unmount. Extract to: async function effectName() { ... } with cleanup.",
			asyncArrowFunction:
				"Async arrow function in {{hook}}. Two issues: (1) arrow functions have no debug name, (2) async effects require cancellation logic. Extract to: async function effectName() { ... } with cleanup.",
			asyncFunctionDeclaration:
				"Async function declaration passed to {{hook}}. Async effects require cancellation logic to handle component unmount. Implement cleanup or set allowAsync: true if cancellation is handled.",
			asyncFunctionExpression:
				"Async function expression in {{hook}}. Async effects require cancellation logic for unmount. Extract to a named async function declaration with cleanup, then pass the reference.",
			functionExpression:
				"Function expression passed to {{hook}}. Function expressions create new instances each render, breaking referential equality. Extract to: function effectName() { ... } at module or component top-level.",
			identifierReferencesArrow:
				"{{hook}} receives identifier pointing to arrow function. Arrow functions have no debug name and lack referential stability. Convert to: function effectName() { ... } then pass effectName.",
			identifierReferencesAsyncArrow:
				"{{hook}} receives identifier pointing to async arrow function. Two issues: (1) no debug name, (2) async effects require cancellation logic. Convert to: async function effectName() { ... } with cleanup.",
			identifierReferencesAsyncFunction:
				"{{hook}} receives identifier pointing to async function. Async effects require cancellation logic for unmount. Implement cleanup or set allowAsync: true if cancellation is handled.",
			identifierReferencesCallback:
				"{{hook}} receives identifier from useCallback/useMemo. These hooks return new references when dependencies change, causing unexpected effect re-runs. Use a stable function declaration: function effectName() { ... }",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					environment: {
						default: "roblox-ts",
						description:
							"Environment mode: 'roblox-ts' only allows identifiers, 'standard' allows both identifiers and named function expressions",
						enum: ["roblox-ts", "standard"],
						type: "string",
					},
					hooks: {
						default: DEFAULT_HOOKS,
						description: "Array of hook configuration objects with name and allowAsync settings",
						items: {
							additionalProperties: false,
							properties: {
								allowAsync: {
									description: "Whether async functions are allowed for this hook",
									type: "boolean",
								},
								name: {
									description: "Hook name to check",
									type: "string",
								},
							},
							required: ["name", "allowAsync"],
							type: "object",
						},
						type: "array",
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
};

export default requireNamedEffectFunctions;
