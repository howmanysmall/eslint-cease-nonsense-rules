import { createRule } from "$utilities/create-rule";
import { DefinitionType } from "@typescript-eslint/scope-manager";
import { TSESTree } from "@typescript-eslint/types";

import type { EnvironmentMode } from "$types/environment-mode";
import type { TSESLint } from "@typescript-eslint/utils";

export interface HookConfiguration {
	readonly allowAsync: boolean;
	readonly name: string;
}

export interface EffectFunctionOptions {
	readonly environment?: EnvironmentMode;
	readonly hooks?: ReadonlyArray<HookConfiguration>;
}

type MessageIds =
	| "anonymousFunction"
	| "arrowFunction"
	| "asyncAnonymousFunction"
	| "asyncArrowFunction"
	| "asyncFunctionDeclaration"
	| "asyncFunctionExpression"
	| "functionExpression"
	| "identifierReferencesArrow"
	| "identifierReferencesAsyncArrow"
	| "identifierReferencesAsyncFunction"
	| "identifierReferencesCallback";

type Options = [EffectFunctionOptions?];

type NormalizedOptions = Required<EffectFunctionOptions>;

type ResolvedFunction =
	| {
			readonly isAsync: boolean;
			readonly node: TSESTree.ArrowFunctionExpression;
			readonly type: "arrow";
	  }
	| {
			readonly isAsync: boolean;
			readonly node: TSESTree.FunctionDeclaration;
			readonly type: "function-declaration";
	  }
	| {
			readonly isAsync: boolean;
			readonly node: TSESTree.FunctionExpression;
			readonly type: "function-expression";
	  };

const DEFAULT_HOOKS: ReadonlyArray<HookConfiguration> = [
	{ allowAsync: false, name: "useEffect" },
	{ allowAsync: false, name: "useLayoutEffect" },
	{ allowAsync: false, name: "useInsertionEffect" },
];

const DEFAULT_OPTIONS: NormalizedOptions = {
	environment: "roblox-ts",
	hooks: DEFAULT_HOOKS,
};

function normalizeOptions(options?: EffectFunctionOptions): NormalizedOptions {
	const hooks = options?.hooks;

	return {
		environment: options?.environment ?? DEFAULT_OPTIONS.environment,
		hooks: hooks !== undefined && hooks.length > 0 ? hooks : DEFAULT_OPTIONS.hooks,
	};
}

function getHookName({ callee }: TSESTree.CallExpression): string | undefined {
	if (callee.type === TSESTree.AST_NODE_TYPES.Identifier) return callee.name;
	if (
		callee.type === TSESTree.AST_NODE_TYPES.MemberExpression &&
		callee.property.type === TSESTree.AST_NODE_TYPES.Identifier
	) {
		return callee.property.name;
	}
	return undefined;
}

function getVariableByName(scope: TSESLint.Scope.Scope | null, name: string): TSESLint.Scope.Variable | undefined {
	let currentScope = scope;

	while (currentScope !== null) {
		const variable = currentScope.set.get(name);
		if (variable !== undefined) return variable;
		currentScope = currentScope.upper;
	}

	return undefined;
}

function resolveFunctionFromVariable(variable: TSESLint.Scope.Variable): ResolvedFunction | undefined {
	for (const definition of variable.defs) {
		if (definition.type === DefinitionType.FunctionName) {
			const { node } = definition;
			if (node.type !== TSESTree.AST_NODE_TYPES.FunctionDeclaration) continue;

			return {
				isAsync: node.async,
				node,
				type: "function-declaration",
			};
		}

		if (definition.type !== DefinitionType.Variable) continue;

		const { init } = definition.node;
		if (init === null) continue;

		if (init.type === TSESTree.AST_NODE_TYPES.ArrowFunctionExpression) {
			return {
				isAsync: init.async,
				node: init,
				type: "arrow",
			};
		}

		if (init.type === TSESTree.AST_NODE_TYPES.FunctionExpression) {
			return {
				isAsync: init.async,
				node: init,
				type: "function-expression",
			};
		}
	}

	return undefined;
}

