import { isPascalCase } from "$utilities/casing-utilities";
import { createRule } from "$utilities/create-rule";
import { isNonEmptyString } from "$utilities/type-utilities";
import { AST_NODE_TYPES } from "@typescript-eslint/types";
import { regex } from "arktype";

import type { TSESTree } from "@typescript-eslint/types";

type MessageIds = "noRenderHelper";

const REACT_NODE_TYPE_NAMES = new Set(["ReactNode", "ReactElement", "JSXElement"]);

const HOOK_PATTERN = regex("^use[A-Z]", "u");

function isHookName(name: string): boolean {
	return HOOK_PATTERN.test(name);
}

function isNode(value: unknown): value is TSESTree.Node {
	return typeof value === "object" && value !== null && "type" in value;
}

function collectNodes(nodes: ReadonlyArray<unknown>): ReadonlyArray<TSESTree.Node> {
	const children = new Array<TSESTree.Node>();
	for (const node of nodes) {
		if (isNode(node)) children.push(node);
	}
	return children;
}

function isReactNodeTypeAnnotation(node: TSESTree.TypeNode | undefined): boolean {
	if (node === undefined) return false;

	if (node.type === AST_NODE_TYPES.TSTypeReference) {
		const { typeName } = node;
		let typeReferenceName = "";
		if ("right" in typeName) typeReferenceName = typeName.right.name;
		if ("name" in typeName) typeReferenceName = typeName.name;
		return REACT_NODE_TYPE_NAMES.has(typeReferenceName);
	}

	return false;
}

function getTraversableChildren(current: TSESTree.Node): ReadonlyArray<TSESTree.Node> {
	switch (current.type) {
		case AST_NODE_TYPES.BlockStatement:
		case AST_NODE_TYPES.Program:
			return current.body;

		case AST_NODE_TYPES.ReturnStatement:
			return current.argument === null ? [] : [current.argument];

		case AST_NODE_TYPES.IfStatement: {
			return current.alternate === null
				? [current.test, current.consequent]
				: [current.test, current.consequent, current.alternate];
		}

		case AST_NODE_TYPES.SwitchStatement:
			return [current.discriminant, ...current.cases];

		case AST_NODE_TYPES.SwitchCase:
			return current.test === null ? current.consequent : [current.test, ...current.consequent];

		case AST_NODE_TYPES.ExpressionStatement:
			return [current.expression];

		case AST_NODE_TYPES.VariableDeclaration:
			return current.declarations;

		case AST_NODE_TYPES.VariableDeclarator:
			return current.init === null ? [current.id] : [current.id, current.init];

		case AST_NODE_TYPES.CallExpression:
		case AST_NODE_TYPES.NewExpression:
			return [current.callee, ...collectNodes(current.arguments)];

		case AST_NODE_TYPES.ConditionalExpression:
			return [current.test, current.consequent, current.alternate];

		case AST_NODE_TYPES.LogicalExpression:
		case AST_NODE_TYPES.BinaryExpression:
		case AST_NODE_TYPES.AssignmentExpression:
			return [current.left, current.right];

		case AST_NODE_TYPES.MemberExpression:
			return [current.object, current.property];

		case AST_NODE_TYPES.ArrayExpression:
			return collectNodes(current.elements);

		case AST_NODE_TYPES.ObjectExpression:
			return current.properties;

		case AST_NODE_TYPES.Property:
			return [current.key, current.value];

		case AST_NODE_TYPES.UnaryExpression:
		case AST_NODE_TYPES.UpdateExpression:
		case AST_NODE_TYPES.AwaitExpression:
			return [current.argument];

		case AST_NODE_TYPES.ChainExpression:
			return [current.expression];

		case AST_NODE_TYPES.TSAsExpression:
		case AST_NODE_TYPES.TSNonNullExpression:
		case AST_NODE_TYPES.TSTypeAssertion:
			return [current.expression];

		default:
			return [];
	}
}

function hasJSXReturn(
	node: TSESTree.FunctionDeclaration | TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression,
): boolean {
	let foundJSX = false;

	function checkNode(current: TSESTree.Node): void {
		if (current.type === AST_NODE_TYPES.ReturnStatement) {
			const { argument } = current;
			if (argument?.type === AST_NODE_TYPES.JSXElement || argument?.type === AST_NODE_TYPES.JSXFragment) {
				foundJSX = true;
				return;
			}
		}

		for (const child of getTraversableChildren(current)) {
			checkNode(child);
			if (foundJSX) return;
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

function isInlineCallback(parent: TSESTree.Node): boolean {
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

				if (isNonEmptyString(functionName) && isPascalCase(functionName)) componentDepth += 1;
			},
			"ArrowFunctionExpression:exit"(node: TSESTree.ArrowFunctionExpression): void {
				const { parent } = node;
				const isVariableDeclarator = parent?.type === AST_NODE_TYPES.VariableDeclarator;
				const functionName =
					isVariableDeclarator && parent.id.type === AST_NODE_TYPES.Identifier ? parent.id.name : undefined;

				if (isNonEmptyString(functionName) && isPascalCase(functionName)) {
					componentDepth -= 1;
					return;
				}

				if (componentDepth > 0) return;
				if (parent !== undefined && isInlineCallback(parent)) return;

				if (parent?.type !== AST_NODE_TYPES.VariableDeclarator) return;
				if (parent.id.type !== AST_NODE_TYPES.Identifier) return;

				const variableName = parent.id.name;
				if (isHookName(variableName)) return;

				const hasReactNodeAnnotation = parent.id.typeAnnotation
					? isReactNodeTypeAnnotation(parent.id.typeAnnotation.typeAnnotation)
					: false;

				const returnTypeAnnotation = node.returnType?.typeAnnotation;
				const hasReturnTypeAnnotation = isReactNodeTypeAnnotation(returnTypeAnnotation);

				if (hasReactNodeAnnotation || hasReturnTypeAnnotation || hasJSXReturn(node)) {
					context.report({
						data: { functionName: variableName },
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

				if (isNonEmptyString(functionName) && isPascalCase(functionName)) componentDepth += 1;
			},
			"FunctionExpression:exit"(node: TSESTree.FunctionExpression): void {
				const { parent } = node;
				const isVariableDeclarator = parent?.type === AST_NODE_TYPES.VariableDeclarator;
				const functionName =
					isVariableDeclarator && parent.id.type === AST_NODE_TYPES.Identifier ? parent.id.name : undefined;

				if (isNonEmptyString(functionName) && isPascalCase(functionName)) {
					componentDepth -= 1;
					return;
				}

				if (componentDepth > 0) return;
				if (parent !== undefined && isInlineCallback(parent)) return;

				if (parent?.type !== AST_NODE_TYPES.VariableDeclarator) return;
				if (parent.id.type !== AST_NODE_TYPES.Identifier) return;

				const variableName = parent.id.name;
				if (isHookName(variableName)) return;

				const hasReactNodeAnnotation = parent.id.typeAnnotation
					? isReactNodeTypeAnnotation(parent.id.typeAnnotation.typeAnnotation)
					: false;

				const returnTypeAnnotation = node.returnType?.typeAnnotation;
				const hasReturnTypeAnnotation = isReactNodeTypeAnnotation(returnTypeAnnotation);

				if (hasReactNodeAnnotation || hasReturnTypeAnnotation || hasJSXReturn(node)) {
					context.report({
						data: { functionName: variableName },
						messageId: "noRenderHelper",
						node: parent,
					});
				}
			},
		};
	},
	meta: {
		defaultOptions: [],
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
