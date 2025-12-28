import type { TSESTree } from "@typescript-eslint/types";
import { AST_NODE_TYPES } from "@typescript-eslint/types";

/**
 * Normalize -0 to 0 for consistent comparisons
 *
 * @param num - The number to normalize
 * @returns The normalized number (converts -0 to 0)
 */
export function normalizeZero(num: number): number {
	return Object.is(num, -0) ? 0 : num;
}

/**
 * Unwrap TypeScript wrapper nodes
 *
 * @param node - The expression node to unwrap
 * @returns The unwrapped expression
 */
export function unwrap(node: TSESTree.Expression): TSESTree.Expression {
	switch (node.type) {
		case AST_NODE_TYPES.TSAsExpression:
		case AST_NODE_TYPES.TSNonNullExpression:
			return unwrap(node.expression);

		default:
			return node;
	}
}

/**
 * Evaluate a constant expression at lint time.
 * Returns undefined if the expression cannot be evaluated to a constant.
 *
 * @param node - The expression node to evaluate
 * @returns The evaluated constant number, or undefined if not a constant
 */
export function evaluateConstant(node: TSESTree.Expression): number | undefined {
	const expression = unwrap(node);

	if (expression.type === AST_NODE_TYPES.Literal && typeof expression.value === "number") {
		return normalizeZero(expression.value);
	}

	if (expression.type === AST_NODE_TYPES.UnaryExpression) {
		const argument = evaluateConstant(expression.argument);
		if (argument === undefined) return undefined;

		switch (expression.operator) {
			case "-":
				return normalizeZero(-argument);

			case "+":
				return normalizeZero(Number(argument));

			default:
				return undefined;
		}
	}

	if (expression.type === AST_NODE_TYPES.BinaryExpression) {
		if (expression.left.type === AST_NODE_TYPES.PrivateIdentifier) return undefined;

		const left = evaluateConstant(expression.left);
		const right = evaluateConstant(expression.right);
		if (left === undefined || right === undefined) return undefined;

		let result: number;
		switch (expression.operator) {
			case "+":
				result = left + right;
				break;

			case "-":
				result = left - right;
				break;

			case "*":
				result = left * right;
				break;

			case "/":
				result = left / right;
				break;

			default:
				return undefined;
		}

		return Number.isFinite(result) ? normalizeZero(result) : undefined;
	}

	return undefined;
}
