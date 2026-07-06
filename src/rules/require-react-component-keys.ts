import { createRule } from "$utilities/create-rule";
import { getDefinedValue } from "$utilities/defined-utilities";
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
interface CallbackUsage {
	iteration: boolean;
	memoization: boolean;
}

const EMPTY_CALLBACK_USAGE: CallbackUsage = {
	iteration: false,
	memoization: false,
};

function ascendPastWrappers(node: TSESTree.Node): TSESTree.Node;
function ascendPastWrappers(node: TSESTree.Node | undefined): TSESTree.Node | undefined;
function ascendPastWrappers(node: TSESTree.Node | undefined): TSESTree.Node | undefined {
	let current = node;
	while (current && WRAPPER_PARENT_TYPES.has(current.type)) current = current.parent;
	return current;
}

function getParentOrSelf(node: TSESTree.Node): TSESTree.Node {
	const { parent = node } = node;
	return parent;
}

function hasKeyAttribute(node: TSESTree.JSXElement): boolean {
	for (const attribute of node.openingElement.attributes) {
		if (attribute.type === TSESTree.AST_NODE_TYPES.JSXAttribute && attribute.name.name === "key") return true;
	}

	return false;
}

function isHigherOrderComponent(callExpr: TSESTree.CallExpression): boolean {
	const { callee } = callExpr;

	if (callee.type === TSESTree.AST_NODE_TYPES.Identifier) {
		return callee.name === "forwardRef" || callee.name === "memo";
	}

	if (
		callee.type === TSESTree.AST_NODE_TYPES.MemberExpression &&
		callee.object.type === TSESTree.AST_NODE_TYPES.Identifier &&
		callee.object.name === "React" &&
		callee.property.type === TSESTree.AST_NODE_TYPES.Identifier
	) {
		return callee.property.name === "forwardRef" || callee.property.name === "memo";
	}

	return false;
}

function getEnclosingFunctionLike(node: TSESTree.Node): FunctionLike | undefined {
	let current: TSESTree.Node | undefined = node.parent;

	while (current) {
		if (
			current.type === TSESTree.AST_NODE_TYPES.ArrowFunctionExpression ||
			current.type === TSESTree.AST_NODE_TYPES.FunctionExpression ||
			current.type === TSESTree.AST_NODE_TYPES.FunctionDeclaration
		) {
			return current;
		}

		current = current.parent;
	}

	return undefined;
}

function getCallbackUsageFromCallExpression(
	callExpression: TSESTree.CallExpression,
	iterationMethods: Set<string>,
	memoizationHooks: Set<string>,
): CallbackUsage {
	const { callee } = callExpression;
	let usage: CallbackUsage = {
		iteration: false,
		memoization: false,
	};

	if (callee.type === TSESTree.AST_NODE_TYPES.Identifier) {
		usage = {
			iteration: iterationMethods.has(callee.name),
			memoization: memoizationHooks.has(callee.name),
		};

		return usage;
	}

	if (
		callee.type === TSESTree.AST_NODE_TYPES.MemberExpression &&
		callee.property.type === TSESTree.AST_NODE_TYPES.Identifier
	) {
		const { name } = callee.property;
		usage = {
			iteration: iterationMethods.has(name),
			memoization: memoizationHooks.has(name),
		};

		if (
			name === "from" &&
			callee.object.type === TSESTree.AST_NODE_TYPES.Identifier &&
			callee.object.name === "Array" &&
			callExpression.arguments.length >= 2
		) {
			return {
				...usage,
				iteration: true,
			};
		}

		if (
			name === "call" &&
			callee.object.type === TSESTree.AST_NODE_TYPES.MemberExpression &&
			callee.object.property.type === TSESTree.AST_NODE_TYPES.Identifier &&
			iterationMethods.has(callee.object.property.name)
		) {
			return {
				...usage,
				iteration: true,
			};
		}
	}

	return usage;
}

function isCurrentCallArgument(argument: TSESTree.CallExpressionArgument, current: TSESTree.Node): boolean {
	if (argument === current) return true;

	return argument.type === TSESTree.AST_NODE_TYPES.SpreadElement && argument.argument === current;
}

function isMissingNode(node: TSESTree.Node | null | undefined): node is null | undefined {
	return node === undefined || node === null;
}

