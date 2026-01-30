import type { Reference } from "@typescript-eslint/scope-manager";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { regex } from "arktype";
import { createRule } from "../utilities/create-rule";

type MessageIds = "preferSingleGet" | "preferSingleHas";
type QueryType = "get" | "has";

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

function isLengthOfTwo<TValue>(array: ReadonlyArray<TValue>): array is readonly [TValue, TValue] {
	return array.length === 2;
}

function isWorldQueryCall(node: TSESTree.Node, queryType: QueryType): node is TSESTree.CallExpression {
	if (node.type !== AST_NODE_TYPES.CallExpression) return false;

	const { callee } = node;
	if (callee.type !== AST_NODE_TYPES.MemberExpression) return false;
	if (callee.computed) return false;
	if (callee.property.type !== AST_NODE_TYPES.Identifier) return false;
	if (callee.property.name !== queryType) return false;
	if (!isLengthOfTwo(node.arguments)) return false;

	const [entity, component] = node.arguments;
	return !(entity.type === AST_NODE_TYPES.SpreadElement || component.type === AST_NODE_TYPES.SpreadElement);
}

function isMemberExpression(expression: TSESTree.Expression): expression is TSESTree.MemberExpression {
	return expression.type === AST_NODE_TYPES.MemberExpression;
}

function extractWorldQueryCall(node: TSESTree.VariableDeclaration, queryType: QueryType): WorldQueryCall | undefined {
	if (node.declarations.length !== 1) return undefined;

	const [declarator] = node.declarations;
	if (!declarator) return undefined;

	const { id, init } = declarator;
	if (id.type !== AST_NODE_TYPES.Identifier || !init || !isWorldQueryCall(init, queryType)) return undefined;

	const { callee } = init;
	if (!isMemberExpression(callee)) return undefined;

	const [entityNode, componentNode] = init.arguments;
	if (!entityNode || entityNode.type === AST_NODE_TYPES.SpreadElement) return undefined;
	if (!componentNode || componentNode.type === AST_NODE_TYPES.SpreadElement) return undefined;

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

const VALID_TYPES = new Set([
	AST_NODE_TYPES.IfStatement,
	AST_NODE_TYPES.WhileStatement,
	AST_NODE_TYPES.DoWhileStatement,
	AST_NODE_TYPES.ForStatement,
	AST_NODE_TYPES.ConditionalExpression,
]);

function isIdentifierDirectlyInAndExpression(node: TSESTree.Identifier): boolean {
	const { parent } = node;
	if (!parent) return false;

	if (parent.type === AST_NODE_TYPES.LogicalExpression && parent.operator === "&&") return true;

	if (VALID_TYPES.has(parent.type)) {
		let current: TSESTree.Node | undefined = node;
		while (current && current !== parent) {
			if (current.parent?.type === AST_NODE_TYPES.LogicalExpression && current.parent.operator === "&&") {
				return true;
			}
			current = current.parent;
		}
	}

	return false;
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
	return (
		sourceCode
			.getScope(variableDeclaration)
			?.variables.find(({ name }) => name === variableName)
			?.references.some(isDirectlyInAndExpression) ?? false
	);
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

// oxlint-disable-next-line unicorn/prefer-string-raw
const ONLY_WHITESPACE_SEMICOLON = regex("^[\\s;]*$");

function callsAreConsecutive(
	previousCall: WorldQueryCall | undefined,
	currentCall: WorldQueryCall,
	context: TSESLint.RuleContext<MessageIds, []>,
): boolean {
	if (!previousCall) return true;

	const previousWorld = getNodeText(previousCall.worldNode, context);
	const currentWorld = getNodeText(currentCall.worldNode, context);
	if (previousWorld !== currentWorld) return false;

	const previousEntity = getNodeText(previousCall.entityNode, context);
	const currentEntity = getNodeText(currentCall.entityNode, context);
	if (previousEntity !== currentEntity || previousCall.queryType !== currentCall.queryType) return false;

	const previousEnd = previousCall.variableDeclaration.range?.[1] ?? 0;
	const currentStart = currentCall.variableDeclaration.range?.[0] ?? 0;
	const textBetween = context.sourceCode.getText().slice(previousEnd, currentStart);

	return ONLY_WHITESPACE_SEMICOLON.test(textBetween);
}

function processGetCalls(calls: ReadonlyArray<WorldQueryCall>, context: TSESLint.RuleContext<MessageIds, []>): void {
	if (calls.length < 2) return;

	const [firstCall] = calls;
	if (!firstCall) return;

	const worldText = getNodeText(firstCall.worldNode, context);
	const entityText = getNodeText(firstCall.entityNode, context);

	// oxlint-disable-next-line unicorn/no-array-callback-reference
	const variableNames = calls.map(getVariableName);
	const componentTexts = calls.map((call) => getNodeText(call.componentNode, context));

	const destructuring = variableNames.length === 1 ? variableNames[0] : `[${variableNames.join(", ")}]`;
	const componentArguments = componentTexts.join(", ");
	const fixedCode = `const ${destructuring} = ${worldText}.get(${entityText}, ${componentArguments});`;

	const firstDeclaration = calls.at(0)?.variableDeclaration;
	const lastDeclaration = calls.at(-1)?.variableDeclaration;
	if (!(firstDeclaration && lastDeclaration)) return;

	context.report({
		fix(fixer) {
			const rangeStart = firstDeclaration.range?.[0] ?? 0;
			const rangeEnd = lastDeclaration.range?.[1] ?? 0;
			return fixer.replaceTextRange([rangeStart, rangeEnd], fixedCode);
		},
		messageId: "preferSingleGet",
		node: firstCall.node,
	});
}

function processHasCalls(calls: ReadonlyArray<WorldQueryCall>, context: TSESLint.RuleContext<MessageIds, []>): void {
	if (calls.length < 2) return;

	// Only combine has() calls if they're used in && expressions
	if (!areAllVariablesUsedInAndExpressions(calls, context)) return;

	const [firstCall] = calls;
	if (!firstCall) return;

	const worldText = getNodeText(firstCall.worldNode, context);
	const entityText = getNodeText(firstCall.entityNode, context);
	const componentTexts = calls.map((call) => getNodeText(call.componentNode, context));
	const componentArguments = componentTexts.join(", ");
	const fixedCode = `const hasAll = ${worldText}.has(${entityText}, ${componentArguments});`;

	const firstDeclaration = calls.at(0)?.variableDeclaration;
	const lastDeclaration = calls.at(-1)?.variableDeclaration;
	if (!(firstDeclaration && lastDeclaration)) return;

	context.report({
		fix(fixer) {
			const rangeStart = firstDeclaration.range?.[0] ?? 0;
			const rangeEnd = lastDeclaration.range?.[1] ?? 0;
			return fixer.replaceTextRange([rangeStart, rangeEnd], fixedCode);
		},
		messageId: "preferSingleHas",
		node: firstCall.node,
	});
}

export default createRule<[], MessageIds>({
	create(context) {
		// Buffers for consecutive calls
		let currentGetBuffer = new Array<WorldQueryCall>();
		let currentHasBuffer = new Array<WorldQueryCall>();

		function flushGetBuffer(): void {
			if (currentGetBuffer.length >= 2) processGetCalls(currentGetBuffer, context);

			currentGetBuffer = [];
		}

		function flushHasBuffer(): void {
			if (currentHasBuffer.length >= 2) processHasCalls(currentHasBuffer, context);
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
	defaultOptions: [],
	meta: {
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
