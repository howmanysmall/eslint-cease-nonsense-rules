import { TSESTree } from "@typescript-eslint/types";
import type { TSESLint } from "@typescript-eslint/utils";

export interface ReactKeysOptions {
	readonly allowRootKeys?: boolean;
	readonly ignoreCallExpressions?: ReadonlyArray<string>;
	readonly iterationMethods?: ReadonlyArray<string>;
	readonly memoizationHooks?: ReadonlyArray<string>;
}

type Options = [ReactKeysOptions?];
type MessageIds = "missingKey" | "rootComponentWithKey";

const DEFAULT_OPTIONS: Required<ReactKeysOptions> = {
	allowRootKeys: false,
	ignoreCallExpressions: ["ReactTree.mount", "CreateReactStory"],
	iterationMethods: [
		"map",
		"filter",
		"forEach",
		"flatMap",
		"reduce",
		"reduceRight",
		"some",
		"every",
		"find",
		"findIndex",
	],
	memoizationHooks: ["useCallback", "useMemo"],
};

const WRAPPER_PARENT_TYPES = new Set([
	"ParenthesizedExpression",
	"TSAsExpression",
	"TSSatisfiesExpression",
	"TSTypeAssertion",
	"TSNonNullExpression",
	"TSInstantiationExpression",
	"ChainExpression",
]);

const ARGUMENT_WRAPPER_TYPES = new Set([
	...WRAPPER_PARENT_TYPES,
	"AwaitExpression",
	"ConditionalExpression",
	"LogicalExpression",
	"SequenceExpression",
	"SpreadElement",
]);

type FunctionLike = TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression | TSESTree.FunctionDeclaration;

interface RuleDocsWithRecommended extends TSESLint.RuleMetaDataDocs {
	readonly recommended?: boolean;
}

function ascendPastWrappers(node: TSESTree.Node | undefined): TSESTree.Node | undefined {
	let current = node;
	while (current && WRAPPER_PARENT_TYPES.has(current.type)) current = current.parent;
	return current;
}

function hasKeyAttribute(node: TSESTree.JSXElement): boolean {
	for (const attribute of node.openingElement.attributes)
		if (attribute.type === TSESTree.AST_NODE_TYPES.JSXAttribute && attribute.name.name === "key") return true;

	return false;
}

function isReactComponentHOC(callExpr: TSESTree.CallExpression): boolean {
	const { callee } = callExpr;

	if (callee.type === TSESTree.AST_NODE_TYPES.Identifier)
		return callee.name === "forwardRef" || callee.name === "memo";

	if (
		callee.type === TSESTree.AST_NODE_TYPES.MemberExpression &&
		callee.object.type === TSESTree.AST_NODE_TYPES.Identifier &&
		callee.object.name === "React" &&
		callee.property.type === TSESTree.AST_NODE_TYPES.Identifier
	)
		return callee.property.name === "forwardRef" || callee.property.name === "memo";

	return false;
}

function getEnclosingFunctionLike(node: TSESTree.Node): FunctionLike | undefined {
	let current: TSESTree.Node | undefined = node.parent;

	while (current) {
		if (
			current.type === TSESTree.AST_NODE_TYPES.ArrowFunctionExpression ||
			current.type === TSESTree.AST_NODE_TYPES.FunctionExpression ||
			current.type === TSESTree.AST_NODE_TYPES.FunctionDeclaration
		)
			return current;

		current = current.parent;
	}

	return undefined;
}

function isIterationOrMemoCallback(
	callExpr: TSESTree.CallExpression,
	iterationMethods: Set<string>,
	memoizationHooks: Set<string>,
): boolean {
	const { callee } = callExpr;

	if (callee.type === TSESTree.AST_NODE_TYPES.Identifier && memoizationHooks.has(callee.name)) return true;

	if (
		callee.type === TSESTree.AST_NODE_TYPES.MemberExpression &&
		callee.property.type === TSESTree.AST_NODE_TYPES.Identifier
	) {
		const methodName = callee.property.name;

		if (iterationMethods.has(methodName)) return true;

		if (
			methodName === "from" &&
			callee.object.type === TSESTree.AST_NODE_TYPES.MemberExpression &&
			callee.object.object.type === TSESTree.AST_NODE_TYPES.Identifier &&
			callee.object.object.name === "Array" &&
			callExpr.arguments.length >= 2
		) {
			return true;
		}

		if (
			methodName === "call" &&
			callee.object.type === TSESTree.AST_NODE_TYPES.MemberExpression &&
			callee.object.object.type === TSESTree.AST_NODE_TYPES.MemberExpression &&
			callee.object.object.property.type === TSESTree.AST_NODE_TYPES.Identifier &&
			iterationMethods.has(callee.object.object.property.name)
		) {
			return true;
		}
	}

	return false;
}

