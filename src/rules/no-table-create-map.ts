import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utilities/create-rule";

type MessageIds = "avoidConstructThenMap";

const WRAPPER_TYPES = new Set([
	"TSAsExpression",
	"TSSatisfiesExpression",
	"TSTypeAssertion",
	"TSNonNullExpression",
	"TSInstantiationExpression",
	"ChainExpression",
]);

type Options = [];

function unwrapExpression(expression: TSESTree.Expression): TSESTree.Expression {
	let current: TSESTree.Expression = expression;

	while (WRAPPER_TYPES.has(current.type)) {
		switch (current.type) {
			case AST_NODE_TYPES.TSAsExpression:
			case AST_NODE_TYPES.TSSatisfiesExpression:
			case AST_NODE_TYPES.TSTypeAssertion:
			case AST_NODE_TYPES.TSNonNullExpression:
			case AST_NODE_TYPES.TSInstantiationExpression:
			case AST_NODE_TYPES.ChainExpression:
				current = current.expression;
				break;
		}
	}

	return current;
}

function getMemberPropertyName(memberExpression: TSESTree.MemberExpression): string | undefined {
	if (!memberExpression.computed) {
		if (memberExpression.property.type === AST_NODE_TYPES.Identifier) return memberExpression.property.name;
		return undefined;
	}

	if (memberExpression.property.type !== AST_NODE_TYPES.Literal) return undefined;
	return typeof memberExpression.property.value === "string" ? memberExpression.property.value : undefined;
}

function hasShadowedBinding(
	context: TSESLint.RuleContext<MessageIds, Options>,
	node: TSESTree.Node,
	name: string,
): boolean {
	let scope: TSESLint.Scope.Scope | undefined = context.sourceCode.getScope(node);

	while (scope !== undefined) {
		const variable = scope.set.get(name);
		if (variable !== undefined && variable.defs.length > 0) return true;
		scope = scope.upper ?? undefined;
	}

	return false;
}

function isTableCreateBase(context: TSESLint.RuleContext<MessageIds, Options>, expression: TSESTree.Expression): boolean {
	const unwrapped = unwrapExpression(expression);
	if (unwrapped.type !== AST_NODE_TYPES.CallExpression || unwrapped.optional) return false;
	if (unwrapped.callee.type === AST_NODE_TYPES.Super) return false;

	const callee = unwrapExpression(unwrapped.callee);
	if (callee.type !== AST_NODE_TYPES.MemberExpression || callee.optional) return false;
	if (callee.object.type === AST_NODE_TYPES.Super) return false;
	if (getMemberPropertyName(callee) !== "create") return false;

	const target = unwrapExpression(callee.object);
	if (target.type !== AST_NODE_TYPES.Identifier || target.name !== "table") return false;
	return !hasShadowedBinding(context, target, "table");
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
	return !hasShadowedBinding(context, callee, "Array");
}

export default createRule<Options, MessageIds>({
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
