import { AST_NODE_TYPES } from "@typescript-eslint/utils";

import { createRule } from "../utilities/create-rule";

import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

type MessageIds = "useGenericArrayType";
type Options = [];

function toGenericArrayType(typeNode: TSESTree.TypeNode, sourceCode: TSESLint.SourceCode): string {
	if (typeNode.type === AST_NODE_TYPES.TSArrayType) {
		const elementText = toGenericArrayType(typeNode.elementType, sourceCode);
		return `Array<${elementText}>`;
	}

	if (
		typeNode.type === AST_NODE_TYPES.TSTypeOperator &&
		typeNode.operator === "readonly" &&
		typeNode.typeAnnotation !== undefined &&
		typeNode.typeAnnotation.type === AST_NODE_TYPES.TSArrayType
	) {
		const elementText = toGenericArrayType(typeNode.typeAnnotation.elementType, sourceCode);
		return `ReadonlyArray<${elementText}>`;
	}

	return sourceCode.getText(typeNode);
}

function isTopLevelArrayType(node: TSESTree.TypeNode): boolean {
	const { parent } = node;
	if (parent?.type === AST_NODE_TYPES.TSArrayType) return false;
	if (parent?.type === AST_NODE_TYPES.TSTypeOperator && parent.operator === "readonly") return false;
	return true;
}

export default createRule<Options, MessageIds>({
	create(context) {
		const { sourceCode } = context;

		function report(node: TSESTree.TSArrayType | TSESTree.TSTypeOperator): void {
			context.report({
				fix: (fixer) => fixer.replaceText(node, toGenericArrayType(node, sourceCode)),
				messageId: "useGenericArrayType",
				node,
			});
		}

		return {
			TSArrayType(node): void {
				if (!isTopLevelArrayType(node)) return;
				report(node);
			},
			TSTypeOperator(node): void {
				if (node.operator !== "readonly") return;
				if (node.typeAnnotation === undefined) return;
				if (node.typeAnnotation.type !== AST_NODE_TYPES.TSArrayType) return;
				if (!isTopLevelArrayType(node)) return;
				report(node);
			},
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description: "Disallow bracket array type syntax and require Array<T> / ReadonlyArray<T>.",
		},
		fixable: "code",
		messages: {
			useGenericArrayType:
				"Bracket array type syntax is not allowed. Use Array<T> or ReadonlyArray<T> generic syntax.",
		},
		schema: [],
		type: "problem",
	},
	name: "array-type-generic",
});
