import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES, ESLintUtils } from "@typescript-eslint/utils";
import { isArrayBindingOrAssignmentPattern, isTypeReference } from "ts-api-utils";
import type { Type, TypeChecker } from "typescript";
import { createRule } from "../utilities/create-rule";

type MessageIds = "misleadingLuaTupleCheck" | "luaTupleDeclaration";

type Options = [];

const luaTupleCache = new WeakMap<TSESTree.Node, boolean>();
const constrainedTypeCache = new WeakMap<TSESTree.Node, Type>();
const rawTypeCache = new WeakMap<TSESTree.Node, Type>();
const iterableFunctionCache = new WeakMap<Type, boolean>();

function getConstrainedTypeCached(
	parserServices: ReturnType<typeof ESLintUtils.getParserServices>,
	node: TSESTree.Node,
): Type | undefined {
	const cached = constrainedTypeCache.get(node);
	if (cached !== undefined) return cached;

	const { program } = parserServices;
	if (!program) return undefined;

	const rawType = parserServices.getTypeAtLocation(node);
	const constrainedType = program.getTypeChecker().getBaseConstraintOfType(rawType) ?? rawType;
	constrainedTypeCache.set(node, constrainedType);
	return constrainedType;
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

	const constrainedType = getConstrainedTypeCached(parserServices, node) ?? rawType;
	const result = isLuaTupleType(constrainedType) || (rawType !== constrainedType && isLuaTupleType(rawType));
	luaTupleCache.set(node, result);
	return result;
}

function getIterableLuaTupleReturnType(checker: TypeChecker, type: Type): Type | undefined {
	const apparentType = checker.getApparentType(type);
	for (const signature of apparentType.getCallSignatures()) {
		const returnType = signature.getReturnType();
		const constrainedReturnType = checker.getBaseConstraintOfType(returnType) ?? returnType;
		const { aliasSymbol } = constrainedReturnType;
		if (aliasSymbol && aliasSymbol.escapedName.toString() === "LuaTuple") {
			return constrainedReturnType;
		}
	}

	return undefined;
}

function isIterableFunctionType(
	program: ReturnType<typeof ESLintUtils.getParserServices>["program"],
	type: Type,
	seenTypes: WeakSet<Type> = new WeakSet<Type>(),
): boolean {
	if (!program) return false;

	const cached = iterableFunctionCache.get(type);
	if (cached !== undefined) return cached;

	if (seenTypes.has(type)) {
		iterableFunctionCache.set(type, false);
		return false;
	}

	seenTypes.add(type);

	const checker = program.getTypeChecker();
	const directSymbol = type.aliasSymbol ?? type.getSymbol();
	if (directSymbol && directSymbol.escapedName.toString() === "IterableFunction") {
		iterableFunctionCache.set(type, true);
		return true;
	}

	const constrainedType = checker.getBaseConstraintOfType(type);
	if (constrainedType && constrainedType !== type && isIterableFunctionType(program, constrainedType, seenTypes)) {
		iterableFunctionCache.set(type, true);
		return true;
	}

	if (getIterableLuaTupleReturnType(checker, type)) {
		iterableFunctionCache.set(type, true);
		return true;
	}

	if (isTypeReference(type)) {
		const [firstTypeArgument] = checker.getTypeArguments(type);
		if (firstTypeArgument) {
			const { aliasSymbol } = firstTypeArgument;
			if (aliasSymbol && aliasSymbol.escapedName.toString() === "LuaTuple") {
				iterableFunctionCache.set(type, true);
				return true;
			}
		}

		const targetSymbol = type.target.getSymbol();
		if (targetSymbol && targetSymbol.escapedName.toString() === "IterableFunction") {
			iterableFunctionCache.set(type, true);
			return true;
		}

		const targetResult = isIterableFunctionType(program, type.target, seenTypes);
		iterableFunctionCache.set(type, targetResult);
		return targetResult;
	}

	if (type.isUnionOrIntersection()) {
		const unionResult = type.types.some((innerType) => isIterableFunctionType(program, innerType, seenTypes));
		iterableFunctionCache.set(type, unionResult);
		return unionResult;
	}

	const typeName = checker.typeToString(type);
	const result = typeName.includes("IterableFunction");
	iterableFunctionCache.set(type, result);
	return result;
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
	function fixer(fixer: TSESLint.RuleFixer): TSESLint.RuleFix {
		let replacement = `[${leftNode.name}]`;
		if (leftNode.typeAnnotation) replacement += sourceCode.getText(leftNode.typeAnnotation);
		return fixer.replaceText(leftNode, replacement);
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
	type: Type,
): void {
	const { program } = parserServices;
	if (!program) return;

	const checker = program.getTypeChecker();
	const luaTupleCandidate = isTypeReference(type)
		? checker.getTypeArguments(type)[0]
		: getIterableLuaTupleReturnType(checker, type);

	if (!luaTupleCandidate) return;

	const { aliasSymbol } = luaTupleCandidate;
	if (!aliasSymbol || aliasSymbol.escapedName.toString() !== "LuaTuple") return;

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

	if (iterableType && program && isIterableFunctionType(program, iterableType)) {
		handleIterableFunction(context, parserServices, node, iterableType);
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

export default createRule<Options, MessageIds>({
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
