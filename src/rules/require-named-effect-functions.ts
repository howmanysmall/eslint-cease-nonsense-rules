import { TSESTree } from "@typescript-eslint/types";
import type { Rule } from "eslint";
import Type from "typebox";
import { Compile } from "typebox/compile";

export interface HookConfiguration {
	readonly allowAsync: boolean;
	readonly name: string;
}

const DEFAULT_HOOKS: ReadonlyArray<HookConfiguration> = [
	{ allowAsync: false, name: "useEffect" },
	{ allowAsync: false, name: "useLayoutEffect" },
	{ allowAsync: false, name: "useInsertionEffect" },
] as const;

const isEnvironmentMode = Type.Union([Type.Literal("roblox-ts"), Type.Literal("standard")]);
export type EnvironmentMode = Type.Static<typeof isEnvironmentMode>;

export interface EffectFunctionOptions {
	readonly environment: EnvironmentMode;
	readonly hooks: ReadonlyArray<HookConfiguration>;
}
const isHookConfiguration = Type.Object({
	allowAsync: Type.Boolean(),
	name: Type.String(),
});

const isRuleOptions = Compile(
	Type.Object(
		{
			environment: isEnvironmentMode,
			hooks: Type.Array(isHookConfiguration),
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
	if (callee.type === TSESTree.AST_NODE_TYPES.Identifier && typeof callee.name === "string" && callee.name.length > 0)
		return callee.name;

	if (
		callee.type === TSESTree.AST_NODE_TYPES.MemberExpression &&
		callee.property?.type === TSESTree.AST_NODE_TYPES.Identifier &&
		typeof callee.property.name === "string" &&
		callee.property.name.length > 0
	)
		return callee.property.name;

	return undefined;
}

interface ResolvedFunction {
	readonly node: TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression | TSESTree.FunctionDeclaration;
	readonly type: "arrow" | "function-expression" | "function-declaration";
	readonly isAsync: boolean;
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

		let variable: unknown;
		let currentScope: unknown = scope;

		while (typeof currentScope === "object" && currentScope !== null) {
			const current = currentScope as { set: Map<string, unknown>; upper?: unknown };
			variable = current.set.get(identifier.name);
			if (typeof variable === "object" && variable !== null) break;
			currentScope = current.upper;
		}

		if (typeof variable !== "object" || variable === null) return undefined;

		const castVariable = variable as { defs: Array<unknown> };
		if (!Array.isArray(castVariable.defs) || castVariable.defs.length === 0) return undefined;

		for (const definition of castVariable.defs) {
			if (typeof definition !== "object" || definition === null) continue;

			const castDefinition = definition as { node?: unknown };
			const node = castDefinition.node;
			if (typeof node !== "object" || node === null) continue;

			const castNode = node as { type?: string; init?: unknown; async?: boolean };
			if (castNode.type === TSESTree.AST_NODE_TYPES.FunctionDeclaration) {
				return {
					isAsync: Boolean(castNode.async),
					node: node as unknown as TSESTree.FunctionDeclaration,
					type: "function-declaration",
				};
			}

			if (
				castNode.type === TSESTree.AST_NODE_TYPES.VariableDeclarator &&
				typeof castNode.init === "object" &&
				castNode.init !== null
			) {
				const castInit = castNode.init as { type?: string; async?: boolean };
				if (castInit.type === TSESTree.AST_NODE_TYPES.ArrowFunctionExpression) {
					const arrowNode = castNode.init as unknown as TSESTree.ArrowFunctionExpression;
					return {
						isAsync: Boolean(arrowNode.async),
						node: arrowNode,
						type: "arrow",
					};
				}

				if (castInit.type === TSESTree.AST_NODE_TYPES.FunctionExpression) {
					const castInitNode = castNode.init as unknown as TSESTree.FunctionExpression;
					return {
						isAsync: Boolean(castInitNode.async),
						node: castInitNode,
						type: "function-expression",
					};
				}
			}
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
			const node = castDefinition.node;
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
					const functionExpressionNode = argumentNode as unknown as { id?: unknown; async?: boolean };
					// oxlint-disable-next-line typescript-eslint/strict-boolean-expressions
					const functionHasId = Boolean(functionExpressionNode.id);

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
					return;
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
			anonymousFunction: "Use a named function instead of an anonymous function for better debuggability",
			arrowFunction: "Use a named function instead of an arrow function for better debuggability",
			asyncAnonymousFunction:
				"Async anonymous functions are not allowed in {{ hook }}. Use an async function declaration instead",
			asyncArrowFunction:
				"Async arrow functions are not allowed in {{ hook }}. Use an async function declaration instead",
			asyncFunctionDeclaration:
				"Async function declarations are not allowed in {{ hook }}. Set allowAsync: true for this hook to enable",
			asyncFunctionExpression:
				"Async function expressions are not allowed in {{ hook }}. Use an async function declaration instead",
			functionExpression:
				"Use a named function reference instead of a function expression for better debuggability",
			identifierReferencesArrow:
				"{{ hook }} called with identifier that references an arrow function. Use a named function declaration instead",
			identifierReferencesAsyncArrow:
				"{{ hook }} called with identifier that references an async arrow function. Set allowAsync: true for this hook to enable",
			identifierReferencesAsyncFunction:
				"{{ hook }} called with identifier that references an async function. Set allowAsync: true for this hook to enable",
			identifierReferencesCallback:
				"{{ hook }} called with identifier that references a useCallback/useMemo result. Use a named function declaration instead",
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
