import { AST_NODE_TYPES } from "@typescript-eslint/types";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import type { ReadonlyRecord } from "../types/utility-types";

type MessageIds =
	| "awaitInConstructor"
	| "promiseChainInConstructor"
	| "asyncIifeInConstructor"
	| "unhandledAsyncCall"
	| "orphanedPromise";

interface RuleDocsWithRecommended extends TSESLint.RuleMetaDataDocs {
	readonly recommended?: boolean;
}

const PROMISE_CHAIN_METHODS = new Set(["then", "catch", "finally"]);

function isNode(value: unknown): value is TSESTree.Node {
	return typeof value === "object" && value !== null && "type" in value;
}

function hasDynamicProperties(_node: TSESTree.Node): _node is TSESTree.Node & ReadonlyRecord<string, unknown> {
	return true;
}

/**
 * Collects names of async methods defined in the class body.
 *
 * @param classBody - The class body node to scan for async methods
 * @returns Set of method names that are marked async
 */
function getAsyncMethodNames(classBody: TSESTree.ClassBody): Set<string> {
	const asyncMethods = new Set<string>();

	for (const element of classBody.body) {
		if (element.type !== AST_NODE_TYPES.MethodDefinition) continue;
		if (element.kind !== "method") continue;
		if (!element.value.async) continue;
		if (element.key.type === AST_NODE_TYPES.Identifier) asyncMethods.add(element.key.name);
	}

	return asyncMethods;
}

/**
 * Checks if a CallExpression is a promise chain method (.then/.catch/.finally).
 *
 * @param node - The call expression to check
 * @returns True if the call is a promise chain method
 */
function isPromiseChainCall(node: TSESTree.CallExpression): boolean {
	if (node.callee.type !== AST_NODE_TYPES.MemberExpression) return false;

	const { property } = node.callee;
	if (property.type !== AST_NODE_TYPES.Identifier) return false;

	return PROMISE_CHAIN_METHODS.has(property.name);
}

/**
 * Checks if a CallExpression is an async IIFE: (async () => {})() or (async function() {})()
 *
 * @param node - The call expression to check
 * @returns True if the call is an async IIFE
 */
function isAsyncIIFE(node: TSESTree.CallExpression): boolean {
	const { callee } = node;

	// Direct async arrow/function: (async () => {})()
	if (callee.type === AST_NODE_TYPES.ArrowFunctionExpression && callee.async) return true;
	if (callee.type === AST_NODE_TYPES.FunctionExpression && callee.async) return true;

	// The parser typically unwraps parentheses, so no additional check needed
	return false;
}

/**
 * Checks if a CallExpression is calling a same-class async method via `this`.
 *
 * @param node - The call expression to check
 * @param asyncMethods - Set of async method names in the class
 * @returns The method name if it's an async method call, undefined otherwise
 */
function isThisAsyncMethodCall(node: TSESTree.CallExpression, asyncMethods: Set<string>): string | undefined {
	const { callee } = node;
	if (callee.type !== AST_NODE_TYPES.MemberExpression) return undefined;
	if (callee.object.type !== AST_NODE_TYPES.ThisExpression) return undefined;
	if (callee.property.type !== AST_NODE_TYPES.Identifier) return undefined;

	const methodName = callee.property.name;
	return asyncMethods.has(methodName) ? methodName : undefined;
}

/**
 * Checks if a node's parent indicates assignment to `this.*`.
 *
 * @param node - The node being assigned
 * @param parent - The parent node
 * @returns True if the node is being assigned to a this property
 */
function isAssignedToThisProperty(node: TSESTree.Node, parent: TSESTree.Node | undefined): boolean {
	if (!parent) return false;
	if (parent.type !== AST_NODE_TYPES.AssignmentExpression) return false;
	if (parent.right !== node) return false;

	const { left } = parent;
	return left.type === AST_NODE_TYPES.MemberExpression && left.object.type === AST_NODE_TYPES.ThisExpression;
}