function findEnclosingCallExpression(node: TSESTree.Node): TSESTree.CallExpression | undefined {
	let current: TSESTree.Node = node;
	let { parent } = node;

	while (parent) {
		if (parent.type === TSESTree.AST_NODE_TYPES.CallExpression) {
			for (const argument of parent.arguments) {
				if (argument === current) return parent;
				if (argument.type === TSESTree.AST_NODE_TYPES.SpreadElement && argument.argument === current) {
					return parent;
				}
			}
			return undefined;
		}

		if (ARGUMENT_WRAPPER_TYPES.has(parent.type)) {
			current = parent;
			({ parent } = parent);
			continue;
		}

		break;
	}

	return undefined;
}

function getVariableForFunction(
	context: TSESLint.RuleContext<MessageIds, Options>,
	functionLike: FunctionLike,
): TSESLint.Scope.Variable | undefined {
	if (functionLike.type === TSESTree.AST_NODE_TYPES.FunctionDeclaration) {
		const declared = context.sourceCode.getDeclaredVariables(functionLike);
		if (declared.length > 0) return declared[0];
		return undefined;
	}

	const { parent } = functionLike;
	if (!parent) return undefined;

	if (
		parent.type === TSESTree.AST_NODE_TYPES.VariableDeclarator ||
		parent.type === TSESTree.AST_NODE_TYPES.AssignmentExpression
	) {
		const declared = context.sourceCode.getDeclaredVariables(parent);
		if (declared.length > 0) return declared[0];
	}

	return undefined;
}

function referenceActsAsCallback(
	reference: TSESLint.Scope.Reference,
	iterationMethods: Set<string>,
	memoizationHooks: Set<string>,
): boolean {
	if (!reference.isRead()) return false;

	const callExpression = findEnclosingCallExpression(reference.identifier);
	if (!callExpression) return false;

	if (isReactComponentHOC(callExpression)) return false;

	return isIterationOrMemoCallback(callExpression, iterationMethods, memoizationHooks);
}

function isFunctionUsedAsCallback(
	context: TSESLint.RuleContext<MessageIds, Options>,
	functionLike: FunctionLike,
	iterationMethods: Set<string>,
	memoizationHooks: Set<string>,
): boolean {
	const inlineCall = findEnclosingCallExpression(functionLike);
	if (inlineCall) {
		if (isReactComponentHOC(inlineCall)) return false;
		return isIterationOrMemoCallback(inlineCall, iterationMethods, memoizationHooks);
	}

	const variable = getVariableForFunction(context, functionLike);
	if (!variable) return false;

	for (const reference of variable.references)
		if (referenceActsAsCallback(reference, iterationMethods, memoizationHooks)) return true;

	return false;
}

const SHOULD_ASCEND_TYPES = new Set<TSESTree.AST_NODE_TYPES>([
	TSESTree.AST_NODE_TYPES.ConditionalExpression,
	TSESTree.AST_NODE_TYPES.LogicalExpression,
]);
const IS_FUNCTION_EXPRESSION = new Set<TSESTree.AST_NODE_TYPES>([
	TSESTree.AST_NODE_TYPES.FunctionExpression,
	TSESTree.AST_NODE_TYPES.ArrowFunctionExpression,
]);
const CONTROL_FLOW_TYPES = new Set<TSESTree.AST_NODE_TYPES>([
	TSESTree.AST_NODE_TYPES.BlockStatement,
	TSESTree.AST_NODE_TYPES.IfStatement,
	TSESTree.AST_NODE_TYPES.SwitchStatement,
	TSESTree.AST_NODE_TYPES.SwitchCase,
	TSESTree.AST_NODE_TYPES.TryStatement,
	TSESTree.AST_NODE_TYPES.CatchClause,
	TSESTree.AST_NODE_TYPES.WhileStatement,
	TSESTree.AST_NODE_TYPES.DoWhileStatement,
	TSESTree.AST_NODE_TYPES.ForStatement,
	TSESTree.AST_NODE_TYPES.ForInStatement,
	TSESTree.AST_NODE_TYPES.ForOfStatement,
	TSESTree.AST_NODE_TYPES.LabeledStatement,
	TSESTree.AST_NODE_TYPES.WithStatement,
]);

