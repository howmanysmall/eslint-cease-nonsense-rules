import { unwrapExpression } from "$utilities/ast-utilities";
import { createRule } from "$utilities/create-rule";
import { getDefinedValue } from "$utilities/defined-utilities";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";

import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

type MessageIds = "preferTernaryConditionalRendering";
type Options = [];

type JSXRenderable = TSESTree.JSXElement | TSESTree.JSXFragment;
type BinaryOperand = TSESTree.Expression | TSESTree.PrivateIdentifier;
type CallArgument = TSESTree.CallExpressionArgument;
type SourceCode = TSESLint.SourceCode;

interface BranchCandidate {
	readonly condition: TSESTree.Expression;
	readonly logical: TSESTree.LogicalExpression;
	readonly node: TSESTree.JSXExpressionContainer;
	readonly renderBranch: JSXRenderable;
}

interface StrictComparison {
	readonly left: BinaryOperand;
	readonly operator: "===" | "!==";
	readonly right: BinaryOperand;
}

interface ComplementMatch {
	readonly isFixSafe: boolean;
}

function isWhitespaceText(child: TSESTree.JSXChild): boolean {
	return child.type === AST_NODE_TYPES.JSXText && child.value.trim() === "";
}

function isRenderableBranch(node: TSESTree.Node): node is JSXRenderable {
	return node.type === AST_NODE_TYPES.JSXElement || node.type === AST_NODE_TYPES.JSXFragment;
}

function isExpressionNode(node: BinaryOperand): node is TSESTree.Expression {
	return node.type !== AST_NODE_TYPES.PrivateIdentifier;
}

function areEquivalentExpressionOrSuper(
	left: TSESTree.Expression | TSESTree.Super,
	right: TSESTree.Expression | TSESTree.Super,
	sourceCode: SourceCode,
): boolean {
	if (left.type === AST_NODE_TYPES.Super || right.type === AST_NODE_TYPES.Super) {
		return left.type === AST_NODE_TYPES.Super && right.type === AST_NODE_TYPES.Super;
	}

	return areEquivalentExpression(left, right, sourceCode);
}

function areEquivalentArgument(left: CallArgument, right: CallArgument, sourceCode: SourceCode): boolean {
	if (left.type === AST_NODE_TYPES.SpreadElement || right.type === AST_NODE_TYPES.SpreadElement) {
		if (left.type !== AST_NODE_TYPES.SpreadElement || right.type !== AST_NODE_TYPES.SpreadElement) return false;
		return areEquivalentExpression(left.argument, right.argument, sourceCode);
	}

	return areEquivalentExpression(left, right, sourceCode);
}

function areEquivalentOperand(left: BinaryOperand, right: BinaryOperand, sourceCode: SourceCode): boolean {
	if (!(isExpressionNode(left) && isExpressionNode(right))) return false;
	return areEquivalentExpression(left, right, sourceCode);
}

function areEquivalentUnaryExpressions(
	left: TSESTree.UnaryExpression,
	right: TSESTree.Expression,
	sourceCode: SourceCode,
): boolean {
	return (
		right.type === AST_NODE_TYPES.UnaryExpression &&
		left.operator === right.operator &&
		areEquivalentExpression(left.argument, right.argument, sourceCode)
	);
}

function areEquivalentBinaryExpressions(
	left: TSESTree.BinaryExpression,
	right: TSESTree.Expression,
	sourceCode: SourceCode,
): boolean {
	return (
		right.type === AST_NODE_TYPES.BinaryExpression &&
		left.operator === right.operator &&
		areEquivalentOperand(left.left, right.left, sourceCode) &&
		areEquivalentOperand(left.right, right.right, sourceCode)
	);
}

function areEquivalentLogicalExpressions(
	left: TSESTree.LogicalExpression,
	right: TSESTree.Expression,
	sourceCode: SourceCode,
): boolean {
	return (
		right.type === AST_NODE_TYPES.LogicalExpression &&
		left.operator === right.operator &&
		areEquivalentExpression(left.left, right.left, sourceCode) &&
		areEquivalentExpression(left.right, right.right, sourceCode)
	);
}

function areEquivalentMemberProperties(
	left: TSESTree.MemberExpression,
	right: TSESTree.MemberExpression,
	sourceCode: SourceCode,
): boolean {
	if (left.computed) {
		return areEquivalentOperand(left.property, right.property, sourceCode);
	}

	if (left.property.type === AST_NODE_TYPES.Identifier && right.property.type === AST_NODE_TYPES.Identifier) {
		return left.property.name === right.property.name;
	}

	return (
		left.property.type === AST_NODE_TYPES.PrivateIdentifier &&
		right.property.type === AST_NODE_TYPES.PrivateIdentifier &&
		left.property.name === right.property.name
	);
}