/**
 * Checks if a node is assigned to a local variable (const/let/var).
 *
 * @param node - The node being assigned
 * @param parent - The parent node
 * @returns The variable name if assigned to a local variable, undefined otherwise
 */
function getLocalVariableAssignment(node: TSESTree.Node, parent: TSESTree.Node | undefined): string | undefined {
	if (!parent) return undefined;
	if (parent.type !== AST_NODE_TYPES.VariableDeclarator) return undefined;
	if (parent.init !== node) return undefined;
	if (parent.id.type !== AST_NODE_TYPES.Identifier) return undefined;

	return parent.id.name;
}

/**
 * Checks if a node is an ExpressionStatement (standalone call, not assigned).
 *
 * @param parent - The parent node to check
 * @returns True if the parent is an ExpressionStatement
 */
function isExpressionStatement(parent: TSESTree.Node | undefined): boolean {
	return parent?.type === AST_NODE_TYPES.ExpressionStatement;
}

interface ConstructorViolation {
	node: TSESTree.Node;
	messageId: MessageIds;
	data?: Record<string, string>;
}

/**
 * Checks a CallExpression for async method call violations.
 *
 * @param current - The call expression node
 * @param parent - The parent node
 * @param asyncMethods - Set of async method names in the class
 * @returns A violation if found, undefined otherwise
 */
function checkAsyncMethodCall(
	current: TSESTree.CallExpression,
	parent: TSESTree.Node | undefined,
	asyncMethods: Set<string>,
): ConstructorViolation | undefined {
	const asyncMethodName = isThisAsyncMethodCall(current, asyncMethods);
	if (asyncMethodName === undefined) return undefined;

	// Valid: this.promise = this.asyncMethod()
	if (isAssignedToThisProperty(current, parent)) return undefined;

	// Invalid: this.asyncMethod(); (standalone)
	if (isExpressionStatement(parent)) {
		return {
			data: { methodName: asyncMethodName },
			messageId: "unhandledAsyncCall",
			node: current,
		};
	}

	// Invalid: const p = this.asyncMethod(); (orphaned)
	const variableName = getLocalVariableAssignment(current, parent);
	if (variableName !== undefined) {
		return {
			data: { variableName },
			messageId: "orphanedPromise",
			node: current,
		};
	}

	return undefined;
}

/**
 * Checks if a node is a function expression (arrow or regular) that is NOT an IIFE.
 * We don't want to traverse into callback/stored functions, only into IIFEs.
 *
 * @param node - The node to check
 * @param parent - The parent node
 * @returns True if this is a non-IIFE function that should be skipped
 */
function isNonIIFEFunction(node: TSESTree.Node, parent: TSESTree.Node | undefined): boolean {
	if (node.type !== AST_NODE_TYPES.ArrowFunctionExpression && node.type !== AST_NODE_TYPES.FunctionExpression) {
		return false;
	}

	// If the parent is a CallExpression and this function is the callee, it's an IIFE
	// It's an IIFE, DO traverse into it
	if (parent?.type === AST_NODE_TYPES.CallExpression && parent.callee === node) return false;

	// Otherwise it's a callback or stored function, DON'T traverse into it
	return true;
}

/**
 * Traverses the constructor body and collects all violations.
 *
 * @param constructorBody - The constructor's block statement body
 * @param asyncMethods - Set of async method names in the class
 * @returns Array of violations found in the constructor
 */
