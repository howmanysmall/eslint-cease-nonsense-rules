import { TSESTree } from "@typescript-eslint/types";
import type { Rule } from "eslint";

const DEFAULT_HOOKS = ["useEffect", "useLayoutEffect", "useInsertionEffect"] as const;

type EnvironmentMode = "roblox-ts" | "standard";

interface RuleOptions {
	readonly environment: EnvironmentMode;
	readonly hooks: ReadonlyArray<string>;
}

function parseOptions(optionsInput: unknown): RuleOptions {
	if (optionsInput === undefined) {
		return {
			environment: "roblox-ts",
			hooks: DEFAULT_HOOKS,
		};
	}

	if (typeof optionsInput !== "object" || optionsInput === null) {
		return {
			environment: "roblox-ts",
			hooks: DEFAULT_HOOKS,
		};
	}

	const opts = optionsInput as Record<PropertyKey, unknown>;

	const envValue = opts.environment;
	const environment: EnvironmentMode = envValue === "standard" ? "standard" : "roblox-ts";

	const hooksValue = opts.hooks;
	const hooks: ReadonlyArray<string> =
		Array.isArray(hooksValue) && hooksValue.every((h) => typeof h === "string") ? hooksValue : DEFAULT_HOOKS;

	return { environment, hooks };
}

function getHookName(callExpr: {
	callee: { type: string; name?: string; property?: { type: string; name?: string } };
}): string | undefined {
	const { callee } = callExpr;

	if (callee.type === TSESTree.AST_NODE_TYPES.Identifier && callee.name) return callee.name;

	if (
		callee.type === TSESTree.AST_NODE_TYPES.MemberExpression &&
		callee.property?.type === TSESTree.AST_NODE_TYPES.Identifier &&
		callee.property.name
	)
		return callee.property.name;

	return undefined;
}

const requireNamedEffectFunctions: Rule.RuleModule = {
	create(context) {
		const options = parseOptions(context.options[0]);
		const effectHooks = new Set(options.hooks);
		const isRobloxTsMode = options.environment === "roblox-ts";

		return {
			CallExpression(node: Rule.Node) {
				const callExpr = node as unknown as { callee: unknown; arguments: unknown[] };

				const hookName = getHookName(callExpr as Parameters<typeof getHookName>[0]);
				if (!hookName || !effectHooks.has(hookName)) return;

				const firstArg = callExpr.arguments?.[0];
				if (!firstArg) return;

				const argNode = firstArg as { type: string; id?: unknown };

				if (argNode.type === TSESTree.AST_NODE_TYPES.Identifier) return;

				if (argNode.type === TSESTree.AST_NODE_TYPES.ArrowFunctionExpression) {
					context.report({
						data: { hook: hookName },
						messageId: "arrowFunction",
						node,
					});
					return;
				}

				if (argNode.type === TSESTree.AST_NODE_TYPES.FunctionExpression) {
					if (argNode.id) {
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
						items: {
							type: "string",
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
