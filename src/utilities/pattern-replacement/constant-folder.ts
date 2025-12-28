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
	const expr = unwrap(node);

	// Numeric literal
	if (expr.type === AST_NODE_TYPES.Literal && typeof expr.value === "number") {
		return normalizeZero(expr.value);
	}

	// Unary expression (-x, +x)
	if (expr.type === AST_NODE_TYPES.UnaryExpression) {
		const arg = evaluateConstant(expr.argument);
		if (arg === undefined) return undefined;

		switch (expr.operator) {
			case "-":
				return normalizeZero(-arg);
			case "+":
				return normalizeZero(Number(arg));
			default:
				return undefined;
		}
	}

	// Binary expression (a + b, a - b, a * b, a / b)
	if (expr.type === AST_NODE_TYPES.BinaryExpression) {
		// Private identifiers cannot be evaluated as constants
		if (expr.left.type === AST_NODE_TYPES.PrivateIdentifier) return undefined;

		const left = evaluateConstant(expr.left);
		const right = evaluateConstant(expr.right);
		if (left === undefined || right === undefined) return undefined;

		let result: number;
		switch (expr.operator) {
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

		// Reject non-finite results (NaN, Infinity, -Infinity)
		if (!Number.isFinite(result)) return undefined;
		return normalizeZero(result);
	}

	return undefined;
}