function isTopLevelReturn(node: TSESTree.JSXElement | TSESTree.JSXFragment): boolean {
	let parent = ascendPastWrappers(node.parent);
	if (!parent) return false;

	if (parent.type === TSESTree.AST_NODE_TYPES.JSXExpressionContainer) parent = ascendPastWrappers(parent.parent);
	if (!parent) return false;

	while (parent && SHOULD_ASCEND_TYPES.has(parent.type)) parent = ascendPastWrappers(parent.parent);
	if (!parent) return false;

	if (parent.type === TSESTree.AST_NODE_TYPES.JSXExpressionContainer) parent = ascendPastWrappers(parent.parent);
	if (!parent) return false;

	if (parent.type === TSESTree.AST_NODE_TYPES.ReturnStatement) {
		let currentNode: TSESTree.Node | undefined = ascendPastWrappers(parent.parent);

		// Ascend through control flow statements (if, switch, try, loops, etc.)
		while (currentNode && CONTROL_FLOW_TYPES.has(currentNode.type)) {
			currentNode = ascendPastWrappers(currentNode.parent);
		}

		if (!currentNode) return false;

		if (IS_FUNCTION_EXPRESSION.has(currentNode.type)) {
			const functionParent = ascendPastWrappers(currentNode.parent);
			if (functionParent?.type === TSESTree.AST_NODE_TYPES.CallExpression) {
				return isReactComponentHOC(functionParent);
			}
			return true;
		}

		return currentNode.type === TSESTree.AST_NODE_TYPES.FunctionDeclaration;
	}

	if (parent.type === TSESTree.AST_NODE_TYPES.ArrowFunctionExpression) {
		const functionParent = ascendPastWrappers(parent.parent);
		if (functionParent?.type === TSESTree.AST_NODE_TYPES.CallExpression) return isReactComponentHOC(functionParent);
		return true;
	}

	return false;
}

function isIgnoredCallExpression(
	node: TSESTree.JSXElement | TSESTree.JSXFragment,
	ignoreList: ReadonlyArray<string>,
): boolean {
	// oxlint-disable-next-line prefer-destructuring - not possible
	let parent: TSESTree.Node | undefined = node.parent;
	if (!parent) return false;

	if (parent.type === TSESTree.AST_NODE_TYPES.JSXExpressionContainer) {
		({ parent } = parent);
		if (!parent) return false;
	}

	const maxDepth = 20;
	for (let depth = 0; depth < maxDepth && parent; depth += 1) {
		const { type } = parent;

		if (type === TSESTree.AST_NODE_TYPES.CallExpression) {
			const { callee } = parent;
			if (callee.type === TSESTree.AST_NODE_TYPES.Identifier) return ignoreList.includes(callee.name);

			if (
				callee.type === TSESTree.AST_NODE_TYPES.MemberExpression &&
				callee.object.type === TSESTree.AST_NODE_TYPES.Identifier &&
				callee.property.type === TSESTree.AST_NODE_TYPES.Identifier
			) {
				return ignoreList.includes(`${callee.object.name}.${callee.property.name}`);
			}

			return false;
		}

		({ parent } = parent);
	}

	return false;
}

function isJSXPropValue(node: TSESTree.JSXElement | TSESTree.JSXFragment): boolean {
	let { parent } = node;
	if (!parent) return false;

	while (
		parent &&
		(parent.type === TSESTree.AST_NODE_TYPES.ConditionalExpression ||
			parent.type === TSESTree.AST_NODE_TYPES.LogicalExpression)
	) {
		({ parent } = parent);
	}

	if (!parent) return false;

	if (parent.type === TSESTree.AST_NODE_TYPES.JSXExpressionContainer) {
		({ parent } = parent);
		if (!parent) return false;
	}

	return parent.type === TSESTree.AST_NODE_TYPES.JSXAttribute;
}