function isCallbackHookResult(sourceCode: TSESLint.SourceCode, identifier: TSESTree.Identifier): boolean {
	const variable = getVariableByName(sourceCode.getScope(identifier), identifier.name);
	if (variable === undefined) return false;

	for (const definition of variable.defs) {
		if (definition.type !== DefinitionType.Variable) continue;

		const { init } = definition.node;
		if (init?.type !== TSESTree.AST_NODE_TYPES.CallExpression) continue;

		const calleeHookName = getHookName(init);
		if (calleeHookName === "useCallback" || calleeHookName === "useMemo") return true;
	}

	return false;
}

const requireNamedEffectFunctions = createRule<Options, MessageIds>({
	create(context) {
		const { environment, hooks } = normalizeOptions(context.options[0]);
		const hookAsyncConfig = new Map(hooks.map((hookConfig) => [hookConfig.name, hookConfig.allowAsync]));
		const effectHooks = new Set(hookAsyncConfig.keys());
		const isRobloxTsMode = environment === "roblox-ts";

		function isAsyncAllowed(hookName: string): boolean {
			return hookAsyncConfig.get(hookName) === true;
		}

		function report(node: TSESTree.CallExpression, messageId: MessageIds, hook: string): void {
			context.report({
				data: { hook },
				messageId,
				node,
			});
		}

		function checkResolvedIdentifier(
			node: TSESTree.CallExpression,
			hookName: string,
			resolved: ResolvedFunction,
		): void {
			if (resolved.type === "arrow") {
				if (resolved.isAsync) {
					if (!isAsyncAllowed(hookName)) report(node, "identifierReferencesAsyncArrow", hookName);
					return;
				}

				report(node, "identifierReferencesArrow", hookName);
				return;
			}

			if (resolved.type === "function-expression") {
				if (isRobloxTsMode) {
					report(node, "functionExpression", hookName);
					return;
				}

				if (resolved.node.id === null) {
					report(node, "anonymousFunction", hookName);
				}
				return;
			}

			if (resolved.isAsync && !isAsyncAllowed(hookName)) {
				report(node, "identifierReferencesAsyncFunction", hookName);
			}
		}

		function checkIdentifier(
			node: TSESTree.CallExpression,
			hookName: string,
			identifier: TSESTree.Identifier,
		): void {
			const variable = getVariableByName(context.sourceCode.getScope(identifier), identifier.name);
			const resolved = variable === undefined ? undefined : resolveFunctionFromVariable(variable);

			if (resolved !== undefined) {
				checkResolvedIdentifier(node, hookName, resolved);
				return;
			}

			if (isCallbackHookResult(context.sourceCode, identifier)) {
				report(node, "identifierReferencesCallback", hookName);
			}
		}

		function checkInlineFunctionExpression(
			node: TSESTree.CallExpression,
			hookName: string,
			functionExpression: TSESTree.FunctionExpression,
		): void {
			const functionHasId = functionExpression.id !== null;

			if (functionHasId && functionExpression.async) {
				report(node, "asyncFunctionExpression", hookName);
				return;
			}

			if (functionHasId && isRobloxTsMode) {
				report(node, "functionExpression", hookName);
				return;
			}

			if (functionExpression.async) {
				report(node, "asyncAnonymousFunction", hookName);
				return;
			}

			if (!functionHasId) report(node, "anonymousFunction", hookName);
		}

		return {
			CallExpression(node): void {
				const hookName = getHookName(node);
				if (hookName === undefined || !effectHooks.has(hookName)) return;

				const [firstArgument] = node.arguments;
				if (firstArgument === undefined) return;

				if (firstArgument.type === TSESTree.AST_NODE_TYPES.Identifier) {
					checkIdentifier(node, hookName, firstArgument);
					return;
				}

				if (firstArgument.type === TSESTree.AST_NODE_TYPES.ArrowFunctionExpression) {
					report(node, firstArgument.async ? "asyncArrowFunction" : "arrowFunction", hookName);
					return;
				}

				if (firstArgument.type === TSESTree.AST_NODE_TYPES.FunctionExpression) {
					checkInlineFunctionExpression(node, hookName, firstArgument);
				}
			},
		};
	},
	meta: {
		defaultOptions: [],
		docs: {
			description:
				"Enforce named effect functions for better debuggability. Prevents inline arrow functions in useEffect and similar hooks.",
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
	name: "require-named-effect-functions",
});

export default requireNamedEffectFunctions;
