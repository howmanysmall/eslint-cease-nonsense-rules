import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES, ESLintUtils } from "@typescript-eslint/utils";
import { isArrayBindingOrAssignmentPattern, isTypeReference } from "ts-api-utils";
import type { Type, Symbol as TypeScriptSymbol } from "typescript";
import { SymbolFlags } from "typescript";
import { createRule } from "../utilities/create-rule";

type MessageIds = "misleadingLuaTupleCheck" | "luaTupleDeclaration";

type Options = [];

const luaTupleCache = new WeakMap<TSESTree.Node, boolean>();
const constrainedTypeCache = new WeakMap<TSESTree.Node, Type>();
function isLuaTupleCached(
	parserServices: ReturnType<typeof ESLintUtils.getParserServices>,
	node: TSESTree.Node,
): boolean {
	const cached = luaTupleCache.get(node);
	if (cached !== undefined) return cached;

	const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);
	if (tsNode === undefined) {
		luaTupleCache.set(node, false);
		return false;
	}

	const { program } = parserServices;
	if (program === null) {
		luaTupleCache.set(node, false);
		return false;
	}

	const checker = program.getTypeChecker();
	const type = checker.getTypeAtLocation(tsNode);
	const symbol = type.getSymbol();
	let aliasSymbol: TypeScriptSymbol | undefined = symbol;
	if (symbol !== undefined && (symbol.flags & SymbolFlags.Alias) !== 0) {
		aliasSymbol = checker.getAliasedSymbol(symbol);
	}
	const isLuaTuple = aliasSymbol !== undefined && aliasSymbol.escapedName.toString() === "LuaTuple";

	luaTupleCache.set(node, isLuaTuple);
	return isLuaTuple;
}

function getConstrainedTypeCached(
	parserServices: ReturnType<typeof ESLintUtils.getParserServices>,
	node: TSESTree.Node,
): Type {
	const cached = constrainedTypeCache.get(node);
	if (cached !== undefined) return cached;

	const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);
	if (tsNode === undefined) {
		const undefinedType = parserServices.program?.getTypeChecker().getAnyType();
		if (undefinedType !== undefined) {
			constrainedTypeCache.set(node, undefinedType);
			return undefinedType;
		}
		throw new Error("Cannot get type for node");
	}

	const { program } = parserServices;
	if (program === null) throw new Error("Program is null");

	const checker = program.getTypeChecker();
	const type = checker.getTypeAtLocation(tsNode);
	constrainedTypeCache.set(node, type);
	return type;
}

function isIterableFunctionType(
	program: ReturnType<typeof ESLintUtils.getParserServices>["program"],
	type: Type,
): boolean {
	if (!isTypeReference(type)) return false;
	if (program === null) return false;

	const checker = program.getTypeChecker();
	const typeArguments = checker.getTypeArguments(type);
	if (typeArguments.length === 0) return false;

	const [firstArgument] = typeArguments;
	if (firstArgument === undefined) return false;

	const symbol = firstArgument.getSymbol();
	if (symbol === undefined) return false;

	let aliasSymbol: TypeScriptSymbol | undefined = symbol;
	if ((symbol.flags & SymbolFlags.Alias) !== 0) aliasSymbol = checker.getAliasedSymbol(symbol);

	return aliasSymbol !== undefined && aliasSymbol.escapedName.toString() === "LuaTuple";
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
	if (!isTypeReference(type)) return;

	const { program } = parserServices;
	if (program === null) return;

	const checker = program.getTypeChecker();
	const typeArgs = checker.getTypeArguments(type);
	const aliasSymbol = typeArgs[0]?.aliasSymbol;
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
	node: TSESTree.AssignmentExpression,
): void {
	if (!isLuaTupleCached(parserServices, node.left) && isLuaTupleCached(parserServices, node.right)) {
		ensureArrayDestructuring(context, parserServices, node.left as TSESTree.Identifier);
	}
}

function validateForOfStatement(
	context: TSESLint.RuleContext<MessageIds, Options>,
	parserServices: ReturnType<typeof ESLintUtils.getParserServices>,
	node: TSESTree.ForOfStatement,
): void {
	const rightNode = node.right;
	const type = getConstrainedTypeCached(parserServices, rightNode);

	const { program } = parserServices;
	if (program !== null && isIterableFunctionType(program, type)) {
		handleIterableFunction(context, parserServices, node, type);
	} else checkLuaTupleUsage(context, parserServices, rightNode);
}

function validateVariableDeclarator(
	context: TSESLint.RuleContext<MessageIds, Options>,
	parserServices: ReturnType<typeof ESLintUtils.getParserServices>,
	node: TSESTree.VariableDeclarator,
): void {
	if (node.init && isLuaTupleCached(parserServices, node.init)) {
		ensureArrayDestructuring(context, parserServices, node.id as TSESTree.Identifier);
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
					validateAssignmentExpression(context, parserServices, node);
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
					validateVariableDeclarator(context, parserServices, node);
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