function areEquivalentMemberExpressions(
	left: TSESTree.MemberExpression,
	right: TSESTree.Expression,
	sourceCode: SourceCode,
): boolean {
	return (
		right.type === AST_NODE_TYPES.MemberExpression &&
		left.computed === right.computed &&
		left.optional === right.optional &&
		areEquivalentExpressionOrSuper(left.object, right.object, sourceCode) &&
		areEquivalentMemberProperties(left, right, sourceCode)
	);
}

function haveEquivalentArguments(
	leftArguments: ReadonlyArray<CallArgument>,
	rightArguments: ReadonlyArray<CallArgument>,
	sourceCode: SourceCode,
): boolean {
	if (leftArguments.length !== rightArguments.length) return false;

	for (let index = 0; index < leftArguments.length; index += 1) {
		const leftArgument = getDefinedValue(leftArguments[index], "Expected left JSX argument.");
		const rightArgument = getDefinedValue(rightArguments[index], "Expected right JSX argument.");
		if (!areEquivalentArgument(leftArgument, rightArgument, sourceCode)) return false;
	}

	return true;
}

function areEquivalentCallExpressions(
	left: TSESTree.CallExpression,
	right: TSESTree.Expression,
	sourceCode: SourceCode,
): boolean {
	return (
		right.type === AST_NODE_TYPES.CallExpression &&
		left.optional === right.optional &&
		areEquivalentExpressionOrSuper(left.callee, right.callee, sourceCode) &&
		haveEquivalentArguments(left.arguments, right.arguments, sourceCode)
	);
}

function areEquivalentExpression(
	left: TSESTree.Expression,
	right: TSESTree.Expression,
	sourceCode: SourceCode,
): boolean {
	const normalizedLeft = unwrapExpression(left);
	const normalizedRight = unwrapExpression(right);

	if (normalizedLeft.type !== normalizedRight.type) return false;

	switch (normalizedLeft.type) {
		case AST_NODE_TYPES.Identifier:
			return normalizedRight.type === AST_NODE_TYPES.Identifier && normalizedLeft.name === normalizedRight.name;

		case AST_NODE_TYPES.ThisExpression:
			return normalizedRight.type === AST_NODE_TYPES.ThisExpression;

		case AST_NODE_TYPES.Literal:
			return normalizedRight.type === AST_NODE_TYPES.Literal && normalizedLeft.value === normalizedRight.value;

		case AST_NODE_TYPES.UnaryExpression: {
			return areEquivalentUnaryExpressions(normalizedLeft, normalizedRight, sourceCode);
		}

		case AST_NODE_TYPES.BinaryExpression: {
			return areEquivalentBinaryExpressions(normalizedLeft, normalizedRight, sourceCode);
		}

		case AST_NODE_TYPES.LogicalExpression: {
			return areEquivalentLogicalExpressions(normalizedLeft, normalizedRight, sourceCode);
		}

		case AST_NODE_TYPES.MemberExpression: {
			return areEquivalentMemberExpressions(normalizedLeft, normalizedRight, sourceCode);
		}

		case AST_NODE_TYPES.CallExpression: {
			return areEquivalentCallExpressions(normalizedLeft, normalizedRight, sourceCode);
		}

		default:
			return sourceCode.getText(normalizedLeft) === sourceCode.getText(normalizedRight);
	}
}

function getNegatedExpression(expression: TSESTree.Expression): TSESTree.Expression | undefined {
	const normalized = unwrapExpression(expression);
	if (normalized.type !== AST_NODE_TYPES.UnaryExpression || normalized.operator !== "!") return undefined;
	return unwrapExpression(normalized.argument);
}

function getStrictComparison(expression: TSESTree.Expression): StrictComparison | undefined {
	const normalized = unwrapExpression(expression);
	if (normalized.type !== AST_NODE_TYPES.BinaryExpression) return undefined;
	if (normalized.operator !== "===" && normalized.operator !== "!==") return undefined;

	return {
		left: normalized.left,
		operator: normalized.operator,
		right: normalized.right,
	};
}

function isSafeAtom(expression: TSESTree.Expression): boolean {
	const normalized = unwrapExpression(expression);

	return (
		normalized.type === AST_NODE_TYPES.Identifier ||
		normalized.type === AST_NODE_TYPES.ThisExpression ||
		normalized.type === AST_NODE_TYPES.Literal
	);
}

function isSafeOperand(operand: BinaryOperand): boolean {
	return isExpressionNode(operand) && isSafeAtom(operand);
}

