import { createRule } from "$utilities/create-rule";
import { getDefinedValue } from "$utilities/defined-utilities";
import { AST_NODE_TYPES, ESLintUtils } from "@typescript-eslint/utils";
import { isTypeReference } from "ts-api-utils";
import {
	isArrayTypeNode,
	isFunctionDeclaration,
	isFunctionLike,
	isIdentifier,
	isTypeAliasDeclaration,
	isTypeReferenceNode,
	isTupleTypeNode,
	isVariableDeclaration,
} from "typescript";

import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import type { Except } from "type-fest";
import type {
	Node,
	Program,
	Type,
	TypeChecker,
	TypeNode,
	TypeParameterDeclaration,
	TypeReferenceNode,
} from "typescript";

type MessageIds = "misleadingLuaTupleCheck" | "luaTupleDeclaration";

type Options = [];
type ParserServices = Except<ReturnType<typeof ESLintUtils.getParserServices>, "program"> & {
	readonly program: Program;
};

const rawTypeCache = new WeakMap<TSESTree.Node, Type>();
const iterableFunctionCache = new WeakMap<Type, Type | false>();

function isLuaTupleCandidate(node: TSESTree.Node): boolean {
	switch (node.type) {
		case AST_NODE_TYPES.Identifier:
		case AST_NODE_TYPES.MemberExpression:
		case AST_NODE_TYPES.CallExpression:
		case AST_NODE_TYPES.ChainExpression:
		case AST_NODE_TYPES.TSAsExpression:
		case AST_NODE_TYPES.TSTypeAssertion:
		case AST_NODE_TYPES.TSNonNullExpression:
		case AST_NODE_TYPES.AwaitExpression:
			return true;
		default:
			return false;
	}
}

function getTypeAtLocationCached(parserServices: ParserServices, node: TSESTree.Node): Type {
	const cached = rawTypeCache.get(node);
	if (cached !== undefined) return cached;

	const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);
	const rawType = parserServices.program.getTypeChecker().getTypeAtLocation(tsNode);
	rawTypeCache.set(node, rawType);
	return rawType;
}

function isLuaTupleType(type: Type): boolean {
	const aliasSymbol = type.aliasSymbol ?? type.getSymbol();
	return aliasSymbol?.escapedName.toString() === "LuaTuple";
}

function getConstrainedLuaTupleType(type: Type): Type | undefined {
	const typeConstraint = type.getConstraint();
	if (typeConstraint && typeConstraint !== type && isLuaTupleType(typeConstraint)) return typeConstraint;
	if (isLuaTupleType(type)) return type;
	return undefined;
}

function isLuaTuple(parserServices: ParserServices, node: TSESTree.Node): boolean {
	if (node.type === AST_NODE_TYPES.MemberExpression && node.computed) return false;

	if (!isLuaTupleCandidate(node)) return false;

	const rawType = getTypeAtLocationCached(parserServices, node);
	return getConstrainedLuaTupleType(rawType) !== undefined;
}

function getIterableLuaTupleReturnType(checker: TypeChecker, type: Type): Type | undefined {
	const apparentType = checker.getApparentType(type);
	for (const signature of apparentType.getCallSignatures()) {
		const returnType = signature.getReturnType();
		const constrainedReturnType = getConstrainedLuaTupleType(returnType);
		if (constrainedReturnType) return constrainedReturnType;
	}

	return undefined;
}

function cacheIterableFunctionCandidate(type: Type, candidate: Type | undefined): Type | undefined {
	iterableFunctionCache.set(type, candidate ?? false);
	return candidate;
}

function getTypeConstraintCandidate(program: Program, type: Type, seenTypes: WeakSet<Type>): Type | undefined {
	const typeConstraint = type.getConstraint();
	if (typeConstraint === undefined || typeConstraint === type) return undefined;

	return getIterableFunctionLuaTupleCandidate(program, typeConstraint, seenTypes);
}

function getBaseConstraintCandidate(
	program: Program,
	checker: TypeChecker,
	type: Type,
	seenTypes: WeakSet<Type>,
): Type | undefined {
	const constrainedType = checker.getBaseConstraintOfType(type);
	if (constrainedType === undefined || constrainedType === type) return undefined;

	return getIterableFunctionLuaTupleCandidate(program, constrainedType, seenTypes);
}

function getTypeReferenceTargetCandidate(program: Program, type: Type, seenTypes: WeakSet<Type>): Type | undefined {
	if (!isTypeReference(type)) return undefined;

	return getIterableFunctionLuaTupleCandidate(program, type.target, seenTypes);
}

