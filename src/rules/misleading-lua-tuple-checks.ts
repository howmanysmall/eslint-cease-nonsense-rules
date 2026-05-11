import { AST_NODE_TYPES, ESLintUtils } from "@typescript-eslint/utils";
import { createRule } from "@utilities/create-rule";
import { isArrayBindingOrAssignmentPattern, isTypeReference } from "ts-api-utils";
import { isCallExpression, isIdentifier, isTypeReferenceNode } from "typescript";

import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import type { Type, TypeChecker } from "typescript";

type MessageIds = "misleadingLuaTupleCheck" | "luaTupleDeclaration";

type Options = [];

const luaTupleCache = new WeakMap<TSESTree.Node, boolean>();
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

function getTypeAtLocationCached(
	parserServices: ReturnType<typeof ESLintUtils.getParserServices>,
	node: TSESTree.Node,
): Type | undefined {
	const cached = rawTypeCache.get(node);
	if (cached !== undefined) return cached;

	const { program } = parserServices;
	if (!program) return undefined;

	const rawType = parserServices.getTypeAtLocation(node);
	rawTypeCache.set(node, rawType);
	return rawType;
}

function isLuaTupleType(type: Type | undefined): boolean {
	if (!type) return false;

	const aliasSymbol = type.aliasSymbol ?? type.getSymbol();
	return aliasSymbol !== undefined && aliasSymbol.escapedName.toString() === "LuaTuple";
}

function getConstrainedLuaTupleType(checker: TypeChecker, type: Type): Type | undefined {
	const typeConstraint = type.getConstraint();
	if (typeConstraint && typeConstraint !== type && isLuaTupleType(typeConstraint)) return typeConstraint;

	const constrainedType = checker.getBaseConstraintOfType(type) ?? type;
	if (isLuaTupleType(constrainedType)) return constrainedType;
	if (constrainedType !== type && isLuaTupleType(type)) return type;
	return undefined;
}

function isLuaTupleCached(
	parserServices: ReturnType<typeof ESLintUtils.getParserServices>,
	node: TSESTree.Node,
): boolean {
	const cached = luaTupleCache.get(node);
	if (cached !== undefined) return cached;

	if (node.type === AST_NODE_TYPES.MemberExpression && node.computed) {
		luaTupleCache.set(node, false);
		return false;
	}

	if (!isLuaTupleCandidate(node)) {
		luaTupleCache.set(node, false);
		return false;
	}

	const { program } = parserServices;
	if (!program) {
		luaTupleCache.set(node, false);
		return false;
	}

	const rawType = getTypeAtLocationCached(parserServices, node);
	if (!rawType) {
		luaTupleCache.set(node, false);
		return false;
	}

	const checker = program.getTypeChecker();
	const result = getConstrainedLuaTupleType(checker, rawType) !== undefined;
	luaTupleCache.set(node, result);
	return result;
}

function getIterableLuaTupleReturnType(checker: TypeChecker, type: Type): Type | undefined {
	const apparentType = checker.getApparentType(type);
	for (const signature of apparentType.getCallSignatures()) {
		const returnType = signature.getReturnType();
		const constrainedReturnType = getConstrainedLuaTupleType(checker, returnType);
		if (constrainedReturnType) return constrainedReturnType;
	}

	return undefined;
}

function getIterableFunctionLuaTupleCandidate(
	program: ReturnType<typeof ESLintUtils.getParserServices>["program"],
	type: Type,
	seenTypes: WeakSet<Type> = new WeakSet<Type>(),
): Type | undefined {
	if (!program) return undefined;

	const cached = iterableFunctionCache.get(type);
	if (cached !== undefined) return cached === false ? undefined : cached;

	if (seenTypes.has(type)) {
		iterableFunctionCache.set(type, false);
		return undefined;
	}

	seenTypes.add(type);

	const checker = program.getTypeChecker();
	const typeConstraint = type.getConstraint();
	if (typeConstraint && typeConstraint !== type) {
		const typeConstraintCandidate = getIterableFunctionLuaTupleCandidate(program, typeConstraint, seenTypes);
		if (typeConstraintCandidate) {
			iterableFunctionCache.set(type, typeConstraintCandidate);
			return typeConstraintCandidate;
		}
	}

	const constrainedType = checker.getBaseConstraintOfType(type);
	if (constrainedType && constrainedType !== type) {
		const constrainedCandidate = getIterableFunctionLuaTupleCandidate(program, constrainedType, seenTypes);
		if (constrainedCandidate) {
			iterableFunctionCache.set(type, constrainedCandidate);
			return constrainedCandidate;
		}
	}

	if (isTypeReference(type)) {
		const [firstTypeArgument] = checker.getTypeArguments(type);
		if (firstTypeArgument) {
			const luaTupleArgument = getConstrainedLuaTupleType(checker, firstTypeArgument);
			if (luaTupleArgument) {
				iterableFunctionCache.set(type, luaTupleArgument);
				return luaTupleArgument;
			}
		}

		const targetCandidate = getIterableFunctionLuaTupleCandidate(program, type.target, seenTypes);
		if (targetCandidate) {
			iterableFunctionCache.set(type, targetCandidate);
			return targetCandidate;
		}
	}

	const apparentCandidate = getIterableLuaTupleReturnType(checker, type);
	if (apparentCandidate) {
		iterableFunctionCache.set(type, apparentCandidate);
		return apparentCandidate;
	}

	if (type.isUnionOrIntersection()) {
		for (const innerType of type.types) {
			const innerCandidate = getIterableFunctionLuaTupleCandidate(program, innerType, seenTypes);
			if (innerCandidate) {
				iterableFunctionCache.set(type, innerCandidate);
				return innerCandidate;
			}
		}
	}

	iterableFunctionCache.set(type, false);
	return undefined;
}

