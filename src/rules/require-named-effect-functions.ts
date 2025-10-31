import { TSESTree } from "@typescript-eslint/types";
import type { Rule } from "eslint";
import Type from "typebox";
import { Compile } from "typebox/compile";

const DEFAULT_HOOKS = ["useEffect", "useLayoutEffect", "useInsertionEffect"] as const;

type EnvironmentMode = "roblox-ts" | "standard";

interface RuleOptions {
	readonly environment: EnvironmentMode;
	readonly hooks: ReadonlyArray<string>;
}
const isRuleOptions = Compile(
	Type.Object({
		environment: Type.Union([Type.Literal("roblox-ts"), Type.Literal("standard")]),
		hooks: Type.Array(Type.String()),
	}),
);

function parseOptions(options: unknown): RuleOptions {
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

	return { environment: options.environment === "standard" ? "standard" : "roblox-ts", hooks: options.hooks };
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

			const castNode = node as { type?: string; init?: unknown };
			if (castNode.type === TSESTree.AST_NODE_TYPES.FunctionDeclaration) {
				return {
					node: node as unknown as TSESTree.FunctionDeclaration,
					type: "function-declaration",
				};
			}

			if (
				castNode.type === TSESTree.AST_NODE_TYPES.VariableDeclarator &&
				typeof castNode.init === "object" &&
				castNode.init !== null
			) {
				const castInit = castNode.init as { type?: string };
				if (castInit.type === TSESTree.AST_NODE_TYPES.ArrowFunctionExpression) {
					return {
						node: castNode.init as unknown as TSESTree.ArrowFunctionExpression,
						type: "arrow",
					};
				}

				if (castInit.type === TSESTree.AST_NODE_TYPES.FunctionExpression) {
					return {
						node: castNode.init as unknown as TSESTree.FunctionExpression,
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
		const { hooks, environment } = parseOptions(context.options[0]);
		const effectHooks = new Set(hooks);
		const isRobloxTsMode = environment === "roblox-ts";

		return {
			CallExpression(node: Rule.Node) {
				const callExpression = node as unknown as { arguments: ReadonlyArray<unknown>; callee: unknown };

				const hookName = getHookName(callExpression as Parameters<typeof getHookName>[0]);
				if (typeof hookName !== "string" || !effectHooks.has(hookName)) return;

				const firstArgument = callExpression.arguments?.[0];
				if (firstArgument === undefined) return;

				const argumentNode = firstArgument as { id?: unknown; type: string };
				if (argumentNode.type === TSESTree.AST_NODE_TYPES.Identifier) {
					const identifier = argumentNode as unknown as TSESTree.Identifier;
					const resolved = resolveIdentifierToFunction(identifier, context);

					if (resolved === undefined) return;

					if (resolved.type === "arrow") {
						context.report({
							data: { hook: hookName },
							messageId: "identifierReferencesArrow",
							node,
						});
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
					}
					return;
				}

				if (argumentNode.type === TSESTree.AST_NODE_TYPES.ArrowFunctionExpression) {
					context.report({
						data: { hook: hookName },
						messageId: "arrowFunction",
						node,
					});
					return;
				}

				if (argumentNode.type === TSESTree.AST_NODE_TYPES.FunctionExpression) {
					const functionExpressionNode = argumentNode as unknown as { id?: unknown };
					// oxlint-disable-next-line typescript-eslint/strict-boolean-expressions
					const functionHasId = Boolean(functionExpressionNode.id);

					if (functionHasId) {
						if (isRobloxTsMode) {
							context.report({
								data: { hook: hookName },
								messageId: "functionExpression",
								node,
							});
						}
					} else {
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
			functionExpression:
				"Use a named function reference instead of a function expression for better debuggability",
			identifierReferencesArrow:
				"{{ hook }} called with identifier that references an arrow function. Use a named function declaration instead",
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