function getNumberIndexCandidate(type: Type): Type | undefined {
	const indexedElementType = type.getNumberIndexType();
	if (indexedElementType === undefined) return undefined;

	return getConstrainedLuaTupleType(indexedElementType);
}

function getUnionOrIntersectionCandidate(program: Program, type: Type, seenTypes: WeakSet<Type>): Type | undefined {
	if (!type.isUnionOrIntersection()) return undefined;

	for (const innerType of type.types) {
		const innerCandidate = getIterableFunctionLuaTupleCandidate(program, innerType, seenTypes);
		if (innerCandidate !== undefined) return innerCandidate;
	}

	return undefined;
}

function getIterableFunctionLuaTupleCandidate(
	program: Program,
	type: Type,
	seenTypes: WeakSet<Type> = new WeakSet<Type>(),
): Type | undefined {
	const cached = iterableFunctionCache.get(type);
	if (cached !== undefined) return cached === false ? undefined : cached;

	if (seenTypes.has(type)) {
		iterableFunctionCache.set(type, false);
		return undefined;
	}

	seenTypes.add(type);

	const checker = program.getTypeChecker();
	const candidate =
		getTypeConstraintCandidate(program, type, seenTypes) ??
		getBaseConstraintCandidate(program, checker, type, seenTypes) ??
		getTypeReferenceTargetCandidate(program, type, seenTypes) ??
		getNumberIndexCandidate(type) ??
		getIterableLuaTupleReturnType(checker, type) ??
		getUnionOrIntersectionCandidate(program, type, seenTypes);

	return cacheIterableFunctionCandidate(type, candidate);
}

function checkLuaTupleUsage(
	context: TSESLint.RuleContext<MessageIds, Options>,
	parserServices: ParserServices,
	node: TSESTree.Node,
): void {
	if (isLuaTuple(parserServices, node)) {
		context.report({
			fix(fixer) {
				return fixer.insertTextAfter(node, "[0]");
			},
			messageId: "misleadingLuaTupleCheck",
			node,
		});
	}
}

function ensureArrayDestructuring(
	context: TSESLint.RuleContext<MessageIds, Options>,
	leftNode: TSESTree.Identifier,
): void {
	const { sourceCode } = context;
	function fixer(ruleFixer: TSESLint.RuleFixer): TSESLint.RuleFix {
		let replacement = `[${leftNode.name}]`;
		if (leftNode.typeAnnotation) replacement += sourceCode.getText(leftNode.typeAnnotation);
		return ruleFixer.replaceText(leftNode, replacement);
	}

	context.report({
		fix: fixer,
		messageId: "luaTupleDeclaration",
		node: leftNode,
	});
}

function reportForOfLuaTupleDeclaration(
	context: TSESLint.RuleContext<MessageIds, Options>,
	node: TSESTree.ForOfStatement,
): void {
	if (node.left.type === AST_NODE_TYPES.Identifier) {
		ensureArrayDestructuring(context, node.left);
		return;
	}

	if (node.left.type !== AST_NODE_TYPES.VariableDeclaration) return;

	const [variableDeclarator] = node.left.declarations;
	if (variableDeclarator !== undefined && variableDeclarator.id.type === AST_NODE_TYPES.Identifier) {
		ensureArrayDestructuring(context, variableDeclarator.id);
	}
}

function handleIterableFunction(
	context: TSESLint.RuleContext<MessageIds, Options>,
	node: TSESTree.ForOfStatement,
): void {
	reportForOfLuaTupleDeclaration(context, node);
}

function typeNodeReferencesIdentifier(node: Node, name: string): boolean {
	if (isTypeReferenceNode(node) && isIdentifier(node.typeName) && node.typeName.text === name) return true;

	const childResult = node.forEachChild((childNode) =>
		typeNodeReferencesIdentifier(childNode, name) ? true : undefined,
	);
	return childResult === true;
}

function typeNodeReferencesTupleIterable(node: Node): boolean {
	return typeNodeReferencesIdentifier(node, "IterableFunction") && typeNodeReferencesIdentifier(node, "LuaTuple");
}

function typeParametersReferenceTupleIterable(
	typeName: string,
	typeParameters: ReadonlyArray<TypeParameterDeclaration> | undefined,
): boolean {
	if (!typeParameters) return false;

	for (const typeParameter of typeParameters) {
		if (typeParameter.name.text !== typeName || !typeParameter.constraint) continue;
		if (typeNodeReferencesTupleIterable(typeParameter.constraint)) return true;
	}

	return false;
}

