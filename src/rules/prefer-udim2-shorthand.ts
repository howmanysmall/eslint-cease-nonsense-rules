import { TSESTree } from "@typescript-eslint/utils";
import type { Rule } from "eslint";

interface NumericArgumentsCollection {
	readonly scaleX: number;
	readonly offsetX: number;
	readonly scaleY: number;
	readonly offsetY: number;
	readonly scaleXText: string;
	readonly offsetXText: string;
	readonly scaleYText: string;
	readonly offsetYText: string;
}

type RuleContext = Rule.RuleContext;

function isNumber(value: unknown): value is number {
	return typeof value === "number" && !Number.isNaN(value);
}

function isRecord(node: unknown): node is Record<PropertyKey, unknown> {
	return typeof node === "object" && node !== null;
}

function hasTypeProperty(obj: Record<PropertyKey, unknown>): obj is Record<PropertyKey, unknown> & { type: unknown } {
	return "type" in obj;
}

function reconstructText(node: Record<PropertyKey, unknown>): string | undefined {
	const nodeType = node.type;

	if (nodeType === TSESTree.AST_NODE_TYPES.Literal) {
		const value = node.value;
		if (isNumber(value)) {
			return String(value);
		}
		return undefined;
	}

	if (nodeType === TSESTree.AST_NODE_TYPES.UnaryExpression) {
		const operator = node.operator;
		if (typeof operator !== "string") return undefined;

		const argument = node.argument;
		if (!isRecord(argument)) return undefined;

		const argText = reconstructText(argument);
		return argText === undefined ? undefined : `${operator}${argText}`;
	}

	if (nodeType === TSESTree.AST_NODE_TYPES.BinaryExpression) {
		const operator = node.operator;
		if (typeof operator !== "string") return undefined;

		const left = node.left;
		const right = node.right;
		if (!isRecord(left) || !isRecord(right)) {
			return undefined;
		}

		const leftText = reconstructText(left);
		const rightText = reconstructText(right);
		if (leftText === undefined || rightText === undefined) {
			return undefined;
		}
		return `${leftText} ${operator} ${rightText}`;
	}

	return undefined;
}

function evaluateExpression(node: unknown): number | undefined {
	if (!isRecord(node)) return undefined;

	const nodeType = node.type;

	if (nodeType === TSESTree.AST_NODE_TYPES.Literal) {
		const value = node.value;
		if (isNumber(value)) return value;
		return undefined;
	}

	if (nodeType === TSESTree.AST_NODE_TYPES.UnaryExpression) {
		const operator = node.operator;
		const argument = node.argument;

		if (typeof argument === "object" && argument !== null) {
			const argValue = evaluateExpression(argument);
			if (argValue === undefined) return undefined;

			if (operator === "-") return -argValue;
			if (operator === "+") return argValue;
		}
		return undefined;
	}

	if (nodeType === TSESTree.AST_NODE_TYPES.BinaryExpression) {
		const left = node.left;
		const right = node.right;
		const operator = node.operator;

		if (typeof left === "object" && left !== null && typeof right === "object" && right !== null) {
			const leftValue = evaluateExpression(left);
			const rightValue = evaluateExpression(right);
			if (leftValue === undefined || rightValue === undefined) return undefined;

			switch (operator) {
				case "+":
					return leftValue + rightValue;
				case "-":
					return leftValue - rightValue;
				case "*":
					return leftValue * rightValue;
				case "/": {
					if (rightValue === 0) return undefined;
					return leftValue / rightValue;
				}
				case "%": {
					if (rightValue === 0) return undefined;
					return leftValue % rightValue;
				}
				default:
					return undefined;
			}
		}
		return undefined;
	}

	return undefined;
}

function collectNumericArguments(
	_context: RuleContext,
	parameters: readonly unknown[],
): NumericArgumentsCollection | undefined {
	if (parameters.length !== 4) return undefined;

	const values: (number | undefined)[] = [undefined, undefined, undefined, undefined];
	const texts: (string | undefined)[] = [undefined, undefined, undefined, undefined];

	for (let i = 0; i < 4; i++) {
		const parameter = parameters[i];
		if (!isRecord(parameter)) return undefined;
		if (!hasTypeProperty(parameter)) return undefined;

		if (parameter.type === "SpreadElement") return undefined;

		const value = evaluateExpression(parameter);
		if (value === undefined) return undefined;

		values[i] = value;
		const text = reconstructText(parameter);
		if (text === undefined) return undefined;
		texts[i] = text;
	}

	const [scaleX, offsetX, scaleY, offsetY] = values;
	const [scaleXText, offsetXText, scaleYText, offsetYText] = texts;

	if (
		scaleX === undefined ||
		offsetX === undefined ||
		scaleY === undefined ||
		offsetY === undefined ||
		scaleXText === undefined ||
		offsetXText === undefined ||
		scaleYText === undefined ||
		offsetYText === undefined
	) {
		return undefined;
	}

	return { offsetX, offsetXText, offsetY, offsetYText, scaleX, scaleXText, scaleY, scaleYText };
}

const preferUDim2Shorthand: Rule.RuleModule = {
	create(context) {
		return {
			NewExpression(node) {
				if (node.callee.type !== TSESTree.AST_NODE_TYPES.Identifier || node.callee.name !== "UDim2") return;

				const collected = collectNumericArguments(context, node.arguments);
				if (!collected) return;

				const { scaleX, offsetX, scaleY, offsetY, scaleXText, offsetXText, scaleYText, offsetYText } =
					collected;
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
