import { AST_NODE_TYPES } from "@typescript-eslint/types";
import type { ParserServicesWithTypeInformation, TSESLint, TSESTree } from "@typescript-eslint/utils";
import type { ReportFixFunction, RuleFixer, SourceCode } from "@typescript-eslint/utils/ts-eslint";
import type { Type, TypeChecker } from "typescript";

type MessageIds = "misleading-lua-tuple-check" | "lua-tuple-declaration";

interface RuleDocsWithRecommended extends TSESLint.RuleMetaDataDocs {
	readonly recommended?: boolean;
}

function isLuaTuple(type: Type, typeCache: WeakMap<Type, boolean>): boolean {
	const cached = typeCache.get(type);
	if (cached !== undefined) return cached;

	// Fast-path: Check if the type alias symbol is "LuaTuple"
	const { aliasSymbol } = type;
	if (aliasSymbol !== undefined) {
		const isLua = aliasSymbol.escapedName.toString() === "LuaTuple";
		typeCache.set(type, isLua);
		return isLua;
	}

	// Handle type parameters: resolve constraints
	if (type.isTypeParameter()) {
		const constraint = type.getConstraint();
		if (constraint !== undefined) {
			const result = isLuaTuple(constraint, typeCache);
			typeCache.set(type, result);
			return result;
		}
	}

	// Handle union types: check if any constituent is a LuaTuple
	if (type.isUnion()) {
		for (const subType of type.types) {
			if (!isLuaTuple(subType, typeCache)) continue;
			typeCache.set(type, true);
			return true;
		}
	}

	typeCache.set(type, false);
	return false;
}

function isNodeLuaTuple(
	node: TSESTree.Node,
	nodeCache: WeakMap<TSESTree.Node, boolean>,
	typeCache: WeakMap<Type, boolean>,
	getTypeAtLocation: (node: TSESTree.Node) => Type,
): boolean {
	const cached = nodeCache.get(node);
	if (cached !== undefined) return cached;

	const type = getTypeAtLocation(node);
	const result = isLuaTuple(type, typeCache);
	nodeCache.set(node, result);
	return result;
}

function createDestructuringFix(
	node: TSESTree.VariableDeclarator | TSESTree.AssignmentExpression,
	sourceCode: SourceCode,
): ReportFixFunction {
	return (fixer: RuleFixer) => {
		if (node.type === AST_NODE_TYPES.VariableDeclarator) {
			// Const result = foo() → const [result] = foo()
			// Const result: Type = foo() → const [result]: Type = foo()
			const { id } = node;
			// oxlint-disable-next-line no-null
			if (id.type !== AST_NODE_TYPES.Identifier) return null;

			const idText = sourceCode.getText(id);
			const { typeAnnotation } = id;

			if (typeAnnotation !== undefined) {
				// Has type annotation - preserve it
				const typeText = sourceCode.getText(typeAnnotation);
				return fixer.replaceText(id, `[${idText}]${typeText}`);
			}

			// No type annotation
			return fixer.replaceText(id, `[${idText}]`);
		}

		// AssignmentExpression: result = foo() → [result] = foo()
		const { left } = node;
		// oxlint-disable-next-line no-null
		if (left.type !== AST_NODE_TYPES.Identifier) return null;

		const leftText = sourceCode.getText(left);
		return fixer.replaceText(left, `[${leftText}]`);
	};
}

