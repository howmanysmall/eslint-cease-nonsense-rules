import type { Rule } from "eslint";

/**
 * Bans use of `new Color3(...)` except for `new Color3()` or `new Color3(0, 0, 0)`.
 *
 * The `new Color3()` constructor uses float values [0-1] and performs worse than
 * `Color3.fromRGB()` which uses integer values [0-255].
 *
 * @example
 * // ❌ Reports
 * new Color3(255, 128, 64);
 * new Color3(0.5);
 * new Color3(1, 0);
 *
 * // ✅ OK
 * new Color3();
 * new Color3(0, 0, 0);
 * Color3.fromRGB(255, 128, 64);
 */
const noColor3Constructor: Rule.RuleModule = {
	/**
	 * Creates the ESLint rule visitor.
	 *
	 * @param context - The ESLint rule context.
	 * @returns The visitor object with AST node handlers.
	 */
	create(context) {
		return {
			NewExpression(node) {
				if (node.callee.type !== "Identifier" || node.callee.name !== "Color3") return;

				const args = node.arguments;

				// No arguments is allowed: new Color3()
				if (args.length === 0) return;

				// 1 or 2 arguments - always flag
				if (args.length === 1 || args.length === 2) {
					context.report({
						messageId: "useFromRGB",
						node,
					});
					return;
				}

				// 3 arguments - only allow if all are literal 0
				if (args.length === 3) {
					const allZero = args.every((arg) => arg.type === "Literal" && arg.value === 0);

					if (!allZero) {
						context.report({
							messageId: "onlyZeroArgs",
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
				"Ban new Color3(...) except new Color3() or new Color3(0, 0, 0). Use Color3.fromRGB() instead.",
			recommended: false,
		},
		messages: {
			onlyZeroArgs:
				"Use Color3.fromRGB() instead of new Color3(). new Color3() uses floats [0-1] and performs worse than Color3.fromRGB() which uses [0-255]. Only 'new Color3()' or 'new Color3(0, 0, 0)' are allowed.",
			useFromRGB:
				"Use Color3.fromRGB() instead of new Color3(). new Color3() uses floats [0-1] and performs worse than Color3.fromRGB() which uses [0-255].",
		},
		schema: [],
		type: "problem",
	},
};

export default noColor3Constructor;
