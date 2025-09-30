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

				const parameters = node.arguments;

				// No arguments is allowed: new Color3()
				if (parameters.length === 0) return;

				// 1 or 2 arguments - always flag
				if (parameters.length === 1 || parameters.length === 2) {
					context.report({
						messageId: "useFromRGB",
						node,
						fix(fixer) {
							// Only provide fix if all arguments are numeric literals
							const arg1 = parameters[0];
							const arg2 = parameters.length === 2 ? parameters[1] : null;

							if (!arg1 || arg1.type !== "Literal" || typeof arg1.value !== "number") return null;
							if (arg2 && (arg2.type !== "Literal" || typeof arg2.value !== "number")) return null;

							// Extract values as numbers after type check
							const value1 = Number(arg1.value);
							const value2 = arg2 ? Number(arg2.value) : 0;

							// If value > 1, assume it's already in RGB range; otherwise multiply by 255
							const val1 = value1 > 1 ? Math.round(value1) : Math.round(value1 * 255);
							const val2 = value2 > 1 ? Math.round(value2) : Math.round(value2 * 255);

							return fixer.replaceText(node, `Color3.fromRGB(${val1}, ${val2}, 0)`);
						},
					});
					return;
				}

				// 3 arguments - only allow if all are literal 0
				if (parameters.length === 3) {
					const allZero = parameters.every(
						(parameter) => parameter.type === "Literal" && parameter.value === 0,
					);

					if (!allZero) {
						context.report({
							messageId: "onlyZeroArgs",
							node,
							fix(fixer) {
								// Only provide fix if all arguments are numeric literals
								const [parameter0, parameter1, parameter2] = parameters;

								if (!parameter0 || parameter0.type !== "Literal" || typeof parameter0.value !== "number")
									return null;
								if (!parameter1 || parameter1.type !== "Literal" || typeof parameter1.value !== "number")
									return null;
								if (!parameter2 || parameter2.type !== "Literal" || typeof parameter2.value !== "number")
									return null;

								// Extract values as numbers after type check
								const value1 = Number(parameter0.value);
								const value2 = Number(parameter1.value);
								const value3 = Number(parameter2.value);

								// If value > 1, assume it's already in RGB range; otherwise multiply by 255
								const val1 = value1 > 1 ? Math.round(value1) : Math.round(value1 * 255);
								const val2 = value2 > 1 ? Math.round(value2) : Math.round(value2 * 255);
								const val3 = value3 > 1 ? Math.round(value3) : Math.round(value3 * 255);

								return fixer.replaceText(node, `Color3.fromRGB(${val1}, ${val2}, ${val3})`);
							},
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
			recommended: true,
		},
		fixable: "code",
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