function findFunctionNode(node: Node, name: string): Node | undefined {
	if (isFunctionDeclaration(node) && node.name?.text === name) return node;

	return node.forEachChild((childNode) => findFunctionNode(childNode, name));
}

function findTypeAliasTypeNode(node: Node, name: string): TypeNode | undefined {
	if (isTypeAliasDeclaration(node) && node.name.text === name) return node.type;

	return node.forEachChild((childNode) => findTypeAliasTypeNode(childNode, name));
}

function typeReferenceUsesArray(
	sourceFile: Node,
	typeNode: TypeReferenceNode,
	seenAliases = new Set<string>(),
): boolean {
	if (!isIdentifier(typeNode.typeName)) return false;

	const typeName = typeNode.typeName.text;
	if (["Array", "ReadonlyArray"].includes(typeName)) return true;
	if (seenAliases.has(typeName)) return false;

	seenAliases.add(typeName);

	const aliasType = findTypeAliasTypeNode(sourceFile, typeName);
	if (!aliasType) return false;
	if (isTypeReferenceNode(aliasType)) return typeReferenceUsesArray(sourceFile, aliasType, seenAliases);

	return false;
}

function findVariableTypeNode(node: Node, name: string): TypeNode | undefined {
	if (isVariableDeclaration(node) && isIdentifier(node.name) && node.name.text === name) return node.type;

	return node.forEachChild((childNode) => findVariableTypeNode(childNode, name));
}

function nodeContainsNode(parentNode: Node, childNode: Node): boolean {
	return parentNode.pos <= childNode.pos && childNode.end <= parentNode.end;
}

function nodeHasTupleIterableParameter(node: Node, name: string, targetNode: Node): boolean {
	if (isFunctionLike(node) && nodeContainsNode(node, targetNode)) {
		for (const parameter of node.parameters) {
			if (!isIdentifier(parameter.name) || parameter.name.text !== name) continue;
			if (!(parameter.type && isTypeReferenceNode(parameter.type) && isIdentifier(parameter.type.typeName))) {
				continue;
			}
			if (typeParametersReferenceTupleIterable(parameter.type.typeName.text, node.typeParameters)) return true;
		}
	}

	const childResult = node.forEachChild((childNode) =>
		nodeHasTupleIterableParameter(childNode, name, targetNode) ? true : undefined,
	);
	return childResult === true;
}

function hasLuaTupleArrayDeclaration(parserServices: ParserServices, node: TSESTree.Node): boolean {
	if (node.type !== AST_NODE_TYPES.Identifier) return false;

	const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);

	const variableTypeNode = findVariableTypeNode(tsNode.getSourceFile(), node.name);
	if (!variableTypeNode) return false;
	if (isArrayTypeNode(variableTypeNode)) {
		return typeNodeReferencesIdentifier(variableTypeNode.elementType, "LuaTuple");
	}
	if (isTupleTypeNode(variableTypeNode)) {
		return variableTypeNode.elements.some((element) => typeNodeReferencesIdentifier(element, "LuaTuple"));
	}

	return (
		isTypeReferenceNode(variableTypeNode) &&
		typeNodeReferencesIdentifier(variableTypeNode, "LuaTuple") &&
		typeReferenceUsesArray(tsNode.getSourceFile(), variableTypeNode)
	);
}

function hasTupleIterableParameterConstraint(parserServices: ParserServices, node: TSESTree.Node): boolean {
	if (node.type !== AST_NODE_TYPES.Identifier) return false;

	const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);

	return nodeHasTupleIterableParameter(tsNode.getSourceFile(), node.name, tsNode);
}

function functionReturnReferencesTupleIterable(node: Node | undefined): boolean {
	if (node === undefined) return false;
	if (!isFunctionLike(node)) return false;
	if (node.type === undefined) return false;
	if (!isTypeReferenceNode(node.type)) return false;
	if (!isIdentifier(node.type.typeName)) return false;

	return typeParametersReferenceTupleIterable(node.type.typeName.text, node.typeParameters);
}

function hasTupleIterableCallConstraint(parserServices: ParserServices, node: TSESTree.Node): boolean {
	if (node.type !== AST_NODE_TYPES.CallExpression) return false;

	const checker = parserServices.program.getTypeChecker();
	const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);

	if (node.callee.type === AST_NODE_TYPES.Identifier) {
		const functionNode = findFunctionNode(tsNode.getSourceFile(), node.callee.name);
		if (functionReturnReferencesTupleIterable(functionNode)) return true;
	}

	const calleeNode = parserServices.esTreeNodeToTSNodeMap.get(node.callee);
	const symbol = checker.getSymbolAtLocation(calleeNode);
	if (!symbol) return false;

	for (const declaration of getDefinedValue(
		symbol.declarations,
		"Expected resolved symbols to expose declarations.",
	)) {
		if (functionReturnReferencesTupleIterable(declaration)) return true;
	}

	return false;
}

