import { AST_NODE_TYPES } from "@typescript-eslint/types";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

interface SequenceDescriptor {
	readonly sequenceName: "ColorSequence" | "NumberSequence";
	readonly keypointName: "ColorSequenceKeypoint" | "NumberSequenceKeypoint";
}

interface KeypointData {
	readonly time: number;
	readonly value: TSESTree.Expression;
}

const sequenceDescriptors: ReadonlyArray<SequenceDescriptor> = [
	{ keypointName: "ColorSequenceKeypoint", sequenceName: "ColorSequence" },
	{ keypointName: "NumberSequenceKeypoint", sequenceName: "NumberSequence" },
];

function isSequenceIdentifier(
	node: TSESTree.Expression | TSESTree.Super,
): node is TSESTree.Identifier & { readonly name: SequenceDescriptor["sequenceName"] } {
	return (
		node.type === AST_NODE_TYPES.Identifier &&
		sequenceDescriptors.some((descriptor) => descriptor.sequenceName === node.name)
	);
}

function findDescriptor(sequenceName: SequenceDescriptor["sequenceName"]): SequenceDescriptor | undefined {
	return sequenceDescriptors.find((descriptor) => descriptor.sequenceName === sequenceName);
}

function isNumericLiteral(argument: TSESTree.CallExpressionArgument | undefined): argument is TSESTree.Literal & {
	readonly value: number;
} {
	return argument !== undefined && argument.type === AST_NODE_TYPES.Literal && typeof argument.value === "number";
}

function isExpressionArgument(argument: TSESTree.CallExpressionArgument | undefined): argument is TSESTree.Expression {
	return argument !== undefined && argument.type !== AST_NODE_TYPES.SpreadElement;
}

function extractKeypoint(
	element: TSESTree.Expression | TSESTree.SpreadElement | null,
	descriptor: SequenceDescriptor,
): KeypointData | undefined {
	if (element === null || element.type !== AST_NODE_TYPES.NewExpression) return undefined;
	if (element.callee.type !== AST_NODE_TYPES.Identifier || element.callee.name !== descriptor.keypointName)
		return undefined;

	if (element.arguments.length !== 2) return undefined;

	const [timeArgument, valueArgument] = element.arguments;
	if (!isNumericLiteral(timeArgument)) return undefined;
	if (!isExpressionArgument(valueArgument)) return undefined;

	return {
		time: timeArgument.value,
		value: valueArgument,
	};
}

interface RuleDocsWithRecommended extends TSESLint.RuleMetaDataDocs {
	readonly recommended?: boolean;
}

const docs: RuleDocsWithRecommended = {
	description:
		"Prefer the optimized ColorSequence and NumberSequence constructor overloads over passing ColorSequenceKeypoint or NumberSequenceKeypoint arrays when only using endpoints 0 and 1.",
	recommended: true,
};

const preferSequenceOverloads: TSESLint.RuleModuleWithMetaDocs<
	"preferSingleOverload" | "preferTwoPointOverload",
	[],
	RuleDocsWithRecommended
> = {
	create(context) {
		const { sourceCode } = context;

		return {
			NewExpression(node) {
				const { callee } = node;
				if (!isSequenceIdentifier(callee)) return;

				const descriptor = findDescriptor(callee.name);
				if (descriptor === undefined || node.arguments.length !== 1) return;

				const [argument] = node.arguments;
				if (
					argument === undefined ||
					argument.type !== AST_NODE_TYPES.ArrayExpression ||
					argument.elements.length !== 2
				)
					return;

				const firstElement = argument.elements[0] ?? null;
				const secondElement = argument.elements[1] ?? null;

				const firstKeypoint = extractKeypoint(firstElement, descriptor);
				const secondKeypoint = extractKeypoint(secondElement, descriptor);

				if (firstKeypoint === undefined || secondKeypoint === undefined) return;
				if (firstKeypoint.time !== 0 || secondKeypoint.time !== 1) return;

				const firstValueText = sourceCode.getText(firstKeypoint.value);
				const secondValueText = sourceCode.getText(secondKeypoint.value);
				const normalizedFirstValue = firstValueText.trim();
				const normalizedSecondValue = secondValueText.trim();

				if (normalizedFirstValue === normalizedSecondValue) {
					context.report({
						data: { sequenceName: descriptor.sequenceName },
						fix: (fixer) => fixer.replaceText(node, `new ${descriptor.sequenceName}(${firstValueText})`),
						messageId: "preferSingleOverload",
						node,
					});
					return;
				}

				context.report({
					data: { sequenceName: descriptor.sequenceName },
					fix: (fixer) =>
						fixer.replaceText(
							node,
							`new ${descriptor.sequenceName}(${firstValueText}, ${secondValueText})`,
						),
					messageId: "preferTwoPointOverload",
					node,
				});
			},
		};
	},
	defaultOptions: [],
	meta: {
		docs,
		fixable: "code",
		messages: {
			preferSingleOverload:
				"Use the single-argument {{sequenceName}} constructor overload instead of redundant keypoints when both endpoints share the same value.",
			preferTwoPointOverload:
				"Use the two-argument {{sequenceName}} constructor overload instead of allocating an array of keypoints for endpoints 0 and 1.",
		},
		schema: [],
		type: "problem",
	},
};

export default preferSequenceOverloads;
