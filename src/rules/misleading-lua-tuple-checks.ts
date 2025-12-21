import { AST_NODE_TYPES } from "@typescript-eslint/types";
import type { TSESTree } from "@typescript-eslint/utils";
import { ESLintUtils } from "@typescript-eslint/utils";
import type { ReportFixFunction, RuleFixer, SourceCode } from "@typescript-eslint/utils/ts-eslint";
import type { Type } from "typescript";

type MessageIds = "misleading-lua-tuple-check" | "lua-tuple-declaration";

const createRule = ESLintUtils.RuleCreator((name) => `https://github.com/howmanysmall/eslint-cease-nonsense-rules#${name}`);

/**
 * Checks if a TypeScript type is a LuaTuple.
 *
 * Uses multi-level caching for performance:
 * 1. Fast-path: Check aliasSymbol.escapedName === "LuaTuple"
 * 2. Only resolve constraints for type parameters (rare case)
 *
 * @param type - The TypeScript type to check
 * @param typeCache - WeakMap cache for type results
 * @returns True if the type is a LuaTuple
 */
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
			if (isLuaTuple(subType, typeCache)) {
				typeCache.set(type, true);
				return true;
			}
		}
	}

	typeCache.set(type, false);
	return false;
}

/**
 * Gets the type of an ESTree node.
 *
 * @param node - The ESTree node
 * @param nodeCache - WeakMap cache for node results
 * @param typeCache - WeakMap cache for type results
 * @param getTypeAtLocation - Function to get TS type from ESTree node
 * @returns True if the node's type is a LuaTuple
 */
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

/**
 * Creates a fixer function that wraps an identifier in array destructuring.
 *
 * @param node - The VariableDeclarator or AssignmentExpression node
 * @param sourceCode - The ESLint source code object
 * @returns A fixer function
 */
function createDestructuringFix(
	node: TSESTree.VariableDeclarator | TSESTree.AssignmentExpression,
	sourceCode: SourceCode,
): ReportFixFunction {
	return (fixer: RuleFixer) => {
		if (node.type === AST_NODE_TYPES.VariableDeclarator) {
			// Const result = foo() → const [result] = foo()
			// Const result: Type = foo() → const [result]: Type = foo()
			const { id } = node;
			if (id.type !== AST_NODE_TYPES.Identifier) {
				return null;
			}

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
		if (left.type !== AST_NODE_TYPES.Identifier) {
			return null;
		}

		const leftText = sourceCode.getText(left);
		return fixer.replaceText(left, `[${leftText}]`);
	};
}

/**
 * Creates a fixer function that adds [0] to access the first element.
 *
 * @param node - The expression node to fix
 * @param sourceCode - The ESLint source code object
 * @returns A fixer function
 */
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

/**
 * Checks if a node is inside a for-of statement's left side.
 *
 * @param node - The node to check
 * @returns True if inside for-of left
 */
function isInForOfLeft(node: TSESTree.Node): boolean {
	let current: TSESTree.Node | undefined = node;
	while (current !== undefined) {
		// eslint-disable-next-line prefer-destructuring -- Cannot destructure; parent is reassigned to current
		const parent: TSESTree.Node | undefined = current.parent;
		if (parent === undefined) break;

		if (parent.type === AST_NODE_TYPES.ForOfStatement && parent.left === current) return true;

		current = parent;
	}
	return false;
}

export default createRule<[], MessageIds>({
	create(context) {
		const { sourceCode } = context;
		const parserServices = ESLintUtils.getParserServices(context);
		const checker = parserServices.program.getTypeChecker();

		// Multi-level caching
		const nodeCache = new WeakMap<TSESTree.Node, boolean>();
		const typeCache = new WeakMap<Type, boolean>();

		// Helper to get type at location
		function getTypeAtLocation(node: TSESTree.Node): Type {
			const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);
			return checker.getTypeAtLocation(tsNode);
		}

		return {
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
					const iteratorType = checker.getTypeAtLocation(
						parserServices.esTreeNodeToTSNodeMap.get(right),
					);

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
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description:
				"Detects misleading LuaTuple usage in conditional and logical expressions. " +
				"LuaTuple (array) is always truthy, which can lead to bugs when checking the first element.",
		},
		fixable: "code",
		messages: {
			"lua-tuple-declaration": "Unexpected LuaTuple in declaration, use array destructuring.",
			"misleading-lua-tuple-check": "Unexpected LuaTuple in conditional expression. Add [0].",
		},
		schema: [],
		type: "problem",
	},
	name: "misleading-lua-tuple-checks",
});
