import { createRule } from "$utilities/create-rule";
import { isNumber } from "$utilities/type-utilities";
import { AST_NODE_TYPES } from "@typescript-eslint/types";

import type { TSESTree } from "@typescript-eslint/types";

interface ArgumentsCollection {
	readonly offsetX: CollectedArgument;
	readonly offsetXText: string;
	readonly offsetY: CollectedArgument;
	readonly offsetYText: string;
	readonly scaleX: CollectedArgument;
	readonly scaleXText: string;
	readonly scaleY: CollectedArgument;
	readonly scaleYText: string;
}

interface CollectedArgument {
	readonly numericValue: number | undefined;
	readonly text: string;
}

type NumericBinaryOperator = "+" | "-" | "*" | "/" | "%";
type NumericUnaryOperator = "+" | "-";

const BINARY_OPERATORS: ReadonlySet<string> = new Set(["+", "-", "*", "/", "%"]);
const UNARY_OPERATORS: ReadonlySet<string> = new Set(["+", "-"]);
const BINARY_EVALUATORS: Record<NumericBinaryOperator, (left: number, right: number) => number | undefined> = {
	"%": (left, right) => (right === 0 ? undefined : left % right),
	"*": (left, right) => left * right,
	"+": (left, right) => left + right,
	"-": (left, right) => left - right,
	"/": (left, right) => (right === 0 ? undefined : left / right),
};

function isNumericBinaryOperator(operator: string): operator is NumericBinaryOperator {
	return BINARY_OPERATORS.has(operator);
}

function isNumericUnaryOperator(operator: string): operator is NumericUnaryOperator {
	return UNARY_OPERATORS.has(operator);
}

function isNumericBinaryExpression(
	node: TSESTree.BinaryExpression,
): node is TSESTree.SymmetricBinaryExpression & { readonly operator: NumericBinaryOperator } {
	return isNumericBinaryOperator(node.operator);
}

function isNumericUnaryExpression(
	node: TSESTree.UnaryExpression,
): node is TSESTree.UnaryExpression & { readonly operator: NumericUnaryOperator } {
	return isNumericUnaryOperator(node.operator);
}

function reconstructIdentifierText(node: TSESTree.Identifier): string {
	return node.name;
}

function evaluateUnary(operator: NumericUnaryOperator, argumentValue: number | undefined): number | undefined {
	if (argumentValue === undefined) return undefined;
	if (operator === "-") return -argumentValue;
	return argumentValue;
}

function evaluateBinaryOperation(operator: NumericBinaryOperator, left: number, right: number): number | undefined {
	return BINARY_EVALUATORS[operator](left, right);
}

function evaluateNumericBinary(
	operator: NumericBinaryOperator,
	leftValue: number | undefined,
	rightValue: number | undefined,
): number | undefined {
	if (leftValue === undefined || rightValue === undefined) return undefined;

	return evaluateBinaryOperation(operator, leftValue, rightValue);
}

function collectExpression(node: TSESTree.Expression): CollectedArgument | undefined {
	switch (node.type) {
		case AST_NODE_TYPES.Literal: {
			if (!isNumber(node.value)) return undefined;
			return { numericValue: node.value, text: String(node.value) };
		}

		case AST_NODE_TYPES.Identifier:
			return { numericValue: undefined, text: reconstructIdentifierText(node) };

		case AST_NODE_TYPES.UnaryExpression: {
			if (!isNumericUnaryExpression(node)) return undefined;
			const argument = collectExpression(node.argument);
			if (argument === undefined) return undefined;
			return {
				numericValue: evaluateUnary(node.operator, argument.numericValue),
				text: `${node.operator}${argument.text}`,
			};
		}

		case AST_NODE_TYPES.BinaryExpression: {
			if (!isNumericBinaryExpression(node)) return undefined;
			const left = collectExpression(node.left);
			const right = collectExpression(node.right);
			if (left === undefined || right === undefined) return undefined;
			return {
				numericValue: evaluateNumericBinary(node.operator, left.numericValue, right.numericValue),
				text: `${left.text} ${node.operator} ${right.text}`,
			};
		}

		default:
			return undefined;
	}
}

function collectArgument(parameter: TSESTree.CallExpressionArgument): CollectedArgument | undefined {
	if (parameter.type === AST_NODE_TYPES.SpreadElement) return undefined;
	return collectExpression(parameter);
}

function isCollectedArgument(argument: CollectedArgument | undefined): argument is CollectedArgument {
	return argument !== undefined;
}

function hasFourCollectedArguments(
	parameters: ReadonlyArray<CollectedArgument | undefined>,
): parameters is readonly [CollectedArgument, CollectedArgument, CollectedArgument, CollectedArgument] {
	return parameters.length === 4 && parameters.every(isCollectedArgument);
}

function collectArguments(parameters: ReadonlyArray<TSESTree.CallExpressionArgument>): ArgumentsCollection | undefined {
	const collectedParameters = parameters.map(collectArgument);
	if (!hasFourCollectedArguments(collectedParameters)) return undefined;

	const [scaleX, offsetX, scaleY, offsetY] = collectedParameters;

	return {
		offsetX,
		offsetXText: offsetX.text,
		offsetY,
		offsetYText: offsetY.text,
		scaleX,
		scaleXText: scaleX.text,
		scaleY,
		scaleYText: scaleY.text,
	};
}

type MessageIds = "preferFromOffset" | "preferFromScale";

const preferUDim2Shorthand = createRule<[], MessageIds>({
	create(context) {
		return {
			NewExpression(node): void {
				if (node.callee.type !== AST_NODE_TYPES.Identifier || node.callee.name !== "UDim2") return;

				const collected = collectArguments(node.arguments);
				if (!collected) return;

				const { offsetXText, offsetYText, scaleXText, scaleYText } = collected;

				const scaleX = collected.scaleX.numericValue;
				const offsetX = collected.offsetX.numericValue;
				const scaleY = collected.scaleY.numericValue;
				const offsetY = collected.offsetY.numericValue;

				if (scaleX === 0 && offsetX === 0 && scaleY === 0 && offsetY === 0) return;

				if (offsetX === 0 && offsetY === 0) {
					context.report({
						fix: (fixer) => fixer.replaceText(node, `UDim2.fromScale(${scaleXText}, ${scaleYText})`),
						messageId: "preferFromScale",
						node,
					});
					return;
				}

				if (scaleX === 0 && scaleY === 0) {
					context.report({
						fix: (fixer) => fixer.replaceText(node, `UDim2.fromOffset(${offsetXText}, ${offsetYText})`),
						messageId: "preferFromOffset",
						node,
					});
				}
			},
		};
	},
	meta: {
		defaultOptions: [],
		docs: {
			description:
				"Prefer UDim2.fromScale() or UDim2.fromOffset() over new UDim2() when all offsets or all scales are zero.",
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
	name: "prefer-udim2-shorthand",
});

export default preferUDim2Shorthand;
