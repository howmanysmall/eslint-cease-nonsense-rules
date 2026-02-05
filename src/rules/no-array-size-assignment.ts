import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utilities/create-rule";

type MessageIds = "usePush";

export interface NoArraySizeAssignmentOptions {
	readonly allowAutofix?: boolean;
}

type Options = [NoArraySizeAssignmentOptions?];

type SizeCallExpression = TSESTree.CallExpression & {
	readonly callee: TSESTree.MemberExpression & {
		readonly computed: false;
		readonly object: TSESTree.Expression | TSESTree.Super;
		readonly property: TSESTree.Identifier & { readonly name: "size" };
	};
};

function isExpressionNode(node: TSESTree.Expression | TSESTree.PrivateIdentifier): node is TSESTree.Expression {
	return node.type !== AST_NODE_TYPES.PrivateIdentifier;
}

function areEquivalentTargets(
	left: TSESTree.Expression | TSESTree.Super,
	right: TSESTree.Expression | TSESTree.Super,
	sourceCode: TSESLint.SourceCode,
): boolean {
	if (left.type !== right.type) return false;

	switch (left.type) {
		case AST_NODE_TYPES.Identifier:
			return right.type === AST_NODE_TYPES.Identifier && left.name === right.name;

		case AST_NODE_TYPES.ThisExpression:
			return right.type === AST_NODE_TYPES.ThisExpression;

		case AST_NODE_TYPES.Super:
			return right.type === AST_NODE_TYPES.Super;

		case AST_NODE_TYPES.Literal:
			return right.type === AST_NODE_TYPES.Literal && left.value === right.value && left.raw === right.raw;

		case AST_NODE_TYPES.MemberExpression: {
			if (right.type !== AST_NODE_TYPES.MemberExpression) return false;
			if (left.computed !== right.computed || left.optional !== right.optional) return false;
			if (!areEquivalentTargets(left.object, right.object, sourceCode)) return false;

			if (left.computed) {
				if (!(isExpressionNode(left.property) && isExpressionNode(right.property))) return false;
				return areEquivalentTargets(left.property, right.property, sourceCode);
			}

			if (
				left.property.type === AST_NODE_TYPES.PrivateIdentifier ||
				right.property.type === AST_NODE_TYPES.PrivateIdentifier
			) {
				return (
					left.property.type === AST_NODE_TYPES.PrivateIdentifier &&
					right.property.type === AST_NODE_TYPES.PrivateIdentifier &&
					left.property.name === right.property.name
				);
			}

			if (left.property.type !== AST_NODE_TYPES.Identifier) return false;
			if (right.property.type !== AST_NODE_TYPES.Identifier) return false;
			return left.property.name === right.property.name;
		}

		case AST_NODE_TYPES.CallExpression:
			if (right.type !== AST_NODE_TYPES.CallExpression) return false;
			return sourceCode.getText(left) === sourceCode.getText(right);

		default:
			return false;
	}
}

function isSafeMemberKey(node: TSESTree.Expression): boolean {
	switch (node.type) {
		case AST_NODE_TYPES.Identifier:
		case AST_NODE_TYPES.Literal:
		case AST_NODE_TYPES.ThisExpression:
			return true;

		case AST_NODE_TYPES.MemberExpression:
			if (node.optional) return false;
			if (!isSafeFixTarget(node.object)) return false;
			if (node.computed) {
				if (!isExpressionNode(node.property)) return false;
				return isSafeMemberKey(node.property);
			}

			return (
				node.property.type === AST_NODE_TYPES.Identifier ||
				node.property.type === AST_NODE_TYPES.PrivateIdentifier
			);

		default:
			return false;
	}
}

function isSafeFixTarget(node: TSESTree.Expression | TSESTree.Super): boolean {
	switch (node.type) {
		case AST_NODE_TYPES.Identifier:
		case AST_NODE_TYPES.ThisExpression:
			return true;

		case AST_NODE_TYPES.MemberExpression:
			if (node.optional) return false;
			if (!isSafeFixTarget(node.object)) return false;

			if (node.computed) {
				if (!isExpressionNode(node.property)) return false;
				return isSafeMemberKey(node.property);
			}

			return (
				node.property.type === AST_NODE_TYPES.Identifier ||
				node.property.type === AST_NODE_TYPES.PrivateIdentifier
			);

		default:
			return false;
	}
}

function isSizeCall(node: TSESTree.Expression): node is SizeCallExpression {
	if (node.type !== AST_NODE_TYPES.CallExpression) return false;
	if (node.optional) return false;
	if (node.arguments.length > 0) return false;
	if (node.callee.type !== AST_NODE_TYPES.MemberExpression) return false;
	if (node.callee.optional) return false;
	if (node.callee.computed) return false;
	if (node.callee.property.type !== AST_NODE_TYPES.Identifier) return false;

	return node.callee.property.name === "size";
}

export default createRule<Options, MessageIds>({
	create(context) {
		const [{ allowAutofix = false } = {}] = context.options;
		const { sourceCode } = context;

		return {
			AssignmentExpression(node): void {
				if (node.operator !== "=") return;
				if (node.left.type !== AST_NODE_TYPES.MemberExpression || !node.left.computed) return;
				if (!isSizeCall(node.left.property)) return;
				if (!areEquivalentTargets(node.left.object, node.left.property.callee.object, sourceCode)) return;

				const expressionStatement =
					node.parent?.type === AST_NODE_TYPES.ExpressionStatement ? node.parent : undefined;
				const shouldAutofix =
					allowAutofix && expressionStatement !== undefined && isSafeFixTarget(node.left.object);

				if (!shouldAutofix) {
					context.report({
						messageId: "usePush",
						node,
					});
					return;
				}

				const targetText = sourceCode.getText(node.left.object);
				const rightText = sourceCode.getText(node.right);

				context.report({
					fix: (fixer) => fixer.replaceText(expressionStatement, `${targetText}.push(${rightText});`),
					messageId: "usePush",
					node,
				});
			},
		};
	},
	defaultOptions: [{ allowAutofix: false }],
	meta: {
		docs: {
			description:
				"Disallow array append assignments using array[array.size()] = value and prefer push-based appends.",
		},
		fixable: "code",
		messages: {
			usePush: "Do not append with array[array.size()] = value. Use array.push(value) instead.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					allowAutofix: {
						default: false,
						description:
							"When true, auto-fix direct append assignments to .push(value) when the target is safe to evaluate once.",
						type: "boolean",
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
	name: "no-array-size-assignment",
});
