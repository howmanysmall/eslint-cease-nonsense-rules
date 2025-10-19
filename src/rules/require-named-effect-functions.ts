import { TSESTree } from "@typescript-eslint/types";
import type { Rule } from "eslint";

/**
 * Default effect hooks to check.
 */
const DEFAULT_HOOKS = ["useEffect", "useLayoutEffect", "useInsertionEffect"];

/**
 * Gets the hook name from a call expression.
 *
 * @param node - The call expression node.
 * @returns The hook name or undefined.
 */
function getHookName(node: TSESTree.CallExpression): string | undefined {
	const { callee } = node;

	// Direct call: useEffect(...)
	if (callee.type === TSESTree.AST_NODE_TYPES.Identifier) {
		return callee.name;
	}

	// Member expression: React.useEffect(...)
	if (
		callee.type === TSESTree.AST_NODE_TYPES.MemberExpression &&
		callee.property.type === TSESTree.AST_NODE_TYPES.Identifier
	) {
		return callee.property.name;
	}

	return undefined;
}

const requireNamedEffectFunctions: Rule.RuleModule = {
	/**
	 * Creates the ESLint rule visitor.
	 *
	 * @param context - The ESLint rule context.
	 * @returns The visitor object with AST node handlers.
	 */
	create(context) {
		// Get options with defaults
		// @ts-expect-error context.options is any[] and accessing dynamic property
		const environment: unknown = (context.options[0] as unknown)?.environment ?? "roblox-ts";
		// @ts-expect-error context.options is any[] and accessing dynamic property
		const hooks: unknown = (context.options[0] as unknown)?.hooks ?? DEFAULT_HOOKS;

		// Validate environment
		if (environment !== "roblox-ts" && environment !== "standard") {
			return {};
		}

		// Validate hooks is an array
		if (!Array.isArray(hooks) || !hooks.every((hook) => typeof hook === "string")) {
			return {};
		}

		const effectHooks = new Set(hooks as readonly string[]);
		const isRobloxTsMode = environment === "roblox-ts";

		return {
			CallExpression(node: Rule.Node) {
				const callNode = node as unknown as TSESTree.CallExpression;

				// Get the hook name
				const hookName = getHookName(callNode);
				if (!hookName || !effectHooks.has(hookName)) return;

				// Get the first argument (the effect callback)
				const firstArg = callNode.arguments[0];
				if (!firstArg) return;

				// Check the type of the first argument
				if (firstArg.type === TSESTree.AST_NODE_TYPES.Identifier) {
					// Valid: named function reference
					return;
				}

				if (firstArg.type === TSESTree.AST_NODE_TYPES.ArrowFunctionExpression) {
					// Invalid: arrow function
					context.report({
						data: { hook: hookName },
						messageId: "arrowFunction",
						node,
					});
					return;
				}

				if (firstArg.type === TSESTree.AST_NODE_TYPES.FunctionExpression) {
					// Check if it's a named function expression
					if ("id" in firstArg && firstArg.id) {
						// Named function expression
						if (isRobloxTsMode) {
							// Not allowed in roblox-ts mode
							context.report({
								data: { hook: hookName },
								messageId: "functionExpression",
								node,
							});
						}
						// Allowed in standard mode
					} else {
						// Anonymous function expression
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
			functionExpression: "Use a named function reference instead of a function expression for better debuggability",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					environment: {
						default: "roblox-ts",
						description: "Environment mode: 'roblox-ts' only allows identifiers, 'standard' allows both identifiers and named function expressions",
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