function createIndexAccessFix(node: TSESTree.Expression, sourceCode: SourceCode): ReportFixFunction {
	return (fixer: RuleFixer) => {
		const text = sourceCode.getText(node);
		// Wrap in parentheses if needed for operator precedence
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
		// oxlint-disable-next-line prefer-destructuring -- Cannot destructure; parent is reassigned to current
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
		// Skip non-TypeScript files (e.g., .json, .js without project)
		if (maybeServices === undefined) return {};

		const parserServices = maybeServices;
		const { sourceCode } = context;
		const checker: TypeChecker = parserServices.program.getTypeChecker();

		// Multi-level caching
		const nodeCache = new WeakMap<TSESTree.Node, boolean>();
		const typeCache = new WeakMap<Type, boolean>();

		// Helper to get type at location
		function getTypeAtLocation(node: TSESTree.Node): Type {
			const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);
			return checker.getTypeAtLocation(tsNode);
		}

		return {
			// LuaTuple assignments without destructuring
			'AssignmentExpression[operator="="][left.type="Identifier"]'(node: TSESTree.AssignmentExpression): void {
				if (isNodeLuaTuple(node.right, nodeCache, typeCache, getTypeAtLocation)) {
					context.report({
						fix: createDestructuringFix(node, sourceCode),
						messageId: "lua-tuple-declaration",
						node,
					});
				}
			},
			// LuaTuple in conditional expressions (if, while, for, ternary)
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

				if (isNodeLuaTuple(testNode, nodeCache, typeCache, getTypeAtLocation)) {
					context.report({
						fix: createIndexAccessFix(testNode, sourceCode),
						messageId: "misleading-lua-tuple-check",
						node: testNode,
					});
				}
			},

			// LuaTuple in for-of with iterable functions
			ForOfStatement(node: TSESTree.ForOfStatement): void {
				const { left, right } = node;

				// Only check if left is an Identifier (not destructuring)
				if (left.type === AST_NODE_TYPES.VariableDeclaration) {
					const [declarator] = left.declarations;
					if (declarator === undefined) return;
					if (declarator.id.type !== AST_NODE_TYPES.Identifier) return;

					// Check if iterating over something that yields LuaTuple
					// We need to check the element type of the iterable
					// Try to get the iterator element type
					// For arrays/iterables, TypeScript has iteration types
					const iteratorType = checker.getTypeAtLocation(parserServices.esTreeNodeToTSNodeMap.get(right));

					// Check if this is an array of LuaTuples
					if (iteratorType.isUnionOrIntersection()) {
						for (const subType of iteratorType.types) {
							if (isLuaTuple(subType, typeCache)) {
								context.report({
									fix: createDestructuringFix(declarator, sourceCode),
									messageId: "lua-tuple-declaration",
									node: declarator,
								});
								return;
							}
						}
					}

					// For direct iteration, check type arguments
					const { typeArguments } = iteratorType as { typeArguments?: ReadonlyArray<Type> };
					if (typeArguments !== undefined && typeArguments.length > 0) {
						const [elementType] = typeArguments;
						if (elementType !== undefined && isLuaTuple(elementType, typeCache)) {
							context.report({
								fix: createDestructuringFix(declarator, sourceCode),
								messageId: "lua-tuple-declaration",
								node: declarator,
							});
						}
					}
				}
			},

			// LuaTuple in logical expressions (&&, ||)
			LogicalExpression(node: TSESTree.LogicalExpression): void {
				// Check left operand
				if (isNodeLuaTuple(node.left, nodeCache, typeCache, getTypeAtLocation)) {
					context.report({
						fix: createIndexAccessFix(node.left, sourceCode),
						messageId: "misleading-lua-tuple-check",
						node: node.left,
					});
				}

				// Check right operand
				if (isNodeLuaTuple(node.right, nodeCache, typeCache, getTypeAtLocation)) {
					context.report({
						fix: createIndexAccessFix(node.right, sourceCode),
						messageId: "misleading-lua-tuple-check",
						node: node.right,
					});
				}
			},

			// LuaTuple in unary negation (!)
			'UnaryExpression[operator="!"]'(node: TSESTree.UnaryExpression): void {
				if (isNodeLuaTuple(node.argument, nodeCache, typeCache, getTypeAtLocation)) {
					context.report({
						fix: createIndexAccessFix(node.argument, sourceCode),
						messageId: "misleading-lua-tuple-check",
						node: node.argument,
					});
				}
			},

			// LuaTuple variable declarations without destructuring
			'VariableDeclarator[id.type="Identifier"]'(node: TSESTree.VariableDeclarator): void {
				// Skip if already in for-of (handled separately)
				if (isInForOfLeft(node)) return;

				const { init } = node;
				if (init === null || init === undefined) return;

				if (isNodeLuaTuple(init, nodeCache, typeCache, getTypeAtLocation)) {
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
