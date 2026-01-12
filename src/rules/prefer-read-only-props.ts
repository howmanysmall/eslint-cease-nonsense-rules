import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utilities/create-rule";

type MessageIds = "readOnlyProp";

type Options = [];

function isFunctionLike(
	node: TSESTree.Node,
): node is TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression {
	return (
		node.type === AST_NODE_TYPES.FunctionDeclaration ||
		node.type === AST_NODE_TYPES.FunctionExpression ||
		node.type === AST_NODE_TYPES.ArrowFunctionExpression
	);
}

function isReactComponentType(node: TSESTree.Node): boolean {
	if (isFunctionLike(node)) return true;

	if (node.type === AST_NODE_TYPES.VariableDeclarator) {
		const { init } = node;
		if (init?.type === AST_NODE_TYPES.FunctionExpression || init?.type === AST_NODE_TYPES.ArrowFunctionExpression) {
			return true;
		}
	}

	return false;
}

function isReadonly(node: TSESTree.TSPropertySignature): boolean {
	return node.readonly;
}

function getTypeFromIdentifierParam(
	parameter: TSESTree.Identifier,
): TSESTree.TSTypeLiteral | TSESTree.TSTypeReference | undefined {
	const typeAnnotation = parameter.typeAnnotation?.typeAnnotation;
	if (typeAnnotation === undefined) return undefined;

	return typeAnnotation.type === AST_NODE_TYPES.TSTypeLiteral ||
		typeAnnotation.type === AST_NODE_TYPES.TSTypeReference
		? typeAnnotation
		: undefined;
}

function findPropertiesType(node: TSESTree.Node): TSESTree.TSTypeLiteral | TSESTree.TSTypeReference | undefined {
	if (!isFunctionLike(node)) return undefined;

	for (const parameter of node.params) {
		if (parameter.type === AST_NODE_TYPES.Identifier) {
			const propertiesType = getTypeFromIdentifierParam(parameter);
			if (propertiesType !== undefined) return propertiesType;
		}
	}

	return undefined;
}

function getPropertiesFromType(
	type: TSESTree.TSTypeLiteral | TSESTree.TSTypeReference,
): ReadonlyArray<TSESTree.TSPropertySignature> {
	if (type.type === AST_NODE_TYPES.TSTypeLiteral) {
		return type.members.filter(
			(member): member is TSESTree.TSPropertySignature => member.type === AST_NODE_TYPES.TSPropertySignature,
		);
	}

	return [];
}

export default createRule<Options, MessageIds>({
	create(context) {
		const componentCache = new WeakSet<TSESTree.Node>();

		return {
			ArrowFunctionExpression(node): void {
				if (!isReactComponentType(node) || componentCache.has(node)) return;

				const propertiesType = findPropertiesType(node);
				if (propertiesType === undefined) return;

				const properties = getPropertiesFromType(propertiesType);
				for (const property of properties) {
					if (isReadonly(property)) continue;

					const { key } = property;
					const propertyName = key.type === AST_NODE_TYPES.Identifier ? key.name : "unknown";

					context.report({
						data: { name: propertyName },
						fix(fixer) {
							return fixer.insertTextBefore(property, "readonly ");
						},
						messageId: "readOnlyProp",
						node: property,
					});
				}

				componentCache.add(node);
			},
			FunctionDeclaration(node): void {
				if (!isReactComponentType(node) || componentCache.has(node)) return;

				const propertiesType = findPropertiesType(node);
				if (propertiesType === undefined) return;

				const properties = getPropertiesFromType(propertiesType);
				for (const property of properties) {
					if (isReadonly(property)) continue;

					const { key } = property;
					const propertyName = key.type === AST_NODE_TYPES.Identifier ? key.name : "unknown";

					context.report({
						data: { name: propertyName },
						fix(fixer) {
							return fixer.insertTextBefore(property, "readonly ");
						},
						messageId: "readOnlyProp",
						node: property,
					});
				}

				componentCache.add(node);
			},

			FunctionExpression(node): void {
				if (!isReactComponentType(node) || componentCache.has(node)) return;

				const propertiesType = findPropertiesType(node);
				if (propertiesType === undefined) return;

				const properties = getPropertiesFromType(propertiesType);
				for (const property of properties) {
					if (isReadonly(property)) continue;

					const { key } = property;
					const propertyName = key.type === AST_NODE_TYPES.Identifier ? key.name : "unknown";

					context.report({
						data: { name: propertyName },
						fix(fixer) {
							return fixer.insertTextBefore(property, "readonly ");
						},
						messageId: "readOnlyProp",
						node: property,
					});
				}

				componentCache.add(node);
			},
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description: "Enforce that props are read-only",
		},
		fixable: "code",
		messages: {
			readOnlyProp: "Prop '{{name}}' should be read-only.",
		},
		schema: [],
		type: "suggestion",
	},
	name: "prefer-read-only-props",
});
