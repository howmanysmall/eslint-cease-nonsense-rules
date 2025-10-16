import type { Rule } from "eslint";

interface NumericLiteralNode {
	readonly type: string;
	readonly value: number;
}

function isUnknownRecord(value: unknown): value is Record<PropertyKey, unknown> {
	return typeof value === "object" && value !== null;
}

function isNumericLiteralNode(value: unknown): value is NumericLiteralNode {
	return isUnknownRecord(value) && value.type === "Literal" && "value" in value && typeof value.value === "number";
}

interface NumericArgumentsCollection {
	readonly scaleX: number;
	readonly offsetX: number;
	readonly scaleY: number;
	readonly offsetY: number;
}

function collectNumericArguments(parameters: ReadonlyArray<unknown>): NumericArgumentsCollection | undefined {
	if (parameters.length !== 4) return undefined;

	if (!isNumericLiteralNode(parameters[0])) return undefined;
	if (!isNumericLiteralNode(parameters[1])) return undefined;
	if (!isNumericLiteralNode(parameters[2])) return undefined;
	if (!isNumericLiteralNode(parameters[3])) return undefined;

	return {
		offsetX: parameters[1].value,
		offsetY: parameters[3].value,
		scaleX: parameters[0].value,
		scaleY: parameters[2].value,
	};
}

/**
 * Detects `new UDim2(...)` calls that can be simplified to `UDim2.fromScale()` or `UDim2.fromOffset()`.
 *
 * @example
 * // ❌ Reports
 * new UDim2(1, 0, 1, 0);
 * new UDim2(0, 100, 0, 50);
 *
 * // ✅ OK
 * new UDim2(0, 0, 0, 0);
 * new UDim2(1, 2, 3, 4);
 * UDim2.fromScale(1, 1);
 * UDim2.fromOffset(100, 50);
 */
const preferUDim2Shorthand: Rule.RuleModule = {
	/**
	 * Creates the ESLint rule visitor.
	 *
	 * @param context - The ESLint rule context.
	 * @returns The visitor object with AST node handlers.
	 */
	create(context) {
		return {
			NewExpression(node) {
				if (node.callee.type !== "Identifier" || node.callee.name !== "UDim2") return;

				const collected = collectNumericArguments(node.arguments);
				if (!collected) return;

				const { scaleX, offsetX, scaleY, offsetY } = collected;

				// Allow all zeros
				if (scaleX === 0 && offsetX === 0 && scaleY === 0 && offsetY === 0) return;

				// Check for fromScale pattern (offsets are zero)
				if (offsetX === 0 && offsetY === 0) {
					context.report({
						fix: (fixer) => fixer.replaceText(node, `UDim2.fromScale(${scaleX}, ${scaleY})`),
						messageId: "preferFromScale",
						node,
					});
					return;
				}

				// Check for fromOffset pattern (scales are zero)
				if (scaleX === 0 && scaleY === 0) {
					context.report({
						fix: (fixer) => fixer.replaceText(node, `UDim2.fromOffset(${offsetX}, ${offsetY})`),
						messageId: "preferFromOffset",
						node,
					});
				}
			},
		};
	},
	meta: {
		docs: {
			description:
				"Prefer UDim2.fromScale() or UDim2.fromOffset() over new UDim2() when all offsets or all scales are zero.",
			recommended: true,
		},
		fixable: "code",
		messages: {
			preferFromOffset:
				"Use UDim2.fromOffset() instead of new UDim2(). When all scales are zero, use UDim2.fromOffset() for clarity.",
			preferFromScale:
				"Use UDim2.fromScale() instead of new UDim2(). When all offsets are zero, use UDim2.fromScale() for clarity.",
		},
		schema: [],
		type: "suggestion",
	},
};

export default preferUDim2Shorthand;
