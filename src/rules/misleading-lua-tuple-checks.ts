import { AST_NODE_TYPES } from "@typescript-eslint/types";
import type { ParserServicesWithTypeInformation, TSESLint, TSESTree } from "@typescript-eslint/utils";
import type { ReportFixFunction, RuleFixer, SourceCode } from "@typescript-eslint/utils/ts-eslint";
import type { Expression, Node, Symbol as TsSymbol, Type, TypeChecker } from "typescript";
import {
	forEachChild,
	IndexKind,
	isCallExpression,
	isExpression,
	isIdentifier,
	isNonNullExpression,
	isParameter,
	isParenthesizedExpression,
	isPropertyDeclaration,
	isPropertySignature,
	isVariableDeclaration,
	SyntaxKind,
	TypeFlags,
} from "typescript";

type MessageIds = "misleading-lua-tuple-check" | "lua-tuple-declaration";

interface RuleDocsWithRecommended extends TSESLint.RuleMetaDataDocs {
	readonly recommended?: boolean;
}

function isTypePossiblyNil(type: Type): boolean {
	if ((type.flags & (TypeFlags.Undefined | TypeFlags.Null)) !== 0) return true;
	if (!type.isUnion()) return false;
	for (const subType of type.types) {
		if (isTypePossiblyNil(subType)) return true;
	}
	return false;
}

function typeNodeContainsNil(node: Node): boolean {
	if (node.kind === SyntaxKind.UndefinedKeyword || node.kind === SyntaxKind.NullKeyword) return true;

	let found = false;
	forEachChild(node, (child) => {
		if (!found && typeNodeContainsNil(child)) found = true;
	});
	return found;
}

function isLuaTuple(type: Type, checker: TypeChecker, typeCache: WeakMap<Type, boolean>): boolean {
	const cached = typeCache.get(type);
	if (cached !== undefined) return cached;

	if (type.isUnion()) {
		for (const subType of type.types) {
			if (!isLuaTuple(subType, checker, typeCache)) {
				typeCache.set(type, false);
				return false;
			}
		}
		typeCache.set(type, true);
		return true;
	}

	const luaTupleProperty = checker.getPropertyOfType(type, "__LuaTuple");
	if (luaTupleProperty !== undefined) {
		typeCache.set(type, true);
		return true;
	}

	const { aliasSymbol } = type;
	if (aliasSymbol !== undefined) {
		const isLua = aliasSymbol.escapedName.toString() === "LuaTuple";
		typeCache.set(type, isLua);
		return isLua;
	}

	if (type.isTypeParameter()) {
		const constraint = type.getConstraint();
		if (constraint !== undefined) {
			const result = isLuaTuple(constraint, checker, typeCache);
			typeCache.set(type, result);
			return result;
		}
	}

	typeCache.set(type, false);
	return false;
}

function isTsSymbolPossiblyNil(
	symbol: TsSymbol,
	checker: TypeChecker,
	exprCache: WeakMap<Node, boolean>,
	symbolCache: WeakMap<TsSymbol, boolean>,
): boolean {
	const cached = symbolCache.get(symbol);
	if (cached !== undefined) return cached;

	symbolCache.set(symbol, false);

	const declarations = symbol.getDeclarations();
	if (declarations === undefined) return false;

	for (const decl of declarations) {
		if (
			(isVariableDeclaration(decl) ||
				isParameter(decl) ||
				isPropertyDeclaration(decl) ||
				isPropertySignature(decl)) &&
			decl.type !== undefined &&
			typeNodeContainsNil(decl.type)
		) {
			symbolCache.set(symbol, true);
			return true;
		}

		if (
			(isVariableDeclaration(decl) || isParameter(decl) || isPropertyDeclaration(decl)) &&
			decl.initializer !== undefined &&
			isTsExpressionPossiblyNil(decl.initializer, checker, exprCache, symbolCache)
		) {
			symbolCache.set(symbol, true);
			return true;
		}
	}

	symbolCache.set(symbol, false);
	return false;
}

function isTsExpressionPossiblyNil(
	expr: Expression,
	checker: TypeChecker,
	exprCache: WeakMap<Node, boolean>,
	symbolCache: WeakMap<TsSymbol, boolean>,
): boolean {
	const cached = exprCache.get(expr);
	if (cached !== undefined) return cached;

	if (isParenthesizedExpression(expr)) {
		const res = isTsExpressionPossiblyNil(expr.expression, checker, exprCache, symbolCache);
		exprCache.set(expr, res);
		return res;
	}

	if (isNonNullExpression(expr)) {
		exprCache.set(expr, false);
		return false;
	}

	const exprType = checker.getTypeAtLocation(expr);
	if (isTypePossiblyNil(exprType)) {
		exprCache.set(expr, true);
		return true;
	}

	let res = false;
	if (isCallExpression(expr)) {
		const signature = checker.getResolvedSignature(expr);
		const typeNode = signature?.declaration?.type;
		if (typeNode !== undefined && typeNodeContainsNil(typeNode)) res = true;
	} else if (isIdentifier(expr)) {
		const symbol = checker.getSymbolAtLocation(expr);
		if (symbol !== undefined) {
			res = isTsSymbolPossiblyNil(symbol, checker, exprCache, symbolCache);
		}
	}

	exprCache.set(expr, res);
	return res;
}

