import { AST_NODE_TYPES } from "@typescript-eslint/utils";

import { getMemberPropertyName, hasShadowedBinding, unwrapExpression } from "../utilities/ast-utilities";
import { createRule } from "../utilities/create-rule";

import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

type MessageIds = "avoidConstructThenMap";

type Options = [];

function isTableCreateBase(
	context: TSESLint.RuleContext<MessageIds, Options>,
	expression: TSESTree.Expression,
): boolean {
	const unwrapped = unwrapExpression(expression);
	if (unwrapped.type !== AST_NODE_TYPES.CallExpression || unwrapped.optional) return false;
	if (unwrapped.callee.type === AST_NODE_TYPES.Super) return false;

	const callee = unwrapExpression(unwrapped.callee);
	if (callee.type !== AST_NODE_TYPES.MemberExpression || callee.optional) return false;
	if (callee.object.type === AST_NODE_TYPES.Super) return false;
	if (getMemberPropertyName(callee) !== "create") return false;

	const target = unwrapExpression(callee.object);
	if (target.type !== AST_NODE_TYPES.Identifier || target.name !== "table") return false;
	return !hasShadowedBinding(context.sourceCode, target, "table");
}

function isArrayConstructorBase(
	context: TSESLint.RuleContext<MessageIds, Options>,
	expression: TSESTree.Expression,
): boolean {
	const unwrapped = unwrapExpression(expression);
	if (unwrapped.type !== AST_NODE_TYPES.NewExpression) return false;
	if (unwrapped.arguments.length !== 1 && unwrapped.arguments.length !== 2) return false;
	if (unwrapped.callee.type === AST_NODE_TYPES.Super) return false;

	const callee = unwrapExpression(unwrapped.callee);
	if (callee.type !== AST_NODE_TYPES.Identifier || callee.name !== "Array") return false;
	return !hasShadowedBinding(context.sourceCode, callee, "Array");
}

const noTableCreateMap = createRule<Options, MessageIds>({
	create(context) {
		return {
			CallExpression(node): void {
				if (node.optional) return;
				if (node.callee.type === AST_NODE_TYPES.Super) return;

				const callee = unwrapExpression(node.callee);
				if (callee.type !== AST_NODE_TYPES.MemberExpression || callee.optional) return;
				if (callee.object.type === AST_NODE_TYPES.Super) return;
				if (getMemberPropertyName(callee) !== "map") return;

				const base = unwrapExpression(callee.object);
				if (!(isTableCreateBase(context, base) || isArrayConstructorBase(context, base))) return;

				context.report({
					messageId: "avoidConstructThenMap",
					node,
				});
			},
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description:
				"Disallow map(...) directly on table.create(...) and new Array(...) constructor patterns in roblox-ts.",
		},
		messages: {
			avoidConstructThenMap:
				"Do not map directly on table.create(...) or new Array(...). Allocate first, then write by index in a loop.",
		},
		schema: [],
		type: "suggestion",
	},
	name: "no-table-create-map",
});

export default noTableCreateMap;
