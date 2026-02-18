import type { TSESTree } from "@typescript-eslint/types";
import { AST_NODE_TYPES } from "@typescript-eslint/types";
import { regex } from "arktype";
import { createRule } from "../utilities/create-rule";

type MessageIds = "noRenderHelper";

const REACT_NODE_TYPE_NAMES = new Set(["ReactNode", "ReactElement", "JSXElement"]);

const HOOK_PATTERN = regex("^use[A-Z]");

function isPascalCase(name: string): boolean {
	if (name.length === 0) return false;
	const firstCharacter = name.charAt(0);
	return firstCharacter === firstCharacter.toUpperCase();
}

function isHookName(name: string): boolean {
	return HOOK_PATTERN.test(name);
}

function isReactNodeTypeAnnotation(node: TSESTree.TypeNode | undefined): boolean {
	if (!node) return false;

	if (node.type === AST_NODE_TYPES.TSTypeReference) {
		const { typeName } = node;
		if (typeName.type === AST_NODE_TYPES.Identifier) return REACT_NODE_TYPE_NAMES.has(typeName.name);
		if (typeName.type === AST_NODE_TYPES.TSQualifiedName) return REACT_NODE_TYPE_NAMES.has(typeName.right.name);
	}

	return false;
}

function hasJSXReturn(
	node: TSESTree.FunctionDeclaration | TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression,
): boolean {
	let foundJSX = false;

	function checkNode(current: TSESTree.Node): void {
		if (foundJSX) return;

		if (current.type === AST_NODE_TYPES.ReturnStatement) {
			const { argument } = current;
			if (argument?.type === AST_NODE_TYPES.JSXElement || argument?.type === AST_NODE_TYPES.JSXFragment) {
				foundJSX = true;
				return;
			}
		}

		const validKeys = [
			"body",
			"consequent",
			"alternate",
			"cases",
			"block",
			"expression",
			"argument",
			"elements",
			"properties",
			"value",
			"init",
			"test",
			"update",
			"declarations",
			"declaration",
		];

		for (const key of validKeys) {
			if (!(key in current)) continue;

			const child = current[key as keyof typeof current];
			if (!child) continue;

			if (Array.isArray(child)) {
				for (const item of child) {
					if (item && typeof item === "object" && "type" in item) checkNode(item as TSESTree.Node);
					if (foundJSX) return;
				}
			} else if (typeof child === "object" && "type" in child) checkNode(child as TSESTree.Node);
		}
	}

	if (
		node.type === AST_NODE_TYPES.ArrowFunctionExpression &&
		(node.body.type === AST_NODE_TYPES.JSXElement || node.body.type === AST_NODE_TYPES.JSXFragment)
	) {
		return true;
	}

	checkNode(node.body);
	return foundJSX;
}

function isInlineCallback(node: TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression): boolean {
	const { parent } = node;
	if (!parent) return false;

	if (parent.type === AST_NODE_TYPES.CallExpression) return true;
	if (parent.type === AST_NODE_TYPES.JSXExpressionContainer) return true;
	if (parent.type === AST_NODE_TYPES.ArrayExpression) return true;

	return false;
}