function isNodeLuaTuple(
	node: TSESTree.Node,
	nodeCache: WeakMap<TSESTree.Node, boolean>,
	typeCache: WeakMap<Type, boolean>,
	checker: TypeChecker,
	getTypeAtLocation: (node: TSESTree.Node) => Type,
): boolean {
	const cached = nodeCache.get(node);
	if (cached !== undefined) return cached;

	const type = getTypeAtLocation(node);
	const result = isLuaTuple(type, checker, typeCache);
	nodeCache.set(node, result);
	return result;
}

function isNodePossiblyNil(
	node: TSESTree.Expression,
	parserServices: ParserServicesWithTypeInformation,
	checker: TypeChecker,
	exprCache: WeakMap<Node, boolean>,
	symbolCache: WeakMap<TsSymbol, boolean>,
): boolean {
	const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);
	if (!isExpression(tsNode)) return false;

	return isTsExpressionPossiblyNil(tsNode, checker, exprCache, symbolCache);
}

function createDestructuringFix(
	node: TSESTree.VariableDeclarator | TSESTree.AssignmentExpression,
	sourceCode: SourceCode,
): ReportFixFunction {
	return (fixer: RuleFixer) => {
		if (node.type === AST_NODE_TYPES.VariableDeclarator) {
			const { id } = node;
			// oxlint-disable-next-line no-null
			if (id.type !== AST_NODE_TYPES.Identifier) return null;

			const { typeAnnotation } = id;

			if (typeAnnotation !== undefined) {
				const typeText = sourceCode.getText(typeAnnotation);
				return fixer.replaceText(id, `[${id.name}]${typeText}`);
			}

			return fixer.replaceText(id, `[${id.name}]`);
		}

		const { left } = node;
		// oxlint-disable-next-line no-null
		if (left.type !== AST_NODE_TYPES.Identifier) return null;

		return fixer.replaceText(left, `[${left.name}]`);
	};
}

function createIndexAccessFix(node: TSESTree.Expression, sourceCode: SourceCode): ReportFixFunction {
	return (fixer: RuleFixer) => {
		const text = sourceCode.getText(node);
		const needsParens =
			node.type === AST_NODE_TYPES.AssignmentExpression ||
			node.type === AST_NODE_TYPES.ConditionalExpression ||
			node.type === AST_NODE_TYPES.LogicalExpression ||
			node.type === AST_NODE_TYPES.BinaryExpression;

		if (needsParens) return fixer.replaceText(node, `(${text})[0]`);

		return fixer.replaceText(node, `${text}[0]`);
	};
}
function isInForOfLeft(node: TSESTree.Node): boolean {
	let current: TSESTree.Node | undefined = node;
	while (current !== undefined) {
		// oxlint-disable-next-line prefer-destructuring
		const parent: TSESTree.Node | undefined | null = current.parent;
		if (parent === undefined || parent === null) break;

		if (parent.type === AST_NODE_TYPES.ForOfStatement && parent.left === current) return true;

		current = parent;
	}
	return false;
}

function getParserServices(
	context: TSESLint.RuleContext<MessageIds, []>,
): ParserServicesWithTypeInformation | undefined {
	const services = context.sourceCode.parserServices;
	if (services === undefined || services.program === undefined || services.esTreeNodeToTSNodeMap === undefined) {
		return undefined;
	}
	return services as ParserServicesWithTypeInformation;
}