/**
 * Checks if node is inside a ternary expression that's a direct child of a JSX
 * element. Ternary branches are mutually exclusive alternatives (only one
 * renders), so they don't need keys.
 *
 * Example: `{condition ? <A /> : <B />}` - A and B don't need keys
 *
 * Note: Logical AND (`&&`) is NOT included because those elements can
 * appear/disappear, affecting sibling positions and requiring keys.
 *
 * @param node - The JSX element or fragment to check.
 * @returns Whether the node is inside a ternary expression as a JSX child.
 */
function isTernaryJSXChild(node: TSESTree.JSXElement | TSESTree.JSXFragment): boolean {
	let current: TSESTree.Node | undefined = node.parent;
	if (!current) return false;

	// Must be inside a ConditionalExpression (ternary), not LogicalExpression
	let foundTernary = false;
	while (
		current &&
		(current.type === TSESTree.AST_NODE_TYPES.ConditionalExpression || WRAPPER_PARENT_TYPES.has(current.type))
	) {
		if (current.type === TSESTree.AST_NODE_TYPES.ConditionalExpression) foundTernary = true;
		current = current.parent;
	}

	if (!(foundTernary && current)) return false;

	// Must be inside JSXExpressionContainer
	if (current.type !== TSESTree.AST_NODE_TYPES.JSXExpressionContainer) return false;

	const containerParent = current.parent;
	if (!containerParent) return false;

	// Must be a child of a JSX element or fragment
	return (
		containerParent.type === TSESTree.AST_NODE_TYPES.JSXElement ||
		containerParent.type === TSESTree.AST_NODE_TYPES.JSXFragment
	);
}

const docs: RuleDocsWithRecommended = {
	description: "Enforce key props on all React elements except top-level returns",
	recommended: true,
};

const requireReactComponentKeys: TSESLint.RuleModuleWithMetaDocs<MessageIds, Options, RuleDocsWithRecommended> = {
	create(context) {
		const options: Required<ReactKeysOptions> = {
			...DEFAULT_OPTIONS,
			...context.options[0],
		};

		const iterationMethods = new Set(options.iterationMethods);
		const memoizationHooks = new Set(options.memoizationHooks);

		function checkElement(node: TSESTree.JSXElement | TSESTree.JSXFragment): void {
			const functionLike = getEnclosingFunctionLike(node);
			const isCallback = functionLike
				? isFunctionUsedAsCallback(context, functionLike, iterationMethods, memoizationHooks)
				: false;
			const isRoot = isTopLevelReturn(node);

			if (isRoot && !isCallback) {
				if (
					!options.allowRootKeys &&
					node.type === TSESTree.AST_NODE_TYPES.JSXElement &&
					hasKeyAttribute(node)
				) {
					context.report({
						messageId: "rootComponentWithKey",
						node,
					});
				}
				return;
			}

			if (isIgnoredCallExpression(node, options.ignoreCallExpressions)) return;
			if (isJSXPropValue(node)) return;
			if (isTernaryJSXChild(node)) return;

			if (node.type === TSESTree.AST_NODE_TYPES.JSXFragment) {
				context.report({
					messageId: "missingKey",
					node,
				});
				return;
			}

			if (!hasKeyAttribute(node)) {
				context.report({
					messageId: "missingKey",
					node,
				});
			}
		}

		return {
			JSXElement(node) {
				checkElement(node);
			},

			JSXFragment(node) {
				checkElement(node);
			},
		};
	},
	defaultOptions: [DEFAULT_OPTIONS],
	meta: {
		docs,
		messages: {
			missingKey: "All React elements except top-level returns require a key prop",
			rootComponentWithKey: "Root component returns should not have key props",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					allowRootKeys: {
						default: false,
						description: "Allow key props on root component returns",
						type: "boolean",
					},
					ignoreCallExpressions: {
						default: ["ReactTree.mount"],
						description: "Function calls where JSX arguments don't need keys",
						items: { type: "string" },
						type: "array",
					},
					iterationMethods: {
						default: [
							"map",
							"filter",
							"forEach",
							"flatMap",
							"reduce",
							"reduceRight",
							"some",
							"every",
							"find",
							"findIndex",
						],
						description: "Array method names that indicate iteration contexts where keys are required",
						items: { type: "string" },
						type: "array",
					},
					memoizationHooks: {
						default: ["useCallback", "useMemo"],
						description: "Hook names that indicate memoization contexts where keys are required",
						items: { type: "string" },
						type: "array",
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
};

export default requireReactComponentKeys;