function checkLuaTupleUsage(
	context: TSESLint.RuleContext<MessageIds, Options>,
	parserServices: ReturnType<typeof ESLintUtils.getParserServices>,
	node: TSESTree.Node,
): void {
	if (isLuaTupleCached(parserServices, node)) {
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
	parserServices: ReturnType<typeof ESLintUtils.getParserServices>,
	leftNode: TSESTree.Identifier,
): void {
	const esNode = parserServices.esTreeNodeToTSNodeMap.get(leftNode);
	if (isArrayBindingOrAssignmentPattern(esNode)) return;

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

function handleIterableFunction(
	context: TSESLint.RuleContext<MessageIds, Options>,
	parserServices: ReturnType<typeof ESLintUtils.getParserServices>,
	node: TSESTree.ForOfStatement,
	luaTupleCandidate: Type,
): void {
	if (!isLuaTupleType(luaTupleCandidate)) return;

	if (node.left.type === AST_NODE_TYPES.Identifier) {
		ensureArrayDestructuring(context, parserServices, node.left);
		return;
	}

	if (node.left.type !== AST_NODE_TYPES.VariableDeclaration) return;

	const [variableDeclarator] = node.left.declarations;
	if (variableDeclarator !== undefined && variableDeclarator.id.type === AST_NODE_TYPES.Identifier) {
		ensureArrayDestructuring(context, parserServices, variableDeclarator.id);
	}
}

function getCallExpressionReturnConstraintCandidate(
	parserServices: ReturnType<typeof ESLintUtils.getParserServices>,
	node: TSESTree.Node,
): Type | undefined {
	if (node.type !== AST_NODE_TYPES.CallExpression) return undefined;

	const { program } = parserServices;
	if (!program) return undefined;

	const checker = program.getTypeChecker();
	const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);
	if (!isCallExpression(tsNode)) return undefined;

	const signature = checker.getResolvedSignature(tsNode);
	if (!signature) return undefined;

	const declaration = signature.getDeclaration();
	const returnTypeNode = declaration.type;
	if (!returnTypeNode || !isTypeReferenceNode(returnTypeNode) || !isIdentifier(returnTypeNode.typeName)) {
		return undefined;
	}

	const { typeParameters } = declaration;
	if (!typeParameters) return undefined;

	for (const typeParameter of typeParameters) {
		if (typeParameter.name.text !== returnTypeNode.typeName.text || !typeParameter.constraint) continue;

		const constraintType = checker.getTypeFromTypeNode(typeParameter.constraint);
		const luaTupleCandidate = getIterableFunctionLuaTupleCandidate(program, constraintType);
		if (luaTupleCandidate) return luaTupleCandidate;
	}

	return undefined;
}

function validateAssignmentExpression(
	context: TSESLint.RuleContext<MessageIds, Options>,
	parserServices: ReturnType<typeof ESLintUtils.getParserServices>,
	leftNode: TSESTree.Identifier,
	rightNode: TSESTree.Node,
): void {
	if (!isLuaTupleCached(parserServices, leftNode) && isLuaTupleCached(parserServices, rightNode)) {
		ensureArrayDestructuring(context, parserServices, leftNode);
	}
}

function validateForOfStatement(
	context: TSESLint.RuleContext<MessageIds, Options>,
	parserServices: ReturnType<typeof ESLintUtils.getParserServices>,
	node: TSESTree.ForOfStatement,
): void {
	const rightNode = node.right;
	const iterableType = getTypeAtLocationCached(parserServices, rightNode);
	const { program } = parserServices;

	if (iterableType && program) {
		const luaTupleCandidate = getIterableFunctionLuaTupleCandidate(program, iterableType);
		if (luaTupleCandidate) {
			handleIterableFunction(context, parserServices, node, luaTupleCandidate);
			return;
		}
	}

	const callExpressionCandidate = getCallExpressionReturnConstraintCandidate(parserServices, rightNode);
	if (callExpressionCandidate) {
		handleIterableFunction(context, parserServices, node, callExpressionCandidate);
		return;
	}

	checkLuaTupleUsage(context, parserServices, rightNode);
}

function validateVariableDeclarator(
	context: TSESLint.RuleContext<MessageIds, Options>,
	parserServices: ReturnType<typeof ESLintUtils.getParserServices>,
	identifier: TSESTree.Identifier,
	init: TSESTree.Expression | undefined,
): void {
	if (init && isLuaTupleCached(parserServices, init)) {
		ensureArrayDestructuring(context, parserServices, identifier);
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
				if (node.id.type === AST_NODE_TYPES.Identifier) {
					const init = node.init ?? undefined;
					validateVariableDeclarator(context, parserServices, node.id, init);
				}
			},
			WhileStatement(node): void {
				containsBoolean(node);
			},
		};
	},
	defaultOptions: [],
	meta: {
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
