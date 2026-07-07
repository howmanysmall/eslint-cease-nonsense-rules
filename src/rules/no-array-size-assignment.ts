import { createRule } from "$utilities/create-rule";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";

import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

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

type ComparableTarget = TSESTree.Expression | TSESTree.PrivateIdentifier | TSESTree.Super;

function compareSimpleTargets(left: ComparableTarget, right: ComparableTarget): boolean | undefined {
	if (left.type === AST_NODE_TYPES.Identifier && right.type === AST_NODE_TYPES.Identifier) {
		return left.name === right.name;
	}

	if (left.type === AST_NODE_TYPES.ThisExpression && right.type === AST_NODE_TYPES.ThisExpression) {
		return true;
	}

	if (left.type === AST_NODE_TYPES.Super && right.type === AST_NODE_TYPES.Super) {
		return true;
	}

	if (left.type === AST_NODE_TYPES.PrivateIdentifier && right.type === AST_NODE_TYPES.PrivateIdentifier) {
		return left.name === right.name;
	}

	if (left.type === AST_NODE_TYPES.Literal && right.type === AST_NODE_TYPES.Literal) {
		return left.value === right.value && left.raw === right.raw;
	}

	return undefined;
}

function areEquivalentMemberProperties(
	left: TSESTree.MemberExpression,
	right: TSESTree.MemberExpression,
	sourceCode: TSESLint.SourceCode,
): boolean {
	if (left.computed !== right.computed || left.optional !== right.optional) return false;
	if (!areEquivalentTargets(left.object, right.object, sourceCode)) return false;

	if (left.computed) {
		return areEquivalentTargets(left.property, right.property, sourceCode);
	}

	return areEquivalentTargets(left.property, right.property, sourceCode);
}

function areEquivalentTargets(
	left: ComparableTarget,
	right: ComparableTarget,
	sourceCode: TSESLint.SourceCode,
): boolean {
	const simpleComparison = compareSimpleTargets(left, right);
	if (simpleComparison !== undefined) return simpleComparison;

	if (left.type === AST_NODE_TYPES.MemberExpression && right.type === AST_NODE_TYPES.MemberExpression) {
		return areEquivalentMemberProperties(left, right, sourceCode);
	}

	if (left.type === AST_NODE_TYPES.CallExpression && right.type === AST_NODE_TYPES.CallExpression) {
		return sourceCode.getText(left) === sourceCode.getText(right);
	}

	if (left.type === AST_NODE_TYPES.ChainExpression && right.type === AST_NODE_TYPES.ChainExpression) {
		return areEquivalentTargets(left.expression, right.expression, sourceCode);
	}

	return false;
}

function isSafeMemberKey(node: TSESTree.Expression | TSESTree.PrivateIdentifier): boolean {
	switch (node.type) {
		case AST_NODE_TYPES.Identifier:
		case AST_NODE_TYPES.Literal:
		case AST_NODE_TYPES.ThisExpression:
			return true;

		case AST_NODE_TYPES.ChainExpression:
			return isSafeMemberKey(node.expression);

		case AST_NODE_TYPES.MemberExpression: {
			if (node.optional) return false;
			if (!isSafeFixTarget(node.object)) return false;
			if (node.computed) {
				return isSafeMemberKey(node.property);
			}

			return true;
		}

		default:
			return false;
	}
}

function isSafeFixTarget(node: TSESTree.Expression | TSESTree.Super): boolean {
	switch (node.type) {
		case AST_NODE_TYPES.Identifier:
		case AST_NODE_TYPES.ThisExpression:
			return true;

		case AST_NODE_TYPES.MemberExpression: {
			if (node.optional || !isSafeFixTarget(node.object)) return false;
			if (node.computed) return isSafeMemberKey(node.property);

			return true;
		}

		default:
			return false;
	}
}

function isSizeCall(node: TSESTree.Expression): node is SizeCallExpression {
	if (node.type !== AST_NODE_TYPES.CallExpression) return false;
	if (node.arguments.length > 0) return false;
	if (node.callee.type !== AST_NODE_TYPES.MemberExpression) return false;
	if (node.callee.computed) return false;
	if (node.callee.property.type !== AST_NODE_TYPES.Identifier) return false;

	return node.callee.property.name === "size";
}

const noArraySizeAssignment = createRule<Options, MessageIds>({
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
	meta: {
		defaultOptions: [{ allowAutofix: false }],
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

export default noArraySizeAssignment;
