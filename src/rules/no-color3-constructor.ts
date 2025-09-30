import type { Rule } from "eslint";

interface NumericLiteralNode {
	readonly type: string;
	readonly value: number;
}

function isUnknownRecord(value: unknown): value is Record<PropertyKey, unknown> {
	return typeof value === "object" && value !== null;
}

function isNumericLiteralNode(value: unknown): value is NumericLiteralNode {
	return (
		isUnknownRecord(value) &&
		value.type === "Literal" &&
		"value" in value &&
		typeof value.value === "number"
	);
}

function mapComponentToRgbRange(value: number): number {
	return Math.round(value > 1 ? value : value * 255);
}

interface NumericComponentCollection {
	readonly components: Array<number>;
	readonly allZero: boolean;
}

function collectNumericComponents(parameters: ReadonlyArray<unknown>): NumericComponentCollection | undefined {
	const components: number[] = [];
	let allZero = true;

	for (const parameter of parameters) {
		if (!isNumericLiteralNode(parameter)) return undefined;

		const mapped = mapComponentToRgbRange(parameter.value);
		components.push(mapped);
		if (mapped !== 0) allZero = false;
	}

	return { allZero, components };
}

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
				if (parameters.length === 0) return;

				const collected = collectNumericComponents(parameters);
				if (!collected) {
					context.report({
						messageId: parameters.length < 3 ? "useFromRGB" : "onlyZeroArgs",
						node,
					});
					return;
				}

				if (parameters.length < 3) {
					const [red, green = 0] = collected.components;
					context.report({
						fix: (fixer) => fixer.replaceText(node, `Color3.fromRGB(${red}, ${green}, 0)`),
						messageId: "useFromRGB",
						node,
					});
					return;
				}

				if (!collected.allZero) {
					context.report({
						fix: (fixer) => fixer.replaceText(node, `Color3.fromRGB(${collected.components.join(", ")})`),
						messageId: "onlyZeroArgs",
						node,
					});
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
