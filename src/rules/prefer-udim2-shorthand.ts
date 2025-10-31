import { TSESTree } from "@typescript-eslint/types";
import type { Rule } from "eslint";
import Type from "typebox";
import { Compile } from "typebox/compile";

const isNumericLiteralNode = Compile(
	Type.Object({
		type: Type.Literal(TSESTree.AST_NODE_TYPES.Literal),
		value: Type.Number(),
	}),
);

const isCorrectParameters = Compile(
	Type.Tuple([isNumericLiteralNode, isNumericLiteralNode, isNumericLiteralNode, isNumericLiteralNode], {}),
);

interface NumericArgumentsCollection {
	readonly scaleX: number;
	readonly offsetX: number;
	readonly scaleY: number;
	readonly offsetY: number;
}

function collectNumericArguments(parameters: ReadonlyArray<unknown>): NumericArgumentsCollection | undefined {
	return isCorrectParameters.Check(parameters)
		? {
				offsetX: parameters[1].value,
				offsetY: parameters[3].value,
				scaleX: parameters[0].value,
				scaleY: parameters[2].value,
			}
		: undefined;
}

const preferUDim2Shorthand: Rule.RuleModule = {
	create(context) {
		return {
			NewExpression(node) {
				if (node.callee.type !== TSESTree.AST_NODE_TYPES.Identifier || node.callee.name !== "UDim2") return;

				const collected = collectNumericArguments(node.arguments);
				if (!collected) return;

				const { scaleX, offsetX, scaleY, offsetY } = collected;
				if (scaleX === 0 && offsetX === 0 && scaleY === 0 && offsetY === 0) return;

				if (offsetX === 0 && offsetY === 0) {
					context.report({
						fix: (fixer) => fixer.replaceText(node, `UDim2.fromScale(${scaleX}, ${scaleY})`),
						messageId: "preferFromScale",
						node,
					});
					return;
				}

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
