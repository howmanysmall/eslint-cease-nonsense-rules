import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { IndexKind } from "typescript";

import { createRule } from "../utilities/create-rule";

import type { TSESTree } from "@typescript-eslint/types";
import type { TSESLint } from "@typescript-eslint/utils";
import type { Type } from "typescript";

type MessageIds = "noEmptyArrayLiteral" | "suggestUseNewArray";

export interface NoEmptyArrayLiteralOptions {
	readonly ignoreInferredNonEmptyLiterals?: boolean;
	readonly inferTypeForEmptyArrayFix?: boolean;
	readonly requireExplicitGenericOnNewArray?: boolean;
}

type Options = [NoEmptyArrayLiteralOptions?];

const DEFAULT_OPTIONS: Required<NoEmptyArrayLiteralOptions> = {
	ignoreInferredNonEmptyLiterals: true,
	inferTypeForEmptyArrayFix: false,
	requireExplicitGenericOnNewArray: true,
};

const RULE_DOCS = {
	description: "Disallow empty array literals and require constructor form for empty arrays.",
	requiresTypeChecking: true,
};

function extractElementTypeFromTypeText(typeText: string): string | undefined {
	if (typeText.startsWith("Array<") && typeText.endsWith(">")) return typeText.slice(6, -1);
	if (typeText.startsWith("ReadonlyArray<") && typeText.endsWith(">")) return typeText.slice(14, -1);
	return undefined;
}

const IS_ANNOTATION = /:\s*(Array<.+>|ReadonlyArray<.+>)\s*=/u;

function extractElementTypeFromAssignmentPatternText(assignmentText: string): string | undefined {
	const annotationMatch = IS_ANNOTATION.exec(assignmentText);
	if (!annotationMatch) return undefined;

	const [, typeText] = annotationMatch;
	if (!typeText) return undefined;

	return extractElementTypeFromTypeText(typeText.trim());
}

function extractElementTypeFromGenericReference(
	typeNode: TSESTree.TypeNode,
	sourceCode: Readonly<TSESLint.SourceCode>,
): string | undefined {
	if (typeNode.type !== AST_NODE_TYPES.TSTypeReference) return undefined;
	if (typeNode.typeName.type !== AST_NODE_TYPES.Identifier) return undefined;
	if (typeNode.typeName.name !== "Array" && typeNode.typeName.name !== "ReadonlyArray") return undefined;
	if (!typeNode.typeArguments || typeNode.typeArguments.params.length !== 1) return undefined;

	const [elementType] = typeNode.typeArguments.params;
	if (!elementType) return undefined;
	return sourceCode.getText(elementType);
}

function getBindingTypeAnnotation(bindingName: TSESTree.BindingName): TSESTree.TSTypeAnnotation | undefined {
	if (bindingName.type === AST_NODE_TYPES.Identifier) return bindingName.typeAnnotation;
	if (bindingName.type === AST_NODE_TYPES.ArrayPattern) return bindingName.typeAnnotation;
	if (bindingName.type === AST_NODE_TYPES.ObjectPattern) return bindingName.typeAnnotation;
	return undefined;
}

function getExplicitElementTypeFromContext(
	node: TSESTree.ArrayExpression,
	sourceCode: Readonly<TSESLint.SourceCode>,
): string | undefined {
	const { parent } = node;
	if (!parent) return undefined;

	if (parent.type === AST_NODE_TYPES.VariableDeclarator && parent.init === node) {
		const typeAnnotation = getBindingTypeAnnotation(parent.id);
		return typeAnnotation
			? extractElementTypeFromGenericReference(typeAnnotation.typeAnnotation, sourceCode)
			: undefined;
	}

	if (parent.type === AST_NODE_TYPES.AssignmentPattern && parent.right === node) {
		return extractElementTypeFromAssignmentPatternText(sourceCode.getText(parent));
	}

	if (parent.type === AST_NODE_TYPES.PropertyDefinition && parent.value === node && parent.typeAnnotation) {
		return extractElementTypeFromGenericReference(parent.typeAnnotation.typeAnnotation, sourceCode);
	}

	if (parent.type === AST_NODE_TYPES.TSAsExpression && parent.expression === node) {
		return extractElementTypeFromGenericReference(parent.typeAnnotation, sourceCode);
	}

	if (parent.type === AST_NODE_TYPES.TSTypeAssertion && parent.expression === node) {
		return extractElementTypeFromGenericReference(parent.typeAnnotation, sourceCode);
	}

	return undefined;
}

