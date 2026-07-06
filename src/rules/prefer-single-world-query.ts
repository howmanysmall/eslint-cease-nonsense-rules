import { createRule } from "$utilities/create-rule";
import { getDefinedValue } from "$utilities/defined-utilities";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { regex } from "arktype";

import type { Reference } from "@typescript-eslint/scope-manager";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

type MessageIds = "preferSingleGet" | "preferSingleHas";
type QueryType = "get" | "has";
type WorldQueryExpression = TSESTree.CallExpression & {
	readonly arguments: [TSESTree.Expression, TSESTree.Expression];
	readonly callee: TSESTree.MemberExpression;
};

interface WorldQueryCall {
	readonly componentNode: TSESTree.Expression;
	readonly entityNode: TSESTree.Expression;
	readonly node: TSESTree.CallExpression;
	readonly queryType: QueryType;
	readonly variableDeclaration: TSESTree.VariableDeclaration;
	readonly variableDeclarator: TSESTree.VariableDeclarator;
	readonly variableName: string;
	readonly worldNode: TSESTree.Expression;
}

type QueryCallGroup = readonly [WorldQueryCall, WorldQueryCall, ...Array<WorldQueryCall>];

function isLengthOfTwo<TValue>(array: ReadonlyArray<TValue>): array is readonly [TValue, TValue] {
	return array.length === 2;
}

function isQueryCallGroup(calls: ReadonlyArray<WorldQueryCall>): calls is QueryCallGroup {
	return calls.length >= 2;
}

function getLastCall(calls: QueryCallGroup): WorldQueryCall {
	const [, secondCall, ...remainingCalls] = calls;
	let lastCall = secondCall;
	for (const call of remainingCalls) lastCall = call;
	return lastCall;
}

function isWorldQueryCall(node: TSESTree.Node, queryType: QueryType): node is WorldQueryExpression {
	if (node.type !== AST_NODE_TYPES.CallExpression) return false;

	const { callee } = node;
	if (callee.type !== AST_NODE_TYPES.MemberExpression || callee.computed) return false;

	const { property } = callee;
	if (property.type !== AST_NODE_TYPES.Identifier || property.name !== queryType || !isLengthOfTwo(node.arguments)) {
		return false;
	}

	const [entity, component] = node.arguments;
	return !(entity.type === AST_NODE_TYPES.SpreadElement || component.type === AST_NODE_TYPES.SpreadElement);
}

function extractWorldQueryCall(node: TSESTree.VariableDeclaration, queryType: QueryType): WorldQueryCall | undefined {
	if (node.declarations.length !== 1) return undefined;

	const [declarator] = node.declarations;

	const { id, init } = declarator;
	if (id.type !== AST_NODE_TYPES.Identifier || init === null || !isWorldQueryCall(init, queryType)) return undefined;

	const { callee } = init;

	const [entityNode, componentNode] = init.arguments;

	return {
		componentNode,
		entityNode,
		node: init,
		queryType,
		variableDeclaration: node,
		variableDeclarator: declarator,
		variableName: id.name,
		worldNode: callee.object,
	};
}

function getNodeText(node: TSESTree.Node, { sourceCode }: { readonly sourceCode: TSESLint.SourceCode }): string {
	return sourceCode.getText(node);
}

function isIdentifierDirectlyInAndExpression(node: TSESTree.Identifier): boolean {
	const { parent } = node;

	return parent?.type === AST_NODE_TYPES.LogicalExpression && parent.operator === "&&";
}

function isDirectlyInAndExpression(reference: Reference): boolean {
	if (reference.isWrite() || reference.identifier.type !== AST_NODE_TYPES.Identifier) return false;
	return isIdentifierDirectlyInAndExpression(reference.identifier);
}

function checkVariableUsedInAndExpression(
	variableName: string,
	variableDeclaration: TSESTree.VariableDeclaration,
	sourceCode: TSESLint.SourceCode,
): boolean {
	const variable = getDefinedValue(
		sourceCode.getScope(variableDeclaration).variables.find(({ name }) => name === variableName),
		"Expected world query variable to exist in its declaration scope.",
	);

	return variable.references.some(isDirectlyInAndExpression);
}

function areAllVariablesUsedInAndExpressions(
	calls: ReadonlyArray<WorldQueryCall>,
	{ sourceCode }: { readonly sourceCode: TSESLint.SourceCode },
): boolean {
	return calls.every((call) =>
		checkVariableUsedInAndExpression(call.variableName, call.variableDeclaration, sourceCode),
	);
}

function getVariableName(call: WorldQueryCall): string {
	return call.variableName;
}

// oxlint-disable-next-line unicorn/prefer-string-raw -- Escaped path separators are clearer than raw strings here.
const ONLY_WHITESPACE_SEMICOLON = regex("^[\\s;]*$", "u");

