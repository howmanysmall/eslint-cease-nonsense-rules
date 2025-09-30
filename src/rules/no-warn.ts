import type { Rule } from "eslint";

/**
 * Bans use of `warn()` function calls. Use `Log` instead.
 *
 * The `warn()` function is not wanted in this codebase and discouraged in favor of a proper
 * logging system like `Log`.
 *
 * @example
 * // ❌ Reports
 * warn("Warning");
 * warn(error);
 *
 * // ✅ OK
 * Log.warn("Warning");
 * Log.error(error);
 */
const noWarn: Rule.RuleModule = {
	/**
	 * Creates the ESLint rule visitor.
	 *
	 * @param context - The ESLint rule context.
	 * @returns The visitor object with AST node handlers.
	 */
	create(context) {
		return {
			'CallExpression[callee.type="Identifier"][callee.name="warn"]'(node: Rule.Node) {
				context.report({
					messageId: "useLog",
					node,
				});
			},
		};
	},
	meta: {
		docs: {
			description: "Ban warn() function calls. Use Log instead.",
			recommended: false,
		},
		messages: {
			useLog: "Use Log instead of warn()",
		},
		schema: [],
		type: "problem",
	},
};

export default noWarn;