const noRenderHelperFunctions = createRule<[], MessageIds>({
	create(context) {
		let componentDepth = 0;

		return {
			ArrowFunctionExpression(node: TSESTree.ArrowFunctionExpression): void {
				const { parent } = node;
				const isVariableDeclarator = parent?.type === AST_NODE_TYPES.VariableDeclarator;
				const functionName =
					isVariableDeclarator && parent.id.type === AST_NODE_TYPES.Identifier ? parent.id.name : undefined;

				if (functionName && isPascalCase(functionName)) componentDepth += 1;
			},
			"ArrowFunctionExpression:exit"(node: TSESTree.ArrowFunctionExpression): void {
				const { parent } = node;
				const isVariableDeclarator = parent?.type === AST_NODE_TYPES.VariableDeclarator;
				const functionName =
					isVariableDeclarator && parent.id.type === AST_NODE_TYPES.Identifier ? parent.id.name : undefined;

				if (functionName && isPascalCase(functionName)) {
					componentDepth -= 1;
					return;
				}

				if (componentDepth > 0) return;
				if (isInlineCallback(node)) return;

				if (parent?.type !== AST_NODE_TYPES.VariableDeclarator) return;
				if (parent.id.type !== AST_NODE_TYPES.Identifier) return;

				const varName = parent.id.name;
				if (isPascalCase(varName)) return;
				if (isHookName(varName)) return;

				const hasReactNodeAnnotation = parent.id.typeAnnotation
					? isReactNodeTypeAnnotation(parent.id.typeAnnotation.typeAnnotation)
					: false;

				const returnTypeAnnotation = node.returnType?.typeAnnotation;
				const hasReturnTypeAnnotation = isReactNodeTypeAnnotation(returnTypeAnnotation);

				if (hasReactNodeAnnotation || hasReturnTypeAnnotation || hasJSXReturn(node)) {
					context.report({
						data: { functionName: varName },
						messageId: "noRenderHelper",
						node: parent,
					});
				}
			},
			FunctionDeclaration(node: TSESTree.FunctionDeclaration): void {
				if (!node.id) return;

				const functionName = node.id.name;
				if (isPascalCase(functionName)) componentDepth += 1;
			},
			"FunctionDeclaration:exit"(node: TSESTree.FunctionDeclaration): void {
				if (!node.id) return;

				const functionName = node.id.name;
				if (isPascalCase(functionName)) {
					componentDepth -= 1;
					return;
				}

				if (componentDepth > 0) return;
				if (isHookName(functionName)) return;

				const returnTypeAnnotation = node.returnType?.typeAnnotation;
				const hasReturnTypeAnnotation = isReactNodeTypeAnnotation(returnTypeAnnotation);

				if (hasReturnTypeAnnotation || hasJSXReturn(node)) {
					context.report({
						data: { functionName },
						messageId: "noRenderHelper",
						node,
					});
				}
			},
			FunctionExpression(node: TSESTree.FunctionExpression): void {
				const { parent } = node;
				const isVariableDeclarator = parent?.type === AST_NODE_TYPES.VariableDeclarator;
				const functionName =
					isVariableDeclarator && parent.id.type === AST_NODE_TYPES.Identifier ? parent.id.name : undefined;

				if (functionName && isPascalCase(functionName)) componentDepth += 1;
			},
			"FunctionExpression:exit"(node: TSESTree.FunctionExpression): void {
				const { parent } = node;
				const isVariableDeclarator = parent?.type === AST_NODE_TYPES.VariableDeclarator;
				const functionName =
					isVariableDeclarator && parent.id.type === AST_NODE_TYPES.Identifier ? parent.id.name : undefined;

				if (functionName && isPascalCase(functionName)) {
					componentDepth -= 1;
					return;
				}

				if (componentDepth > 0) return;
				if (isInlineCallback(node)) return;

				if (parent?.type !== AST_NODE_TYPES.VariableDeclarator) return;
				if (parent.id.type !== AST_NODE_TYPES.Identifier) return;

				const varName = parent.id.name;
				if (isPascalCase(varName)) return;
				if (isHookName(varName)) return;

				const hasReactNodeAnnotation = parent.id.typeAnnotation
					? isReactNodeTypeAnnotation(parent.id.typeAnnotation.typeAnnotation)
					: false;

				const returnTypeAnnotation = node.returnType?.typeAnnotation;
				const hasReturnTypeAnnotation = isReactNodeTypeAnnotation(returnTypeAnnotation);

				if (hasReactNodeAnnotation || hasReturnTypeAnnotation || hasJSXReturn(node)) {
					context.report({
						data: { functionName: varName },
						messageId: "noRenderHelper",
						node: parent,
					});
				}
			},
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description: "Disallow non-component functions that return JSX or React elements.",
		},
		messages: {
			noRenderHelper:
				"Convert render helper '{{functionName}}' to a React component. Functions that return JSX should be PascalCase components, not camelCase helpers.",
		},
		schema: [],
		type: "suggestion",
	},
	name: "no-render-helper-functions",
});

export default noRenderHelperFunctions;
