import { AST_NODE_TYPES } from "@typescript-eslint/types";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import type { ReadonlyRecord } from "../types/utility-types";
import { createRule } from "../utilities/create-rule";

type MessageIds =
	| "awaitInConstructor"
	| "promiseChainInConstructor"
	| "asyncIifeInConstructor"
	| "unhandledAsyncCall"
	| "orphanedPromise";

const PROMISE_CHAIN_METHODS = new Set(["then", "catch", "finally"]);

function isNode(value: unknown): value is TSESTree.Node {
	return typeof value === "object" && value !== null && "type" in value;
}

function hasDynamicProperties(_node: TSESTree.Node): _node is TSESTree.Node & ReadonlyRecord<string, unknown> {
	return true;
}

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

function isPromiseChainCall(node: TSESTree.CallExpression): boolean {
	if (node.callee.type !== AST_NODE_TYPES.MemberExpression) return false;

	const { property } = node.callee;
	if (property.type !== AST_NODE_TYPES.Identifier) return false;

	return PROMISE_CHAIN_METHODS.has(property.name);
}

function isAsyncIIFE(node: TSESTree.CallExpression): boolean {
	const { callee } = node;

	if (callee.type === AST_NODE_TYPES.ArrowFunctionExpression && callee.async) return true;
	if (callee.type === AST_NODE_TYPES.FunctionExpression && callee.async) return true;

	return false;
}

function isThisAsyncMethodCall(node: TSESTree.CallExpression, asyncMethods: Set<string>): string | undefined {
	const { callee } = node;
	if (callee.type !== AST_NODE_TYPES.MemberExpression) return undefined;
	if (callee.object.type !== AST_NODE_TYPES.ThisExpression) return undefined;
	if (callee.property.type !== AST_NODE_TYPES.Identifier) return undefined;

	const methodName = callee.property.name;
	return asyncMethods.has(methodName) ? methodName : undefined;
}

function isAssignedToThisProperty(node: TSESTree.Node, parent: TSESTree.Node | undefined): boolean {
	if (!parent) return false;
	if (parent.type !== AST_NODE_TYPES.AssignmentExpression) return false;
	if (parent.right !== node) return false;

	const { left } = parent;
	return left.type === AST_NODE_TYPES.MemberExpression && left.object.type === AST_NODE_TYPES.ThisExpression;
}

function getLocalVariableAssignment(node: TSESTree.Node, parent: TSESTree.Node | undefined): string | undefined {
	if (!parent) return undefined;
	if (parent.type !== AST_NODE_TYPES.VariableDeclarator) return undefined;
	if (parent.init !== node) return undefined;
	if (parent.id.type !== AST_NODE_TYPES.Identifier) return undefined;

	return parent.id.name;
}

function isExpressionStatement(parent: TSESTree.Node | undefined): boolean {
	return parent?.type === AST_NODE_TYPES.ExpressionStatement;
}

interface ConstructorViolation {
	node: TSESTree.Node;
	messageId: MessageIds;
	data?: Record<string, string>;
}

function checkAsyncMethodCall(
	current: TSESTree.CallExpression,
	parent: TSESTree.Node | undefined,
	asyncMethods: Set<string>,
): ConstructorViolation | undefined {
	const asyncMethodName = isThisAsyncMethodCall(current, asyncMethods);
	if (asyncMethodName === undefined) return undefined;

	if (isAssignedToThisProperty(current, parent)) return undefined;

	if (isExpressionStatement(parent)) {
		return {
			data: { methodName: asyncMethodName },
			messageId: "unhandledAsyncCall",
			node: current,
		};
	}

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

function isNonIIFEFunction(node: TSESTree.Node, parent: TSESTree.Node | undefined): boolean {
	if (node.type !== AST_NODE_TYPES.ArrowFunctionExpression && node.type !== AST_NODE_TYPES.FunctionExpression) {
		return false;
	}

	if (parent?.type === AST_NODE_TYPES.CallExpression && parent.callee === node) return false;

	return true;
}

function findConstructorViolations(
	constructorBody: TSESTree.BlockStatement,
	asyncMethods: Set<string>,
): ReadonlyArray<ConstructorViolation> {
	const violations = new Array<ConstructorViolation>();
	let size = 0;
	const visited = new WeakSet<TSESTree.Node>();
	const parentMap = new WeakMap<TSESTree.Node, TSESTree.Node>();

	function traverse(current: TSESTree.Node): void {
		if (visited.has(current)) return;
		visited.add(current);

		const parent = parentMap.get(current);

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

export default createRule<[], MessageIds>({
	create(context) {
		return {
			"MethodDefinition[kind='constructor']"(node: TSESTree.MethodDefinition): void {
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
	name: "no-async-constructor",
});
