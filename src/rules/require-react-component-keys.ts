import type { TSESTree } from "@typescript-eslint/types";
import type { TSESLint } from "@typescript-eslint/utils";

/**
 * Configuration options for the require-react-component-keys rule.
 */
interface RuleOptions {
	ignoreCallExpressions?: string[];
	allowRootKeys?: boolean;
}

type Options = [RuleOptions?];
type MessageIds = "missingKey" | "rootComponentWithKey";

/**
 * Default configuration values for the rule.
 */
const DEFAULT_OPTIONS: Required<RuleOptions> = {
	allowRootKeys: false,
	ignoreCallExpressions: ["ReactTree.mount", "CreateReactStory"],
};

/**
 * Parent node types that simply wrap another expression without changing its semantics.
 * These should be skipped when walking up the AST to analyze structural context.
 */
const WRAPPER_PARENT_TYPES = new Set([
	"ParenthesizedExpression",
	"TSAsExpression",
	"TSSatisfiesExpression",
	"TSTypeAssertion",
	"TSNonNullExpression",
	"TSInstantiationExpression",
	"ChainExpression",
]);

/**
 * Node types that act as transparent wrappers when walking from a call argument to its call expression.
 */
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
	recommended?: boolean;
}

/**
 * Walks up the AST from a starting node, skipping wrapper expressions that do not
 * materially affect JSX placement (e.g. parentheses, type assertions).
 *
 * @param node - The starting node whose wrappers should be skipped.
 * @returns The first ancestor node that is not a simple wrapper, or undefined.
 */
function ascendPastWrappers(node: TSESTree.Node | undefined): TSESTree.Node | undefined {
	let current = node;
	while (current && WRAPPER_PARENT_TYPES.has(current.type)) current = current.parent;
	return current;
}

/**
 * Checks if a JSX element has a key attribute.
 *
 * @param node - The JSX element to check.
 * @returns True if the element has a key attribute.
 */
function hasKeyAttribute(node: TSESTree.JSXElement): boolean {
	for (const attribute of node.openingElement.attributes)
		if (attribute.type === "JSXAttribute" && attribute.name.name === "key") return true;

	return false;
}

/**
 * Checks if a CallExpression is for React.forwardRef or React.memo.
 *
 * @param callExpr - The CallExpression to check.
 * @returns True if the call is for forwardRef or memo.
 */
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

/**
 * Finds the nearest function-like ancestor for a given node.
 *
 * @param node - The starting node.
 * @returns The nearest function declaration/expression/arrow function ancestor if any.
 */
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

/**
 * Walks upward from a potential call argument to find the enclosing CallExpression, if any.
 *
 * @param node - The starting node.
 * @returns The nearest CallExpression where the node participates as an argument.
 */
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

/**
 * Fetches the declared variable associated with a function-like node, if any.
 *
 * @param context - ESLint rule context.
 * @param fn - The function-like node.
 * @returns The corresponding scope variable, when available.
 */
function getVariableForFunction(
	context: TSESLint.RuleContext<MessageIds, Options>,
	fn: FunctionLike,
): TSESLint.Scope.Variable | undefined {
	if (fn.type === "FunctionDeclaration") {
		const declared = context.sourceCode.getDeclaredVariables(fn);
		if (declared.length > 0) return declared[0];
		return undefined;
	}

	const parent = fn.parent;
	if (!parent) return undefined;

	if (parent.type === "VariableDeclarator" || parent.type === "AssignmentExpression") {
		const declared = context.sourceCode.getDeclaredVariables(parent);
		if (declared.length > 0) return declared[0];
	}

	return undefined;
}

/**
 * Checks whether a scope reference is used as an argument to a call expression that is not a React HOC.
 *
 * @param reference - The reference to evaluate.
 * @returns True if the reference participates in a non-HOC call as an argument.
 */
function referenceActsAsCallback(reference: TSESLint.Scope.Reference): boolean {
	if (!reference.isRead()) return false;

	const callExpression = findEnclosingCallExpression(reference.identifier);
	if (!callExpression) return false;

	return !isReactComponentHOC(callExpression);
}

/**
 * Determines whether a function-like node is used as a callback (passed to a call expression),
 * excluding known React component HOCs.
 *
 * @param context - ESLint rule context.
 * @param fn - The function node to inspect.
 * @returns True if the function participates in callback invocations.
 */
function isFunctionUsedAsCallback(context: TSESLint.RuleContext<MessageIds, Options>, fn: FunctionLike): boolean {
	const inlineCall = findEnclosingCallExpression(fn);
	if (inlineCall && !isReactComponentHOC(inlineCall)) return true;

	const variable = getVariableForFunction(context, fn);
	if (!variable) return false;

	for (const reference of variable.references) if (referenceActsAsCallback(reference)) return true;

	return false;
}

/**
 * Checks if a JSX element is a top-level return from a component.
 *
 * @param node - The JSX element or fragment to check.
 * @returns True if the element is directly returned from a component.
 */
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

/**
 * Checks if a JSX element is an argument to an ignored call expression.
 *
 * @param node - The JSX element or fragment to check.
 * @param ignoreList - List of function names to ignore.
 * @returns True if the element is passed to an ignored function.
 */
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

/**
 * Checks if a JSX element is passed as a prop value.
 *
 * @param node - The JSX element or fragment to check.
 * @returns True if the element is passed as a prop value.
 */
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
	/**
	 * Creates the ESLint rule visitor.
	 *
	 * @param context - The ESLint rule context.
	 * @returns The visitor object with AST node handlers.
	 */
	create(context) {
		const options: Required<RuleOptions> = {
			...DEFAULT_OPTIONS,
			...context.options[0],
		};

		/**
		 * Checks a JSX element or fragment for required key prop.
		 *
		 * @param node - The JSX element or fragment to check.
		 */
		function checkElement(node: TSESTree.JSXElement | TSESTree.JSXFragment): void {
			const functionLike = getEnclosingFunctionLike(node);
			const isCallback = functionLike ? isFunctionUsedAsCallback(context, functionLike) : false;
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
				},
				type: "object",
			},
		],
		type: "problem",
	},
};

export default requireReactComponentKeys;
