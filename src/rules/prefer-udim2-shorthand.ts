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
	let text: string | undefined;

	if (nodeType === TSESTree.AST_NODE_TYPES.Literal) {
		const { value } = node;
		text = isNumber(value) ? String(value) : undefined;
	}

	if (nodeType === TSESTree.AST_NODE_TYPES.Identifier) {
		const { name } = node;
		text = typeof name === "string" ? name : undefined;
	}

	if (nodeType === TSESTree.AST_NODE_TYPES.UnaryExpression) {
		const { operator } = node;
		if (typeof operator === "string") {
			const { argument } = node;
			if (isRecord(argument)) {
				const argumentText = reconstructText(argument);
				if (argumentText !== undefined) text = `${operator}${argumentText}`;
			}
		}
	}

	if (nodeType === TSESTree.AST_NODE_TYPES.BinaryExpression) {
		const { operator } = node;
		if (typeof operator === "string" && OPERATORS.has(operator)) {
			const { left, right } = node;
			if (isRecord(left) && isRecord(right)) {
				const leftText = reconstructText(left);
				const rightText = reconstructText(right);
				if (leftText !== undefined && rightText !== undefined) text = `${leftText} ${operator} ${rightText}`;
			}
		}
	}

	return text;
}

function evaluateExpression(node: unknown): number | undefined {
	if (!isRecord(node)) return undefined;

	const nodeType = node.type;
	let value: number | undefined;

	if (nodeType === TSESTree.AST_NODE_TYPES.Literal) {
		const { value: literalValue } = node;
		value = isNumber(literalValue) ? literalValue : undefined;
	}

	if (nodeType === TSESTree.AST_NODE_TYPES.UnaryExpression) {
		const { argument, operator } = node;
		if (isRecord(argument)) {
			const argumentValue = evaluateExpression(argument);
			if (operator === "-" && argumentValue !== undefined) value = -argumentValue;
			if (operator === "+" && argumentValue !== undefined) value = argumentValue;
		}
	}

	if (nodeType === TSESTree.AST_NODE_TYPES.BinaryExpression) {
		const { right, left, operator } = node;
		if (isRecord(left) && isRecord(right) && typeof operator === "string" && OPERATORS.has(operator)) {
			const leftValue = evaluateExpression(left);
			const rightValue = evaluateExpression(right);
			if (leftValue !== undefined && rightValue !== undefined) {
				if (operator === "+") value = leftValue + rightValue;
				if (operator === "-") value = leftValue - rightValue;
				if (operator === "*") value = leftValue * rightValue;
				if (operator === "/") value = rightValue === 0 ? undefined : leftValue / rightValue;
				if (operator === "%") value = rightValue === 0 ? undefined : leftValue % rightValue;
			}
		}
	}

	return value;
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
