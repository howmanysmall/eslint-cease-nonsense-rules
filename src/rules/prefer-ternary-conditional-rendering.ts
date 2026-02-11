import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utilities/create-rule";

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

function unwrapExpression(expression: TSESTree.Expression): TSESTree.Expression {
	let current = expression;

	while (true) {
		switch (current.type) {
			case AST_NODE_TYPES.ChainExpression:
				current = current.expression;
				continue;
			case AST_NODE_TYPES.TSAsExpression:
			case AST_NODE_TYPES.TSInstantiationExpression:
			case AST_NODE_TYPES.TSNonNullExpression:
			case AST_NODE_TYPES.TSSatisfiesExpression:
			case AST_NODE_TYPES.TSTypeAssertion:
				current = current.expression;
				continue;
			default:
				return current;
		}
	}
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

function areEquivalentArgument(
	left: CallArgument,
	right: CallArgument,
	sourceCode: SourceCode,
): boolean {
	if (left.type === AST_NODE_TYPES.SpreadElement || right.type === AST_NODE_TYPES.SpreadElement) {
		if (left.type !== AST_NODE_TYPES.SpreadElement || right.type !== AST_NODE_TYPES.SpreadElement) return false;
		return areEquivalentExpression(left.argument, right.argument, sourceCode);
	}

	return areEquivalentExpression(left, right, sourceCode);
}

function areEquivalentOperand(
	left: BinaryOperand,
	right: BinaryOperand,
	sourceCode: SourceCode,
): boolean {
	if (left.type === AST_NODE_TYPES.PrivateIdentifier || right.type === AST_NODE_TYPES.PrivateIdentifier) {
		return (
			left.type === AST_NODE_TYPES.PrivateIdentifier &&
			right.type === AST_NODE_TYPES.PrivateIdentifier &&
			left.name === right.name
		);
	}

	return areEquivalentExpression(left, right, sourceCode);
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

		case AST_NODE_TYPES.UnaryExpression:
			return (
				normalizedRight.type === AST_NODE_TYPES.UnaryExpression &&
				normalizedLeft.operator === normalizedRight.operator &&
				areEquivalentExpression(normalizedLeft.argument, normalizedRight.argument, sourceCode)
			);

		case AST_NODE_TYPES.BinaryExpression:
			return (
				normalizedRight.type === AST_NODE_TYPES.BinaryExpression &&
				normalizedLeft.operator === normalizedRight.operator &&
				areEquivalentOperand(normalizedLeft.left, normalizedRight.left, sourceCode) &&
				areEquivalentOperand(normalizedLeft.right, normalizedRight.right, sourceCode)
			);

		case AST_NODE_TYPES.LogicalExpression:
			return (
				normalizedRight.type === AST_NODE_TYPES.LogicalExpression &&
				normalizedLeft.operator === normalizedRight.operator &&
				areEquivalentExpression(normalizedLeft.left, normalizedRight.left, sourceCode) &&
				areEquivalentExpression(normalizedLeft.right, normalizedRight.right, sourceCode)
			);

		case AST_NODE_TYPES.MemberExpression:
			if (normalizedRight.type !== AST_NODE_TYPES.MemberExpression) return false;
			if (normalizedLeft.computed !== normalizedRight.computed || normalizedLeft.optional !== normalizedRight.optional) {
				return false;
			}
			if (!areEquivalentExpressionOrSuper(normalizedLeft.object, normalizedRight.object, sourceCode)) return false;

			if (normalizedLeft.computed) {
				return areEquivalentOperand(normalizedLeft.property, normalizedRight.property, sourceCode);
			}

			if (
				normalizedLeft.property.type === AST_NODE_TYPES.Identifier &&
				normalizedRight.property.type === AST_NODE_TYPES.Identifier
			) {
				return normalizedLeft.property.name === normalizedRight.property.name;
			}

			return (
				normalizedLeft.property.type === AST_NODE_TYPES.PrivateIdentifier &&
				normalizedRight.property.type === AST_NODE_TYPES.PrivateIdentifier &&
				normalizedLeft.property.name === normalizedRight.property.name
			);

		case AST_NODE_TYPES.CallExpression:
			if (normalizedRight.type !== AST_NODE_TYPES.CallExpression) return false;
			if (normalizedLeft.optional !== normalizedRight.optional) return false;
			if (!areEquivalentExpressionOrSuper(normalizedLeft.callee, normalizedRight.callee, sourceCode)) return false;
			if (normalizedLeft.arguments.length !== normalizedRight.arguments.length) return false;

			for (let index = 0; index < normalizedLeft.arguments.length; index += 1) {
				const leftArgument = normalizedLeft.arguments[index];
				const rightArgument = normalizedRight.arguments[index];
				if (!(leftArgument && rightArgument)) return false;
				if (!areEquivalentArgument(leftArgument, rightArgument, sourceCode)) return false;
			}

			return true;

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

export default createRule<Options, MessageIds>({
	create(context) {
		const { sourceCode } = context;

		function inspectChildren(children: ReadonlyArray<TSESTree.JSXChild>): void {
			for (let index = 0; index < children.length; index += 1) {
				const firstChild = children[index];
				if (!firstChild) continue;

				const firstBranch = getBranchCandidate(firstChild);
				if (!firstBranch) continue;

				let nextIndex = index + 1;
				while (nextIndex < children.length) {
					const whitespaceCandidate = children[nextIndex];
					if (!(whitespaceCandidate && isWhitespaceText(whitespaceCandidate))) break;
					nextIndex += 1;
				}

				if (nextIndex >= children.length) continue;

				const secondChild = children[nextIndex];
				if (!secondChild) continue;

				const secondBranch = getBranchCandidate(secondChild);
				if (!secondBranch) continue;

				const complement = getComplementMatch(firstBranch.condition, secondBranch.condition, sourceCode);
				if (!complement) continue;

				if (complement.isFixSafe) {
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
				} else {
					context.report({
						messageId: "preferTernaryConditionalRendering",
						node: firstBranch.logical,
					});
				}

				index = nextIndex;
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
	defaultOptions: [],
	meta: {
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
