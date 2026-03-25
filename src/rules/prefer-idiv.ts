import { AST_NODE_TYPES } from "@typescript-eslint/utils";

import { getMemberPropertyName, hasShadowedBinding, unwrapExpression } from "../utilities/ast-utilities";
import { createRule } from "../utilities/create-rule";

import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

type MessageIds = "useIdiv";
type Options = [];

function canUseDirectReceiver(node: TSESTree.Expression): boolean {
	switch (node.type) {
		case AST_NODE_TYPES.CallExpression:
		case AST_NODE_TYPES.Identifier:
		case AST_NODE_TYPES.MemberExpression:
		case AST_NODE_TYPES.NewExpression:
		case AST_NODE_TYPES.ThisExpression:
			return true;

		default:
			return false;
	}
}

function getReceiverText(sourceCode: Readonly<TSESLint.SourceCode>, node: TSESTree.Expression): string {
	const text = sourceCode.getText(node);
	return canUseDirectReceiver(node) ? text : `(${text})`;
}

const preferIdiv = createRule<Options, MessageIds>({
	create(context) {
		return {
			CallExpression(node): void {
				if (node.optional) return;
				if (node.callee.type === AST_NODE_TYPES.Super) return;

				const callee = unwrapExpression(node.callee);
				if (callee.type !== AST_NODE_TYPES.MemberExpression) return;
				if (callee.optional) return;
				if (callee.object.type === AST_NODE_TYPES.Super) return;

				if (getMemberPropertyName(callee) !== "floor") return;

				const target = unwrapExpression(callee.object);
				if (target.type !== AST_NODE_TYPES.Identifier || target.name !== "math") return;
				if (hasShadowedBinding(context.sourceCode, target, "math")) return;

				if (node.arguments.length !== 1) return;
				const [firstArgument] = node.arguments;
				if (firstArgument === undefined || firstArgument.type === AST_NODE_TYPES.SpreadElement) return;

				const arg = unwrapExpression(firstArgument);
				if (arg.type !== AST_NODE_TYPES.BinaryExpression || arg.operator !== "/") return;

				const leftText = getReceiverText(context.sourceCode, arg.left);
				const rightText = context.sourceCode.getText(arg.right);

				context.report({
					data: { left: leftText, right: rightText },
					fix: (fixer) => fixer.replaceText(node, `${leftText}.idiv(${rightText})`),
					messageId: "useIdiv",
					node,
				});
			},
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description: "Prefer using `.idiv()` for integer division instead of `math.floor(x / y)` in roblox-ts.",
		},
		fixable: "code",
		messages: {
			useIdiv: "Use `{{left}}.idiv({{right}})` instead of `math.floor({{left}} / {{right}})`.",
		},
		schema: [],
		type: "suggestion",
	},
	name: "prefer-idiv",
});

export default preferIdiv;