function validateAssignmentExpression(
	context: TSESLint.RuleContext<MessageIds, Options>,
	parserServices: ParserServices,
	leftNode: TSESTree.Identifier,
	rightNode: TSESTree.Node,
): void {
	if (!isLuaTuple(parserServices, leftNode) && isLuaTuple(parserServices, rightNode)) {
		ensureArrayDestructuring(context, leftNode);
	}
}

function validateForOfStatement(
	context: TSESLint.RuleContext<MessageIds, Options>,
	parserServices: ParserServices,
	node: TSESTree.ForOfStatement,
): void {
	const rightNode = node.right;
	const iterableType = getTypeAtLocationCached(parserServices, rightNode);
	const luaTupleCandidate = getIterableFunctionLuaTupleCandidate(parserServices.program, iterableType);

	if (luaTupleCandidate !== undefined) {
		handleIterableFunction(context, node);
		return;
	}

	if (hasTupleIterableCallConstraint(parserServices, rightNode)) {
		reportForOfLuaTupleDeclaration(context, node);
		return;
	}

	if (hasTupleIterableParameterConstraint(parserServices, rightNode)) {
		reportForOfLuaTupleDeclaration(context, node);
		return;
	}

	if (hasLuaTupleArrayDeclaration(parserServices, rightNode)) {
		reportForOfLuaTupleDeclaration(context, node);
		return;
	}

	checkLuaTupleUsage(context, parserServices, rightNode);
}

function validateVariableDeclarator(
	context: TSESLint.RuleContext<MessageIds, Options>,
	parserServices: ParserServices,
	identifier: TSESTree.Identifier,
	init: TSESTree.Expression | undefined,
): void {
	if (init && isLuaTuple(parserServices, init)) {
		ensureArrayDestructuring(context, identifier);
	}
}

const misleadingLuaTupleChecks = createRule<Options, MessageIds>({
	create(context) {
		const parserServices = ESLintUtils.getParserServices(context);

		function containsBoolean(
			node:
				| TSESTree.ConditionalExpression
				| TSESTree.DoWhileStatement
				| TSESTree.ForStatement
				| TSESTree.IfStatement
				| TSESTree.WhileStatement,
		): void {
			if (node.test && node.test.type !== AST_NODE_TYPES.LogicalExpression) {
				checkLuaTupleUsage(context, parserServices, node.test);
			}
		}

		return {
			AssignmentExpression(node): void {
				if (node.operator === "=" && node.left.type === AST_NODE_TYPES.Identifier) {
					validateAssignmentExpression(context, parserServices, node.left, node.right);
				}
			},

			ConditionalExpression(node): void {
				containsBoolean(node);
			},
			DoWhileStatement(node): void {
				containsBoolean(node);
			},
			ForOfStatement(node): void {
				validateForOfStatement(context, parserServices, node);
			},
			ForStatement(node): void {
				containsBoolean(node);
			},
			IfStatement(node): void {
				containsBoolean(node);
			},
			LogicalExpression(node): void {
				checkLuaTupleUsage(context, parserServices, node.left);
				checkLuaTupleUsage(context, parserServices, node.right);
			},
			UnaryExpression(node): void {
				if (node.operator === "!") {
					checkLuaTupleUsage(context, parserServices, node.argument);
				}
			},
			VariableDeclarator(node): void {
				if (node.id.type !== AST_NODE_TYPES.Identifier) return;

				const init = node.init ?? undefined;
				validateVariableDeclarator(context, parserServices, node.id, init);
			},
			WhileStatement(node): void {
				containsBoolean(node);
			},
		};
	},
	meta: {
		defaultOptions: [],
		docs: {
			description: "Disallow the use of LuaTuple in conditional expressions",
		},
		fixable: "code",
		messages: {
			luaTupleDeclaration: "Unexpected LuaTuple in declaration, use array destructuring.",
			misleadingLuaTupleCheck: "Unexpected LuaTuple in conditional expression. Add [0].",
		},
		schema: [],
		type: "problem",
	},
	name: "misleading-lua-tuple-checks",
});

export default misleadingLuaTupleChecks;