function findConstructorViolations(
	constructorBody: TSESTree.BlockStatement,
	asyncMethods: Set<string>,
): Array<ConstructorViolation> {
	const violations = new Array<ConstructorViolation>();
	let size = 0;
	const visited = new WeakSet<TSESTree.Node>();
	const parentMap = new WeakMap<TSESTree.Node, TSESTree.Node>();

	/**
	 * Recursively traverses an AST node looking for async violations.
	 *
	 * @param current - The current node being visited
	 */
	function traverse(current: TSESTree.Node): void {
		if (visited.has(current)) return;
		visited.add(current);

		const parent = parentMap.get(current);

		// Skip traversal into non-IIFE function bodies
		if (isNonIIFEFunction(current, parent)) return;

		if (current.type === AST_NODE_TYPES.AwaitExpression) {
			violations[size++] = { messageId: "awaitInConstructor", node: current };
		}

		if (current.type === AST_NODE_TYPES.CallExpression) {
			if (isPromiseChainCall(current)) {
				violations[size++] = { messageId: "promiseChainInConstructor", node: current };
			}

			if (isAsyncIIFE(current)) violations[size++] = { messageId: "asyncIifeInConstructor", node: current };

			const asyncViolation = checkAsyncMethodCall(current, parent, asyncMethods);
			if (asyncViolation) violations[size++] = asyncViolation;
		}

		if (!hasDynamicProperties(current)) return;

		for (const key in current) {
			if (Object.hasOwn(current, key)) {
				const childValue = current[key];
				if (childValue === undefined) continue;

				if (Array.isArray(childValue)) {
					for (const item of childValue) {
						// oxlint-disable-next-line max-depth
						if (!isNode(item)) continue;
						parentMap.set(item, current);
						traverse(item);
					}
					continue;
				}

				if (!isNode(childValue)) continue;
				parentMap.set(childValue, current);
				traverse(childValue);
			}
		}
	}

	traverse(constructorBody);
	return violations;
}

/**
 * Reports a single constructor violation to the ESLint context.
 *
 * @param context - The ESLint rule context
 * @param violation - The violation to report
 */
function reportViolation(context: TSESLint.RuleContext<MessageIds, []>, violation: ConstructorViolation): void {
	if (violation.data) {
		context.report({
			data: violation.data,
			messageId: violation.messageId,
			node: violation.node,
		});
		return;
	}

	context.report({
		messageId: violation.messageId,
		node: violation.node,
	});
}

const noAsyncConstructor: TSESLint.RuleModuleWithMetaDocs<MessageIds, [], RuleDocsWithRecommended> = {
	create(context) {
		return {
			"MethodDefinition[kind='constructor']"(node: TSESTree.MethodDefinition) {
				const constructorValue = node.value;
				if (constructorValue.type !== AST_NODE_TYPES.FunctionExpression) return;

				const { body } = constructorValue;
				if (body.type !== AST_NODE_TYPES.BlockStatement) return;

				const classNode = node.parent;
				if (classNode.type !== AST_NODE_TYPES.ClassBody) return;

				const asyncMethods = getAsyncMethodNames(classNode);
				const violations = findConstructorViolations(body, asyncMethods);

				for (const violation of violations) reportViolation(context, violation);
			},
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description:
				"Disallow asynchronous operations inside class constructors. Constructors return immediately, " +
				"so async work causes race conditions, unhandled rejections, and incomplete object states.",
			recommended: true,
		},
		messages: {
			asyncIifeInConstructor:
				"Refactor this asynchronous operation outside of the constructor. " +
				"Async IIFEs create unhandled promises and incomplete object state.",
			awaitInConstructor:
				"Refactor this asynchronous operation outside of the constructor. " +
				"Using 'await' in a constructor causes the class to be instantiated before the async operation completes.",
			orphanedPromise:
				"Refactor this asynchronous operation outside of the constructor. " +
				"Promise assigned to '{{variableName}}' is never consumed - errors will be silently swallowed.",
			promiseChainInConstructor:
				"Refactor this asynchronous operation outside of the constructor. " +
				"Promise chains (.then/.catch/.finally) in constructors lead to race conditions.",
			unhandledAsyncCall:
				"Refactor this asynchronous operation outside of the constructor. " +
				"Calling async method '{{methodName}}' without handling its result creates uncontrolled async behavior.",
		},
		schema: [],
		type: "problem",
	},
};

export default noAsyncConstructor;
