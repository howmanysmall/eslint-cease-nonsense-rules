import { TSESTree } from "@typescript-eslint/utils";
import type { Rule } from "eslint";

interface ArgumentsCollection {
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
function hasTypeProperty(
	object: Record<PropertyKey, unknown>,
): object is Record<PropertyKey, unknown> & { type: unknown } {
	return "type" in object;
}

const OPERATORS = new Set(["+", "-", "*", "/", "%"]);

function reconstructText(node: Record<PropertyKey, unknown>): string | undefined {
	const nodeType = node.type;

	if (nodeType === TSESTree.AST_NODE_TYPES.Literal) {
		const { value } = node;
		return isNumber(value) ? String(value) : undefined;
	}

	if (nodeType === TSESTree.AST_NODE_TYPES.Identifier) {
		const { name } = node;
		return typeof name === "string" ? name : undefined;
	}

	if (nodeType === TSESTree.AST_NODE_TYPES.UnaryExpression) {
		const { operator } = node;
		if (typeof operator !== "string") return undefined;

		const { argument } = node;
		if (!isRecord(argument)) return undefined;

		const text = reconstructText(argument);
		return text === undefined ? undefined : `${operator}${text}`;
	}

	if (nodeType === TSESTree.AST_NODE_TYPES.BinaryExpression) {
		const { operator } = node;
		if (typeof operator !== "string" || !OPERATORS.has(operator)) return undefined;

		const { left, right } = node;
		if (!(isRecord(left) && isRecord(right))) return undefined;

		const leftText = reconstructText(left);
		const rightText = reconstructText(right);
		return leftText === undefined || rightText === undefined ? undefined : `${leftText} ${operator} ${rightText}`;
	}

	return undefined;
}

function evaluateExpression(node: unknown): number | undefined {
	if (!isRecord(node)) return undefined;

	const nodeType = node.type;

	if (nodeType === TSESTree.AST_NODE_TYPES.Literal) {
		const { value } = node;
		return isNumber(value) ? value : undefined;
	}

	if (nodeType === TSESTree.AST_NODE_TYPES.UnaryExpression) {
		const { argument, operator } = node;

		if (typeof argument === "object" && argument !== null) {
			const value = evaluateExpression(argument);
			if (value === undefined) return undefined;
			if (operator === "-") return -value;
			if (operator === "+") return value;
		}
		return undefined;
	}

	if (nodeType === TSESTree.AST_NODE_TYPES.BinaryExpression) {
		const { right, left, operator } = node;

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

				case "/":
					return rightValue === 0 ? undefined : leftValue / rightValue;

				case "%":
					return rightValue === 0 ? undefined : leftValue % rightValue;

				default:
					return undefined;
			}
		}
		return undefined;
	}

	return undefined;
}

function collectArguments(_context: RuleContext, parameters: ReadonlyArray<unknown>): ArgumentsCollection | undefined {
	if (parameters.length !== 4) return undefined;

	const texts: Array<string | undefined> = [undefined, undefined, undefined, undefined];

	for (let index = 0; index < 4; index++) {
		const parameter = parameters[index];
		if (!(isRecord(parameter) && hasTypeProperty(parameter))) return undefined;

		if (parameter.type === TSESTree.AST_NODE_TYPES.SpreadElement) return undefined;

		const text = reconstructText(parameter);
		if (text === undefined) return undefined;
		texts[index] = text;
	}

	const [scaleXText, offsetXText, scaleYText, offsetYText] = texts;

	if (scaleXText === undefined || offsetXText === undefined || scaleYText === undefined || offsetYText === undefined)
		return undefined;

	return { offsetXText, offsetYText, scaleXText, scaleYText };
}

const preferUDim2Shorthand: Rule.RuleModule = {
	create(context) {
		return {
			NewExpression(node) {
				if (node.callee.type !== TSESTree.AST_NODE_TYPES.Identifier || node.callee.name !== "UDim2") return;

				const collected = collectArguments(context, node.arguments);
				if (!collected) return;

				const { offsetXText, offsetYText, scaleXText, scaleYText } = collected;

				const scaleX = evaluateExpression(node.arguments[0]);
				const offsetX = evaluateExpression(node.arguments[1]);
				const scaleY = evaluateExpression(node.arguments[2]);
				const offsetY = evaluateExpression(node.arguments[3]);

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
