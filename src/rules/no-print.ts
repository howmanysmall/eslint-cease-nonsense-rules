import type { Rule } from "eslint";

/**
 * Bans use of `print()` function calls. Use `Log` instead.
 *
 * The `print()` function is not wanted in this codebase and discouraged in favor of a proper
 * logging system like `Log`.
 *
 * @example
 * // ❌ Reports
 * print("Hello");
 * print(value);
 *
 * // ✅ OK
 * Log.info("Hello");
 * Log.debug(value);
 */
const noPrint: Rule.RuleModule = {
	/**
	 * Creates the ESLint rule visitor.
	 *
	 * @param context - The ESLint rule context.
	 * @returns The visitor object with AST node handlers.
	 */
	create(context) {
		return {
			CallExpression(node) {
				if (node.callee.type !== "Identifier" || node.callee.name !== "print") return;

				context.report({
					messageId: "useLog",
					node,
				});
			},
		};
	},
	meta: {
		docs: {
			description: "Ban print() function calls. Use Log instead.",
			recommended: false,
		},
		messages: {
			useLog: "Use Log instead of print()",
		},
		schema: [],
		type: "problem",
	},
};

export default noPrint;
