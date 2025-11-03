import { TSESTree } from "@typescript-eslint/types";
import type { Rule } from "eslint";
import Type from "typebox";
import { Compile } from "typebox/compile";

const DEFAULT_HOOKS = ["useEffect", "useLayoutEffect", "useInsertionEffect"] as const;

type EnvironmentMode = "roblox-ts" | "standard";

interface RuleOptions {
	readonly environment: EnvironmentMode;
	readonly hooks: ReadonlyArray<string>;
	readonly allowAsyncFunctionDeclarations: boolean;
}
const isRuleOptions = Compile(
	Type.Object(
		{
			allowAsyncFunctionDeclarations: Type.Boolean(),
			environment: Type.Union([Type.Literal("roblox-ts"), Type.Literal("standard")]),
			hooks: Type.Array(Type.String()),
		},
		{ additionalProperties: true },
	),
);

function parseOptions(options: unknown): RuleOptions {
	if (options === undefined) {
		return {
			allowAsyncFunctionDeclarations: false,
			environment: "roblox-ts",
			hooks: DEFAULT_HOOKS,
		};
	}

	if (!isRuleOptions.Check(options)) {
		return {
			allowAsyncFunctionDeclarations: false,
			environment: "roblox-ts",
			hooks: DEFAULT_HOOKS,
		};
	}

	return {
		allowAsyncFunctionDeclarations: options.allowAsyncFunctionDeclarations,
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
				const funcNode = node as unknown as TSESTree.FunctionDeclaration;
				return {
					isAsync: Boolean(funcNode.async),
					node: funcNode,
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
					const funcExprNode = castNode.init as unknown as TSESTree.FunctionExpression;
					return {
						isAsync: Boolean(funcExprNode.async),
						node: funcExprNode,
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

const requireNamedEffectFunctions: Rule.RuleModule = {
	create(context) {
		const { hooks, environment, allowAsyncFunctionDeclarations } = parseOptions(context.options[0]);
		const effectHooks = new Set(hooks);
		const isRobloxTsMode = environment === "roblox-ts";

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

					if (resolved === undefined) return;

					if (resolved.type === "arrow") {
						if (resolved.isAsync) {
							if (!allowAsyncFunctionDeclarations) {
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
						const funcExpr = resolved.node as unknown as { id?: unknown };
						if (funcExpr.id === undefined) {
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
						!allowAsyncFunctionDeclarations
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
				"Async function declarations are not allowed in {{ hook }} unless allowAsyncFunctionDeclarations is enabled",
			asyncFunctionExpression:
				"Async function expressions are not allowed in {{ hook }}. Use an async function declaration instead",
			functionExpression:
				"Use a named function reference instead of a function expression for better debuggability",
			identifierReferencesArrow:
				"{{ hook }} called with identifier that references an arrow function. Use a named function declaration instead",
			identifierReferencesAsyncArrow:
				"{{ hook }} called with identifier that references an async arrow function. Async functions are not allowed unless allowAsyncFunctionDeclarations is enabled",
			identifierReferencesAsyncFunction:
				"{{ hook }} called with identifier that references an async function. Async functions are not allowed unless allowAsyncFunctionDeclarations is enabled",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					allowAsyncFunctionDeclarations: {
						default: false,
						description:
							"If true, allows async function declarations and identifiers that reference async functions. Other async function types remain disallowed.",
						type: "boolean",
					},
					environment: {
						default: "roblox-ts",
						description:
							"Environment mode: 'roblox-ts' only allows identifiers, 'standard' allows both identifiers and named function expressions",
						enum: ["roblox-ts", "standard"],
						type: "string",
					},
					hooks: {
						default: DEFAULT_HOOKS,
						description: "Array of hook names to check",
						items: { type: "string" },
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