function getComplementMatch(
	firstCondition: TSESTree.Expression,
	secondCondition: TSESTree.Expression,
	sourceCode: SourceCode,
): ComplementMatch | undefined {
	const firstNegated = getNegatedExpression(firstCondition);
	if (firstNegated && areEquivalentExpression(firstNegated, secondCondition, sourceCode)) {
		return { isFixSafe: isSafeAtom(firstNegated) };
	}

	const secondNegated = getNegatedExpression(secondCondition);
	if (secondNegated && areEquivalentExpression(secondNegated, firstCondition, sourceCode)) {
		return { isFixSafe: isSafeAtom(secondNegated) };
	}

	const firstComparison = getStrictComparison(firstCondition);
	const secondComparison = getStrictComparison(secondCondition);
	if (!(firstComparison && secondComparison)) return undefined;

	const operatorsComplement =
		(firstComparison.operator === "===" && secondComparison.operator === "!==") ||
		(firstComparison.operator === "!==" && secondComparison.operator === "===");
	if (!operatorsComplement) return undefined;

	const directMatch =
		areEquivalentOperand(firstComparison.left, secondComparison.left, sourceCode) &&
		areEquivalentOperand(firstComparison.right, secondComparison.right, sourceCode);
	const swappedMatch =
		areEquivalentOperand(firstComparison.left, secondComparison.right, sourceCode) &&
		areEquivalentOperand(firstComparison.right, secondComparison.left, sourceCode);

	if (!(directMatch || swappedMatch)) return undefined;

	return {
		isFixSafe:
			isSafeOperand(firstComparison.left) &&
			isSafeOperand(firstComparison.right) &&
			isSafeOperand(secondComparison.left) &&
			isSafeOperand(secondComparison.right),
	};
}

function getBranchCandidate(child: TSESTree.JSXChild): BranchCandidate | undefined {
	if (child.type !== AST_NODE_TYPES.JSXExpressionContainer) return undefined;
	if (child.expression.type === AST_NODE_TYPES.JSXEmptyExpression) return undefined;
	if (child.expression.type !== AST_NODE_TYPES.LogicalExpression) return undefined;
	if (child.expression.operator !== "&&") return undefined;
	if (!isRenderableBranch(child.expression.right)) return undefined;

	return {
		condition: child.expression.left,
		logical: child.expression,
		node: child,
		renderBranch: child.expression.right,
	};
}

function getNextNonWhitespaceIndex(children: ReadonlyArray<TSESTree.JSXChild>, startIndex: number): number {
	let nextIndex = startIndex;

	while (nextIndex < children.length) {
		const whitespaceCandidate = children[nextIndex];
		if (!(whitespaceCandidate && isWhitespaceText(whitespaceCandidate))) break;
		nextIndex += 1;
	}

	return nextIndex;
}

const preferTernaryConditionalRendering = createRule<Options, MessageIds>({
	create(context) {
		const { sourceCode } = context;

		function reportFixableComplement(firstBranch: BranchCandidate, secondBranch: BranchCandidate): void {
			context.report({
				fix(fixer) {
					const firstConditionText = sourceCode.getText(firstBranch.condition);
					const firstBranchText = sourceCode.getText(firstBranch.renderBranch);
					const secondBranchText = sourceCode.getText(secondBranch.renderBranch);
					const replacement = `{${firstConditionText} ? ${firstBranchText} : ${secondBranchText}}`;

					return fixer.replaceTextRange([firstBranch.node.range[0], secondBranch.node.range[1]], replacement);
				},
				messageId: "preferTernaryConditionalRendering",
				node: firstBranch.logical,
			});
		}

		function reportComplement(firstBranch: BranchCandidate, secondBranch: BranchCandidate): boolean {
			const complement = getComplementMatch(firstBranch.condition, secondBranch.condition, sourceCode);
			if (!complement) return false;

			if (complement.isFixSafe) {
				reportFixableComplement(firstBranch, secondBranch);
			} else {
				context.report({
					messageId: "preferTernaryConditionalRendering",
					node: firstBranch.logical,
				});
			}

			return true;
		}

		function inspectChildAtIndex(
			children: ReadonlyArray<TSESTree.JSXChild>,
			index: number,
			firstChild: TSESTree.JSXChild,
		): number {
			const firstBranch = getBranchCandidate(firstChild);
			if (!firstBranch) return index + 1;

			const nextIndex = getNextNonWhitespaceIndex(children, index + 1);
			const secondChild = children[nextIndex];
			if (!secondChild) return index + 1;

			const secondBranch = getBranchCandidate(secondChild);
			if (!secondBranch) return index + 1;

			return reportComplement(firstBranch, secondBranch) ? nextIndex + 1 : index + 1;
		}

		function inspectChildren(children: ReadonlyArray<TSESTree.JSXChild>): void {
			let ignoredUntilIndex = 0;

			for (const [index, firstChild] of children.entries()) {
				if (index < ignoredUntilIndex) continue;
				ignoredUntilIndex = inspectChildAtIndex(children, index, firstChild);
			}
		}

		return {
			JSXElement(node): void {
				inspectChildren(node.children);
			},
			JSXFragment(node): void {
				inspectChildren(node.children);
			},
		};
	},
	meta: {
		defaultOptions: [],
		docs: {
			description: "Prefer ternary expressions over complementary JSX && branches.",
		},
		fixable: "code",
		messages: {
			preferTernaryConditionalRendering:
				"Use a single ternary expression instead of complementary JSX && branches.",
		},
		schema: [],
		type: "suggestion",
	},
	name: "prefer-ternary-conditional-rendering",
});

export default preferTernaryConditionalRendering;