function getElementTypeFromTypeChecker(
	node: TSESTree.ArrayExpression,
	context: Readonly<TSESLint.RuleContext<MessageIds, Options>>,
): string | undefined {
	const { parserServices } = context.sourceCode;
	if (!(parserServices && "program" in parserServices && parserServices.program)) return undefined;
	if (!("esTreeNodeToTSNodeMap" in parserServices)) return undefined;

	const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);
	const checker = parserServices.program.getTypeChecker();

	function toElementTypeText(candidateType: Type): string | undefined {
		const elementType = checker.getIndexTypeOfType(candidateType, IndexKind.Number);
		return elementType ? checker.typeToString(elementType, tsNode) : undefined;
	}

	const contextualType = checker.getContextualType(tsNode);
	if (contextualType) {
		const contextualElement = toElementTypeText(contextualType);
		if (contextualElement) return contextualElement;
	}

	const fallbackType = checker.getTypeAtLocation(tsNode);
	return toElementTypeText(fallbackType);
}

function createReplacementText(
	elementType: string | undefined,
	options: Readonly<Required<NoEmptyArrayLiteralOptions>>,
): string {
	if (options.requireExplicitGenericOnNewArray && elementType) return `new Array<${elementType}>()`;
	return "new Array()";
}

export default createRule<Options, MessageIds>({
	create(context) {
		const options: Required<NoEmptyArrayLiteralOptions> = {
			...DEFAULT_OPTIONS,
			...context.options[0],
		};
		const { sourceCode } = context;

		return {
			ArrayExpression(node): void {
				if (node.elements.length > 0) return;

				const explicitElementType = getExplicitElementTypeFromContext(node, sourceCode);
				const inferredElementType = options.inferTypeForEmptyArrayFix
					? getElementTypeFromTypeChecker(node, context)
					: undefined;
				const resolvedElementType = explicitElementType ?? inferredElementType;

				const hasAutoFix =
					explicitElementType !== undefined ||
					(options.inferTypeForEmptyArrayFix && inferredElementType !== undefined);

				const replacementText = createReplacementText(resolvedElementType, options);

				if (hasAutoFix) {
					context.report({
						fix: (fixer) => fixer.replaceText(node, replacementText),
						messageId: "noEmptyArrayLiteral",
						node,
					});
					return;
				}

				context.report({
					messageId: "noEmptyArrayLiteral",
					node,
					suggest: [
						{
							fix: (fixer): TSESLint.RuleFix => fixer.replaceText(node, "new Array()"),
							messageId: "suggestUseNewArray",
						},
					],
				});
			},
		};
	},
	defaultOptions: [DEFAULT_OPTIONS],
	meta: {
		docs: RULE_DOCS,
		fixable: "code",
		hasSuggestions: true,
		messages: {
			noEmptyArrayLiteral: "Empty array literals are not allowed. Use new Array<T>() or new Array() instead.",
			suggestUseNewArray: "Replace [] with new Array().",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					ignoreInferredNonEmptyLiterals: {
						default: true,
						description:
							"When false this option is accepted but intentionally does not change behavior. Non-empty literals remain allowed.",
						type: "boolean",
					},
					inferTypeForEmptyArrayFix: {
						default: false,
						description:
							"When true, uses TypeScript parser services to infer a contextual element type for empty array fixes.",
						type: "boolean",
					},
					requireExplicitGenericOnNewArray: {
						default: true,
						description:
							"When true, auto-fixes include explicit generic type arguments when an element type is known.",
						type: "boolean",
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
	name: "no-empty-array-literal",
});