const misleadingLuaTupleChecks: TSESLint.RuleModuleWithMetaDocs<MessageIds, [], RuleDocsWithRecommended> = {
	create(context) {
		const maybeServices = getParserServices(context);
		if (maybeServices === undefined) return {};

		const parserServices = maybeServices;
		const { sourceCode } = context;
		const checker: TypeChecker = parserServices.program.getTypeChecker();

		const nodeCache = new WeakMap<TSESTree.Node, boolean>();
		const typeCache = new WeakMap<Type, boolean>();
		const tsExprNilCache = new WeakMap<Node, boolean>();
		const tsSymbolNilCache = new WeakMap<TsSymbol, boolean>();

		function getTypeAtLocation(node: TSESTree.Node): Type {
			const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);
			return checker.getTypeAtLocation(tsNode);
		}

		return {
			'AssignmentExpression[operator="="][left.type="Identifier"]'(node: TSESTree.AssignmentExpression): void {
				if (
					isNodeLuaTuple(node.right, nodeCache, typeCache, checker, getTypeAtLocation) &&
					!isNodePossiblyNil(node.right, parserServices, checker, tsExprNilCache, tsSymbolNilCache)
				) {
					context.report({
						fix: createDestructuringFix(node, sourceCode),
						messageId: "lua-tuple-declaration",
						node,
					});
				}
			},
			"ConditionalExpression, DoWhileStatement, IfStatement, ForStatement, WhileStatement"(
				node:
					| TSESTree.ConditionalExpression
					| TSESTree.DoWhileStatement
					| TSESTree.IfStatement
					| TSESTree.ForStatement
					| TSESTree.WhileStatement,
			): void {
				let testNode: TSESTree.Expression | null | undefined;

				if (node.type === AST_NODE_TYPES.ConditionalExpression) {
					testNode = node.test;
				} else if (node.type === AST_NODE_TYPES.DoWhileStatement) {
					testNode = node.test;
				} else if (node.type === AST_NODE_TYPES.IfStatement) {
					testNode = node.test;
				} else if (node.type === AST_NODE_TYPES.ForStatement) {
					testNode = node.test;
				} else if (node.type === AST_NODE_TYPES.WhileStatement) {
					testNode = node.test;
				}

				if (testNode === null || testNode === undefined) return;

				if (
					isNodeLuaTuple(testNode, nodeCache, typeCache, checker, getTypeAtLocation) &&
					!isNodePossiblyNil(testNode, parserServices, checker, tsExprNilCache, tsSymbolNilCache)
				) {
					context.report({
						fix: createIndexAccessFix(testNode, sourceCode),
						messageId: "misleading-lua-tuple-check",
						node: testNode,
					});
				}
			},

			ForOfStatement(node: TSESTree.ForOfStatement): void {
				const { left, right } = node;

				if (left.type === AST_NODE_TYPES.VariableDeclaration) {
					const [declarator] = left.declarations;
					if (declarator === undefined) return;
					if (declarator.id.type !== AST_NODE_TYPES.Identifier) return;

					const rightType = getTypeAtLocation(right);
					const elementType = checker.getIndexTypeOfType(rightType, IndexKind.Number);
					if (
						elementType !== undefined &&
						isLuaTuple(elementType, checker, typeCache) &&
						!isTypePossiblyNil(elementType)
					) {
						context.report({
							fix: createDestructuringFix(declarator, sourceCode),
							messageId: "lua-tuple-declaration",
							node: declarator,
						});
					}
				}
			},

			LogicalExpression(node: TSESTree.LogicalExpression): void {
				if (
					isNodeLuaTuple(node.left, nodeCache, typeCache, checker, getTypeAtLocation) &&
					!isNodePossiblyNil(node.left, parserServices, checker, tsExprNilCache, tsSymbolNilCache)
				) {
					context.report({
						fix: createIndexAccessFix(node.left, sourceCode),
						messageId: "misleading-lua-tuple-check",
						node: node.left,
					});
				}

				if (
					isNodeLuaTuple(node.right, nodeCache, typeCache, checker, getTypeAtLocation) &&
					!isNodePossiblyNil(node.right, parserServices, checker, tsExprNilCache, tsSymbolNilCache)
				) {
					context.report({
						fix: createIndexAccessFix(node.right, sourceCode),
						messageId: "misleading-lua-tuple-check",
						node: node.right,
					});
				}
			},

			'UnaryExpression[operator="!"]'(node: TSESTree.UnaryExpression): void {
				if (
					isNodeLuaTuple(node.argument, nodeCache, typeCache, checker, getTypeAtLocation) &&
					!isNodePossiblyNil(node.argument, parserServices, checker, tsExprNilCache, tsSymbolNilCache)
				) {
					context.report({
						fix: createIndexAccessFix(node.argument, sourceCode),
						messageId: "misleading-lua-tuple-check",
						node: node.argument,
					});
				}
			},

			'VariableDeclarator[id.type="Identifier"]'(node: TSESTree.VariableDeclarator): void {
				if (isInForOfLeft(node)) return;

				const { init } = node;
				if (init === null || init === undefined) return;

				if (
					isNodeLuaTuple(init, nodeCache, typeCache, checker, getTypeAtLocation) &&
					!isNodePossiblyNil(init, parserServices, checker, tsExprNilCache, tsSymbolNilCache)
				) {
					context.report({
						fix: createDestructuringFix(node, sourceCode),
						messageId: "lua-tuple-declaration",
						node,
					});
				}
			},
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description:
				"Detects misleading LuaTuple usage in conditional and logical expressions. " +
				"LuaTuple (array) is always truthy, which can lead to bugs when checking the first element.",
			recommended: true,
		},
		fixable: "code",
		messages: {
			"lua-tuple-declaration": "Unexpected LuaTuple in declaration, use array destructuring.",
			"misleading-lua-tuple-check": "Unexpected LuaTuple in conditional expression. Add [0].",
		},
		schema: [],
		type: "problem",
	},
};

export default misleadingLuaTupleChecks;