function callsAreConsecutive(
	previousCall: WorldQueryCall,
	currentCall: WorldQueryCall,
	context: TSESLint.RuleContext<MessageIds, []>,
): boolean {
	const previousWorld = getNodeText(previousCall.worldNode, context);
	const currentWorld = getNodeText(currentCall.worldNode, context);
	if (previousWorld !== currentWorld) return false;

	const previousEntity = getNodeText(previousCall.entityNode, context);
	const currentEntity = getNodeText(currentCall.entityNode, context);
	if (previousEntity !== currentEntity || previousCall.queryType !== currentCall.queryType) return false;

	const [, previousEnd] = previousCall.variableDeclaration.range;
	const [currentStart] = currentCall.variableDeclaration.range;
	const textBetween = context.sourceCode.getText().slice(previousEnd, currentStart);

	return ONLY_WHITESPACE_SEMICOLON.test(textBetween);
}

function processGetCalls(calls: QueryCallGroup, context: TSESLint.RuleContext<MessageIds, []>): void {
	const [firstCall] = calls;

	const worldText = getNodeText(firstCall.worldNode, context);
	const entityText = getNodeText(firstCall.entityNode, context);

	const variableNames = calls.map(getVariableName);
	const componentTexts = calls.map((call) => getNodeText(call.componentNode, context));

	const destructuring = `[${variableNames.join(", ")}]`;
	const componentArguments = componentTexts.join(", ");
	const fixedCode = `const ${destructuring} = ${worldText}.get(${entityText}, ${componentArguments});`;

	const firstDeclaration = firstCall.variableDeclaration;
	const lastDeclaration = getLastCall(calls).variableDeclaration;

	context.report({
		fix(fixer) {
			const [rangeStart] = firstDeclaration.range;
			const [, rangeEnd] = lastDeclaration.range;
			return fixer.replaceTextRange([rangeStart, rangeEnd], fixedCode);
		},
		messageId: "preferSingleGet",
		node: firstCall.node,
	});
}

function processHasCalls(calls: QueryCallGroup, context: TSESLint.RuleContext<MessageIds, []>): void {
	// Only combine has() calls if they're used in && expressions
	if (!areAllVariablesUsedInAndExpressions(calls, context)) return;

	const [firstCall] = calls;

	const worldText = getNodeText(firstCall.worldNode, context);
	const entityText = getNodeText(firstCall.entityNode, context);
	const componentTexts = calls.map((call) => getNodeText(call.componentNode, context));
	const componentArguments = componentTexts.join(", ");
	const fixedCode = `const hasAll = ${worldText}.has(${entityText}, ${componentArguments});`;

	const firstDeclaration = firstCall.variableDeclaration;
	const lastDeclaration = getLastCall(calls).variableDeclaration;

	context.report({
		fix(fixer) {
			const [rangeStart] = firstDeclaration.range;
			const [, rangeEnd] = lastDeclaration.range;
			return fixer.replaceTextRange([rangeStart, rangeEnd], fixedCode);
		},
		messageId: "preferSingleHas",
		node: firstCall.node,
	});
}

const preferSingleWorldQuery = createRule<[], MessageIds>({
	create(context) {
		// Buffers for consecutive calls
		let currentGetBuffer = new Array<WorldQueryCall>();
		let currentHasBuffer = new Array<WorldQueryCall>();

		function flushGetBuffer(): void {
			if (isQueryCallGroup(currentGetBuffer)) processGetCalls(currentGetBuffer, context);

			currentGetBuffer = [];
		}

		function flushHasBuffer(): void {
			if (isQueryCallGroup(currentHasBuffer)) processHasCalls(currentHasBuffer, context);
			currentHasBuffer = [];
		}

		function flushAllBuffers(): void {
			flushGetBuffer();
			flushHasBuffer();
		}

		return {
			// Flush buffers when we see other statement types
			":statement:not(VariableDeclaration[kind='const'])": flushAllBuffers,
			"Program:exit"(): void {
				flushAllBuffers();
			},
			"VariableDeclaration[kind='const']"(node: TSESTree.VariableDeclaration): void {
				const getCall = extractWorldQueryCall(node, "get");
				if (getCall) {
					const lastCall = currentGetBuffer.at(-1);
					if (lastCall && !callsAreConsecutive(lastCall, getCall, context)) flushGetBuffer();
					currentGetBuffer.push(getCall);

					flushHasBuffer();
					return;
				}

				const hasCall = extractWorldQueryCall(node, "has");
				if (hasCall) {
					const lastCall = currentHasBuffer.at(-1);
					if (lastCall && !callsAreConsecutive(lastCall, hasCall, context)) flushHasBuffer();
					currentHasBuffer.push(hasCall);

					flushGetBuffer();
					return;
				}

				flushAllBuffers();
			},
		};
	},
	meta: {
		defaultOptions: [],
		docs: {
			description:
				"Enforce combining multiple world.get() or world.has() calls into a single call for better Jecs performance.",
		},
		fixable: "code",
		messages: {
			preferSingleGet:
				"Multiple world.get() calls on the same entity should be combined into a single call for better performance.",
			preferSingleHas:
				"Multiple world.has() calls on the same entity should be combined into a single call for better performance.",
		},
		schema: [],
		type: "suggestion",
	},
	name: "prefer-single-world-query",
});

export default preferSingleWorldQuery;