function findEnclosingCallExpression(node: TSESTree.Node): TSESTree.CallExpression | undefined {
	let current: TSESTree.Node = node;
	let { parent } = node;

	while (!isMissingNode(parent)) {
		if (parent.type === TSESTree.AST_NODE_TYPES.CallExpression) {
			for (const argument of parent.arguments) {
				if (isCurrentCallArgument(argument, current)) return parent;
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

	if (
		parent.type === TSESTree.AST_NODE_TYPES.VariableDeclarator ||
		parent.type === TSESTree.AST_NODE_TYPES.AssignmentExpression
	) {
		const declared = context.sourceCode.getDeclaredVariables(parent);
		if (declared.length > 0) return declared[0];
	}

	return undefined;
}

function mergeCallbackUsage(target: CallbackUsage, usage: CallbackUsage): void {
	target.iteration ||= usage.iteration;
	target.memoization ||= usage.memoization;
}

function getCallbackUsageFromReference(
	reference: TSESLint.Scope.Reference,
	iterationMethods: Set<string>,
	memoizationHooks: Set<string>,
): CallbackUsage {
	if (!reference.isRead()) return EMPTY_CALLBACK_USAGE;

	const callExpression = findEnclosingCallExpression(reference.identifier);
	if (!callExpression) return EMPTY_CALLBACK_USAGE;

	if (isHigherOrderComponent(callExpression)) return EMPTY_CALLBACK_USAGE;

	return getCallbackUsageFromCallExpression(callExpression, iterationMethods, memoizationHooks);
}

function getFunctionCallbackUsage(
	context: TSESLint.RuleContext<MessageIds, Options>,
	functionLike: FunctionLike,
	iterationMethods: Set<string>,
	memoizationHooks: Set<string>,
): CallbackUsage {
	const inlineCall = findEnclosingCallExpression(functionLike);
	if (inlineCall) {
		if (isHigherOrderComponent(inlineCall)) return EMPTY_CALLBACK_USAGE;
		return getCallbackUsageFromCallExpression(inlineCall, iterationMethods, memoizationHooks);
	}

	const variable = getVariableForFunction(context, functionLike);
	if (!variable) return EMPTY_CALLBACK_USAGE;

	const usage: CallbackUsage = {
		iteration: false,
		memoization: false,
	};

	for (const reference of variable.references) {
		mergeCallbackUsage(usage, getCallbackUsageFromReference(reference, iterationMethods, memoizationHooks));
		if (usage.iteration && usage.memoization) return usage;
	}

	return usage;
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

const CHILD_PROP_NAME_SUFFIX = "children";

function isTopLevelFunctionReturn(node: TSESTree.JSXElement | TSESTree.JSXFragment): boolean {
	let parent = ascendPastWrappers(getParentOrSelf(node));

	if (parent.type === TSESTree.AST_NODE_TYPES.JSXExpressionContainer) {
		parent = ascendPastWrappers(getParentOrSelf(parent));
	}

	while (SHOULD_ASCEND_TYPES.has(parent.type)) parent = ascendPastWrappers(getParentOrSelf(parent));

	if (parent.type === TSESTree.AST_NODE_TYPES.JSXExpressionContainer) {
		parent = ascendPastWrappers(getParentOrSelf(parent));
	}

	if (parent.type === TSESTree.AST_NODE_TYPES.ReturnStatement) {
		let currentNode = ascendPastWrappers(getParentOrSelf(parent));

		while (CONTROL_FLOW_TYPES.has(currentNode.type)) {
			currentNode = ascendPastWrappers(getParentOrSelf(currentNode));
		}

		return (
			IS_FUNCTION_EXPRESSION.has(currentNode.type) ||
			currentNode.type === TSESTree.AST_NODE_TYPES.FunctionDeclaration
		);
	}

	return parent.type === TSESTree.AST_NODE_TYPES.ArrowFunctionExpression;
}

function isTopLevelReturn(node: TSESTree.JSXElement | TSESTree.JSXFragment): boolean {
	if (!isTopLevelFunctionReturn(node)) return false;

	const functionLike = getDefinedValue(
		getEnclosingFunctionLike(node),
		"Expected top-level return to have a function.",
	);

	const functionParent = ascendPastWrappers(getParentOrSelf(functionLike));
	if (functionParent?.type === TSESTree.AST_NODE_TYPES.CallExpression) {
		return isHigherOrderComponent(functionParent);
	}

	return true;
}

function isIgnoredCallExpression(
	node: TSESTree.JSXElement | TSESTree.JSXFragment,
	ignoreList: ReadonlyArray<string>,
): boolean {
	// oxlint-disable-next-line prefer-destructuring -- parent is reassigned while walking ancestors.
	let parent: TSESTree.Node | undefined = node.parent;

	if (parent.type === TSESTree.AST_NODE_TYPES.JSXExpressionContainer) {
		({ parent } = parent);
	}

	const maxDepth = 20;
	for (let depth = 0; depth < maxDepth && !isMissingNode(parent); depth += 1) {
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

function getJSXAttributeName(attribute: TSESTree.JSXAttribute): string {
	const { name } = attribute;

	if (name.type === TSESTree.AST_NODE_TYPES.JSXNamespacedName) {
		const localName = name.name;
		return localName.name;
	}

	return name.name;
}

function isChildrenAttributeName(attributeName: string): boolean {
	return attributeName.toLowerCase().endsWith(CHILD_PROP_NAME_SUFFIX);
}

function isJsxPropertyValue(node: TSESTree.JSXElement | TSESTree.JSXFragment): boolean {
	let { parent } = node;

	while (
		!isMissingNode(parent) &&
		(parent.type === TSESTree.AST_NODE_TYPES.ConditionalExpression ||
			parent.type === TSESTree.AST_NODE_TYPES.LogicalExpression)
	) {
		({ parent } = parent);
	}

	if (parent.type === TSESTree.AST_NODE_TYPES.JSXExpressionContainer) {
		({ parent } = parent);
	}

	if (parent.type !== TSESTree.AST_NODE_TYPES.JSXAttribute) return false;

	const attributeName = getJSXAttributeName(parent);
	return !isChildrenAttributeName(attributeName);
}

function isTernaryJSXChild(node: TSESTree.JSXElement | TSESTree.JSXFragment): boolean {
	let current: TSESTree.Node | undefined = node.parent;

	// Must be inside a ConditionalExpression (ternary), not LogicalExpression
	let foundTernary = false;
	while (
		!isMissingNode(current) &&
		(current.type === TSESTree.AST_NODE_TYPES.ConditionalExpression || WRAPPER_PARENT_TYPES.has(current.type))
	) {
		if (current.type === TSESTree.AST_NODE_TYPES.ConditionalExpression) foundTernary = true;
		current = current.parent;
	}

	if (!foundTernary || isMissingNode(current)) return false;

	// Must be inside JSXExpressionContainer
	if (current.type !== TSESTree.AST_NODE_TYPES.JSXExpressionContainer) return false;

	const containerParent = current.parent;

	// Must be a child of a JSX element or fragment
	return (
		containerParent.type === TSESTree.AST_NODE_TYPES.JSXElement ||
		containerParent.type === TSESTree.AST_NODE_TYPES.JSXFragment
	);
}

function isLogicalJSXChild(node: TSESTree.JSXElement | TSESTree.JSXFragment): boolean {
	let current: TSESTree.Node | undefined = node.parent;

	let foundLogical = false;
	while (
		!isMissingNode(current) &&
		(current.type === TSESTree.AST_NODE_TYPES.LogicalExpression || WRAPPER_PARENT_TYPES.has(current.type))
	) {
		if (current.type === TSESTree.AST_NODE_TYPES.LogicalExpression) foundLogical = true;
		current = current.parent;
	}

	if (!foundLogical || isMissingNode(current)) return false;

	if (current.type !== TSESTree.AST_NODE_TYPES.JSXExpressionContainer) return false;

	const containerParent = current.parent;

	return (
		containerParent.type === TSESTree.AST_NODE_TYPES.JSXElement ||
		containerParent.type === TSESTree.AST_NODE_TYPES.JSXFragment
	);
}

const requireReactComponentKeys = createRule<Options, MessageIds>({
	create(context) {
		const options: Required<ReactKeysOptions> = {
			...DEFAULT_OPTIONS,
			...context.options[0],
		};

		const iterationMethods = new Set(options.iterationMethods);
		const memoizationHooks = new Set(options.memoizationHooks);

		function checkElement(node: TSESTree.JSXElement | TSESTree.JSXFragment): void {
			const functionLike = getEnclosingFunctionLike(node);
			const callbackUsage = functionLike
				? getFunctionCallbackUsage(context, functionLike, iterationMethods, memoizationHooks)
				: EMPTY_CALLBACK_USAGE;
			const isCallback = callbackUsage.iteration || callbackUsage.memoization;
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
			if (isJsxPropertyValue(node)) return;
			if (isTernaryJSXChild(node)) return;
			if (node.type === TSESTree.AST_NODE_TYPES.JSXFragment && isLogicalJSXChild(node)) return;
			if (
				node.type === TSESTree.AST_NODE_TYPES.JSXFragment &&
				callbackUsage.memoization &&
				!callbackUsage.iteration &&
				isTopLevelFunctionReturn(node)
			) {
				return;
			}

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
			JSXElement(node): void {
				checkElement(node);
			},

			JSXFragment(node): void {
				checkElement(node);
			},
		};
	},
	meta: {
		defaultOptions: [DEFAULT_OPTIONS],
		docs: {
			description: "Require keys on React components when used in lists or iteration.",
		},
		messages: {
			missingKey:
				"JSX element in list/callback lacks key prop. React Luau warns about missing keys in _G.__DEV__ mode. Add a unique `key` prop using a stable identifier (not array index).",
			rootComponentWithKey:
				"Root return has unnecessary key prop. The key gets overwritten by the parent anyway. Remove the `key` prop.",
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
	name: "require-react-component-keys",
});

export default requireReactComponentKeys;
