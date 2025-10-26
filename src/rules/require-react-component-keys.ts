import { TSESTree } from "@typescript-eslint/types";
import type { TSESLint } from "@typescript-eslint/utils";

interface RuleOptions {
	readonly allowRootKeys?: boolean;
	readonly ignoreCallExpressions?: Array<string>;
	readonly iterationMethods?: Array<string>;
	readonly memoizationHooks?: Array<string>;
}

type Options = [RuleOptions?];
type MessageIds = "missingKey" | "rootComponentWithKey";

const DEFAULT_OPTIONS: Required<RuleOptions> = {
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
		if (attribute.type === "JSXAttribute" && attribute.name.name === "key") return true;

	return false;
}

function isReactComponentHOC(callExpr: TSESTree.CallExpression): boolean {
	const { callee } = callExpr;

	if (callee.type === "Identifier") return callee.name === "forwardRef" || callee.name === "memo";

	if (
		callee.type === "MemberExpression" &&
		callee.object.type === "Identifier" &&
		callee.object.name === "React" &&
		callee.property.type === "Identifier"
	)
		return callee.property.name === "forwardRef" || callee.property.name === "memo";

	return false;
}

function getEnclosingFunctionLike(node: TSESTree.Node): FunctionLike | undefined {
	let current: TSESTree.Node | undefined = node.parent;

	while (current) {
		if (
			current.type === "ArrowFunctionExpression" ||
			current.type === "FunctionExpression" ||
			current.type === "FunctionDeclaration"
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

	if (callee.type === "Identifier" && memoizationHooks.has(callee.name)) return true;

	if (callee.type === "MemberExpression" && callee.property.type === "Identifier") {
		const methodName = callee.property.name;

		if (iterationMethods.has(methodName)) return true;

		if (
			methodName === "from" &&
			callee.object.type === "MemberExpression" &&
			callee.object.object.type === "Identifier" &&
			callee.object.object.name === "Array" &&
			callExpr.arguments.length >= 2
		)
			return true;

		if (
			methodName === "call" &&
			callee.object.type === "MemberExpression" &&
			callee.object.object.type === "MemberExpression" &&
			callee.object.object.property.type === "Identifier" &&
			iterationMethods.has(callee.object.object.property.name)
		)
			return true;
	}

	return false;
}

function findEnclosingCallExpression(node: TSESTree.Node): TSESTree.CallExpression | undefined {
	let current: TSESTree.Node = node;
	let parent = node.parent;

	while (parent) {
		if (parent.type === "CallExpression") {
			for (const argument of parent.arguments) {
				if (argument === current) return parent;
				if (argument.type === "SpreadElement" && argument.argument === current) return parent;
			}
			return undefined;
		}

		if (ARGUMENT_WRAPPER_TYPES.has(parent.type)) {
			current = parent;
			parent = parent.parent;
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

	const parent = functionLike.parent;
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
	fn: FunctionLike,
	iterationMethods: Set<string>,
	memoizationHooks: Set<string>,
): boolean {
	const inlineCall = findEnclosingCallExpression(fn);
	if (inlineCall) {
		if (isReactComponentHOC(inlineCall)) return false;
		return isIterationOrMemoCallback(inlineCall, iterationMethods, memoizationHooks);
	}

	const variable = getVariableForFunction(context, fn);
	if (!variable) return false;

	for (const reference of variable.references)
		if (referenceActsAsCallback(reference, iterationMethods, memoizationHooks)) return true;

	return false;
}

function isTopLevelReturn(node: TSESTree.JSXElement | TSESTree.JSXFragment): boolean {
	let parent = ascendPastWrappers(node.parent);
	if (!parent) return false;

	if (parent.type === "JSXExpressionContainer") parent = ascendPastWrappers(parent.parent);
	if (!parent) return false;

	while (parent && (parent.type === "ConditionalExpression" || parent.type === "LogicalExpression"))
		parent = ascendPastWrappers(parent.parent);

	if (!parent) return false;

	if (parent.type === "JSXExpressionContainer") parent = ascendPastWrappers(parent.parent);
	if (!parent) return false;

	if (parent.type === "ReturnStatement") {
		let currentNode: TSESTree.Node | undefined = ascendPastWrappers(parent.parent);
		if (currentNode?.type === "BlockStatement") currentNode = ascendPastWrappers(currentNode.parent);
		if (!currentNode) return false;

		if (currentNode.type === "ArrowFunctionExpression" || currentNode.type === "FunctionExpression") {
			const functionParent = ascendPastWrappers(currentNode.parent);
			if (functionParent?.type === "CallExpression") return isReactComponentHOC(functionParent);
			return true;
		}

		return currentNode.type === "FunctionDeclaration";
	}

	if (parent.type === "ArrowFunctionExpression") {
		const functionParent = ascendPastWrappers(parent.parent);
		if (functionParent?.type === "CallExpression") return isReactComponentHOC(functionParent);
		return true;
	}

	return false;
}

function isIgnoredCallExpression(node: TSESTree.JSXElement | TSESTree.JSXFragment, ignoreList: string[]): boolean {
	let parent: TSESTree.Node | undefined = node.parent;
	if (!parent) return false;

	if (parent.type === "JSXExpressionContainer") {
		parent = parent.parent;
		if (!parent) return false;
	}

	const maxDepth = 20;
	for (let depth = 0; depth < maxDepth && parent; depth++) {
		const { type } = parent;

		if (type === "CallExpression") {
			const { callee } = parent;

			if (callee.type === "Identifier") return ignoreList.includes(callee.name);

			if (
				callee.type === "MemberExpression" &&
				callee.object.type === "Identifier" &&
				callee.property.type === "Identifier"
			)
				return ignoreList.includes(`${callee.object.name}.${callee.property.name}`);

			return false;
		}

		parent = parent.parent;
	}

	return false;
}

function isJSXPropValue(node: TSESTree.JSXElement | TSESTree.JSXFragment): boolean {
	let parent = node.parent;
	if (!parent) return false;

	while (parent && (parent.type === "ConditionalExpression" || parent.type === "LogicalExpression"))
		parent = parent.parent;

	if (!parent) return false;

	if (parent.type === "JSXExpressionContainer") {
		parent = parent.parent;
		if (!parent) return false;
	}

	return parent.type === "JSXAttribute";
}

const docs: RuleDocsWithRecommended = {
	description: "Enforce key props on all React elements except top-level returns",
	recommended: true,
};

const requireReactComponentKeys: TSESLint.RuleModuleWithMetaDocs<MessageIds, Options, RuleDocsWithRecommended> = {
	create(context) {
		const options: Required<RuleOptions> = {
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
				if (!options.allowRootKeys && node.type === "JSXElement" && hasKeyAttribute(node)) {
					context.report({
						messageId: "rootComponentWithKey",
						node,
					});
				}
				return;
			}

			if (isIgnoredCallExpression(node, options.ignoreCallExpressions)) return;
			if (isJSXPropValue(node)) return;

			if (node.type === "JSXFragment") {
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
