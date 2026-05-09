import { isRecord } from "./type-utilities";

import type { CallbackFunction } from "@plugin-types/missing-types";
import type { ESTree, FixFunction } from "oxlint-plugin-utilities";

export type FixReturn = ReturnType<FixFunction>;

export type KeyOfNode = "end" | "loc" | "parent" | "range" | "start" | "type";
const KEY_OF_NODE: ReadonlySet<string> = new Set([
	"end",
	"loc",
	"parent",
	"range",
	"start",
	"type",
] as ReadonlyArray<KeyOfNode>);

export function isNode(value: unknown): value is ESTree.Node {
	return isRecord(value) && typeof value.type === "string";
}

export function isKeyOfNode(key: string): key is KeyOfNode {
	return KEY_OF_NODE.has(key);
}

export function isVariableDeclarator(node: ESTree.Node): node is ESTree.VariableDeclarator {
	return node.type === "VariableDeclarator";
}

export function isNumericLiteral(node: ESTree.Node): node is ESTree.NumericLiteral {
	return node.type === "Literal" && typeof node.value === "number";
}

export function isCallExpression(node: ESTree.Node): node is ESTree.CallExpression {
	return node.type === "CallExpression";
}

export function isMemberExpression(node: ESTree.Node): node is ESTree.MemberExpression {
	return node.type === "MemberExpression";
}

export function isUnaryExpression(node: ESTree.Node): node is ESTree.UnaryExpression {
	return node.type === "UnaryExpression";
}

export function isFunctionNode(node: ESTree.Node): node is CallbackFunction {
	return isFunctionDeclarationNode(node) || isArrowFunctionExpression(node);
}

export function isBinaryExpression(node: ESTree.Node): node is ESTree.BinaryExpression {
	return node.type === "BinaryExpression";
}

export function isLogicalExpression(node: ESTree.Node): node is ESTree.LogicalExpression {
	return node.type === "LogicalExpression";
}

export function isConditionalExpression(node: ESTree.Node): node is ESTree.ConditionalExpression {
	return node.type === "ConditionalExpression";
}

export function isSequenceExpression(node: ESTree.Node): node is ESTree.SequenceExpression {
	return node.type === "SequenceExpression";
}

export function isPropertyDefinitionNode(node: ESTree.Node): node is ESTree.PropertyDefinition {
	return node.type === "PropertyDefinition" || node.type === "TSAbstractPropertyDefinition";
}

export function isVariableDeclarationNode(node: ESTree.Node): node is ESTree.VariableDeclaration {
	return node.type === "VariableDeclaration";
}

export function isFunctionDeclarationNode(node: ESTree.Node): node is ESTree.Function {
	return node.type === "FunctionDeclaration" || node.type === "FunctionExpression";
}

export function isClassNode(node: ESTree.Node): node is ESTree.Class {
	return node.type === "ClassDeclaration" || node.type === "ClassExpression";
}

export function isLiteralNode(node: ESTree.Node): node is ESTree.TSLiteral {
	return node.type === "Literal";
}

export function isArrowFunctionExpression(node: ESTree.Node): node is ESTree.ArrowFunctionExpression {
	return node.type === "ArrowFunctionExpression";
}

export function isNewExpression(node: ESTree.Node): node is ESTree.NewExpression {
	return node.type === "NewExpression";
}

export function isArrayExpression(node: ESTree.Node): node is ESTree.ArrayExpression {
	return node.type === "ArrayExpression";
}

export function isObjectExpression(node: ESTree.Node): node is ESTree.ObjectExpression {
	return node.type === "ObjectExpression";
}

export function isTemplateLiteral(node: ESTree.Node): node is ESTree.TemplateLiteral {
	return node.type === "TemplateLiteral";
}

export function isExpressionStatement(node: ESTree.Node): node is ESTree.ExpressionStatement {
	return node.type === "ExpressionStatement";
}

export function isTsTypeAssertion(node: ESTree.Node): node is ESTree.TSTypeAssertion {
	return node.type === "TSTypeAssertion";
}

export function isTsAsExpression(node: ESTree.Node): node is ESTree.TSAsExpression {
	return node.type === "TSAsExpression";
}

export function isAssignmentPattern(node: ESTree.Node): node is ESTree.AssignmentPattern {
	return node.type === "AssignmentPattern";
}

export function isThisExpression(node: ESTree.Node): node is ESTree.ThisExpression {
	return node.type === "ThisExpression";
}

export function hasName(
	node: ESTree.Node,
): node is ESTree.BindingIdentifier | ESTree.IdentifierName | ESTree.IdentifierReference {
	return node.type === "Identifier" && typeof node.name === "string";
}

export function isAssignmentExpressionNode(node: ESTree.Node): node is ESTree.AssignmentExpression {
	return node.type === "AssignmentExpression";
}

export function isExportNamedDeclarationNode(node: ESTree.Node): node is ESTree.ExportNamedDeclaration {
	return node.type === "ExportNamedDeclaration";
}

export function isExportSpecifierNode(node: ESTree.Node): node is ESTree.ExportSpecifier {
	return node.type === "ExportSpecifier";
}

export function isIdentifierName(node: ESTree.Node): node is ESTree.IdentifierName {
	return node.type === "Identifier";
}

export function isImportDeclaration(node: ESTree.Node): node is ESTree.ImportDeclaration {
	return node.type === "ImportDeclaration";
}

export function isImportDefaultSpecifierNode(node: ESTree.Node): node is ESTree.ImportDefaultSpecifier {
	return node.type === "ImportDefaultSpecifier";
}

export function isImportNamespaceSpecifierNode(node: ESTree.Node): node is ESTree.ImportNamespaceSpecifier {
	return node.type === "ImportNamespaceSpecifier";
}

export function isImportSpecifierNode(node: ESTree.Node): node is ESTree.ImportSpecifier {
	return node.type === "ImportSpecifier";
}

export function isJsxIdentifier(node: ESTree.Node): node is ESTree.JSXIdentifier {
	return node.type === "JSXIdentifier" && "name" in node;
}

export function isMethodDefinitionNode(node: ESTree.Node): node is ESTree.MethodDefinition {
	return node.type === "MethodDefinition" || node.type === "TSAbstractMethodDefinition";
}

export function isObjectExpressionNode(node: ESTree.Node): node is ESTree.ObjectExpression {
	return node.type === "ObjectExpression";
}

export function isPropertyNode(node: ESTree.Node): node is ESTree.ObjectProperty {
	return node.type === "Property";
}

export function isStringLiteral(node: ESTree.Node): node is ESTree.StringLiteral {
	return node.type === "Literal" && typeof node.value === "string";
}

export function isTsTypeAliasDeclarationNode(node: ESTree.Node): node is ESTree.TSTypeAliasDeclaration {
	return node.type === "TSTypeAliasDeclaration";
}

export function isStaticRequire(node: ESTree.Node): node is ESTree.CallExpression {
	if (!isCallExpression(node) || node.optional) return false;

	const { callee } = node;
	if (!isIdentifierName(callee) || callee.name !== "require" || node.arguments.length !== 1) return false;

	const [argument] = node.arguments;
	return argument !== undefined && isStringLiteral(argument);
}

export function isTsQualifiedName(node: ESTree.Node): node is ESTree.TSQualifiedName {
	return node.type === "TSQualifiedName";
}
