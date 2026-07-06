import { getLastElement } from "$utilities/array-utilities";
import { getMemberPropertyName, unwrapExpression, unwrapNode } from "$utilities/ast-utilities";
import { createRule } from "$utilities/create-rule";
import { isFalsyValue } from "$utilities/type-utilities";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";

import type { TSESTree } from "@typescript-eslint/utils";

type MessageIds = "unexpected";

export interface NoConstantConditionWithBreakOptions {
	readonly loopExitCalls?: ReadonlyArray<string>;
}

type Options = [NoConstantConditionWithBreakOptions?];

interface ConstantValueResult {
	readonly constant: boolean;
	readonly value?: unknown;
}

interface ConstantBooleanResult {
	readonly constant: boolean;
	readonly value?: boolean;
}

function toConstantValue(value: unknown): ConstantValueResult {
	return { constant: true, value };
}

function toNonConstantValue(): ConstantValueResult {
	return { constant: false };
}

function toConstantBoolean(value: boolean): ConstantBooleanResult {
	return { constant: true, value };
}

function toNonConstantBoolean(): ConstantBooleanResult {
	return { constant: false };
}

function normalizeLoopExitCalls(options: NoConstantConditionWithBreakOptions | undefined): ReadonlySet<string> {
	return new Set(options?.loopExitCalls);
}

function getNodePath(node: TSESTree.Node): string | undefined {
	const unwrapped = unwrapNode(node);
	if (unwrapped.type === AST_NODE_TYPES.Identifier) return unwrapped.name;
	if (unwrapped.type !== AST_NODE_TYPES.MemberExpression) return undefined;

	const objectPath = getNodePath(unwrapped.object);
	if (objectPath === undefined) return undefined;

	const propertyName = getMemberPropertyName(unwrapped);
	if (propertyName === undefined) return undefined;

	return `${objectPath}.${propertyName}`;
}

function isConfiguredLoopExitCall(
	callExpression: TSESTree.CallExpression,
	loopExitCalls: ReadonlySet<string>,
): boolean {
	const calleePath = getNodePath(callExpression.callee);
	if (calleePath === undefined) return false;

	return loopExitCalls.has(calleePath);
}

function appendCallArguments(children: Array<TSESTree.Expression>, argument: TSESTree.CallExpressionArgument): void {
	if (argument.type === AST_NODE_TYPES.SpreadElement) {
		children.push(argument.argument);
		return;
	}

	children.push(argument);
}

function getArrayExpressionChildren(expression: TSESTree.ArrayExpression): ReadonlyArray<TSESTree.Expression> {
	return expression.elements.flatMap((element) => {
		if (element === null) return [];
		return element.type === AST_NODE_TYPES.SpreadElement ? [element.argument] : [element];
	});
}

function getCallExpressionChildren(expression: TSESTree.CallExpression): ReadonlyArray<TSESTree.Expression> {
	const children = expression.callee.type === AST_NODE_TYPES.Super ? [] : [expression.callee];
	for (const argument of expression.arguments) appendCallArguments(children, argument);
	return children;
}

function getMemberExpressionChildren(expression: TSESTree.MemberExpression): ReadonlyArray<TSESTree.Expression> {
	if (expression.object.type === AST_NODE_TYPES.Super) return expression.computed ? [expression.property] : [];
	return expression.computed ? [expression.object, expression.property] : [expression.object];
}

function getNewExpressionChildren(expression: TSESTree.NewExpression): ReadonlyArray<TSESTree.Expression> {
	const children = [expression.callee];
	for (const argument of expression.arguments) appendCallArguments(children, argument);
	return children;
}

function getLoopExitExpressionChildren(expression: TSESTree.Expression): ReadonlyArray<TSESTree.Expression> {
	const unwrapped = unwrapExpression(expression);

	switch (unwrapped.type) {
		case AST_NODE_TYPES.ArrayExpression:
			return getArrayExpressionChildren(unwrapped);

		case AST_NODE_TYPES.AssignmentExpression:
			return [unwrapped.right];

		case AST_NODE_TYPES.AwaitExpression:
		case AST_NODE_TYPES.UnaryExpression:
		case AST_NODE_TYPES.UpdateExpression:
			return [unwrapped.argument];

		case AST_NODE_TYPES.BinaryExpression: {
			return unwrapped.left.type === AST_NODE_TYPES.PrivateIdentifier
				? [unwrapped.right]
				: [unwrapped.left, unwrapped.right];
		}

		case AST_NODE_TYPES.CallExpression:
			return getCallExpressionChildren(unwrapped);

		case AST_NODE_TYPES.ConditionalExpression:
			return [unwrapped.test, unwrapped.consequent, unwrapped.alternate];

		case AST_NODE_TYPES.LogicalExpression:
			return [unwrapped.left, unwrapped.right];

		case AST_NODE_TYPES.MemberExpression:
			return getMemberExpressionChildren(unwrapped);

		case AST_NODE_TYPES.NewExpression:
			return getNewExpressionChildren(unwrapped);

		case AST_NODE_TYPES.SequenceExpression:
		case AST_NODE_TYPES.TemplateLiteral:
			return unwrapped.expressions;

		case AST_NODE_TYPES.TaggedTemplateExpression:
			return [unwrapped.tag, ...unwrapped.quasi.expressions];

		case AST_NODE_TYPES.YieldExpression:
			return unwrapped.argument === null ? [] : [unwrapped.argument];

		default:
			return [];
	}
}

function expressionContainsConfiguredLoopExit(
	expression: TSESTree.Expression,
	loopExitCalls: ReadonlySet<string>,
): boolean {
	if (loopExitCalls.size === 0) return false;
	const unwrapped = unwrapExpression(expression);

	if (unwrapped.type === AST_NODE_TYPES.CallExpression && isConfiguredLoopExitCall(unwrapped, loopExitCalls)) {
		return true;
	}
	if (
		unwrapped.type === AST_NODE_TYPES.ArrowFunctionExpression ||
		unwrapped.type === AST_NODE_TYPES.ClassExpression ||
		unwrapped.type === AST_NODE_TYPES.FunctionExpression
	) {
		return false;
	}

	return getLoopExitExpressionChildren(unwrapped).some((part) =>
		expressionContainsConfiguredLoopExit(part, loopExitCalls),
	);
}

function getConstantLogicalValue(expression: TSESTree.LogicalExpression): ConstantValueResult {
	const left = getConstantValue(expression.left);
	if (!left.constant) return toNonConstantValue();

	if (expression.operator === "&&") {
		if (isFalsyValue(left.value)) return toConstantValue(left.value);
		return getConstantValue(expression.right);
	}

	if (expression.operator === "||") {
		if (!isFalsyValue(left.value)) return toConstantValue(left.value);
		return getConstantValue(expression.right);
	}

	if (left.value !== null && left.value !== undefined) return toConstantValue(left.value);
	return getConstantValue(expression.right);
}

function getConstantUnaryValue(expression: TSESTree.UnaryExpression): ConstantValueResult {
	if (expression.operator === "typeof") return toConstantValue("string");
	if (expression.operator === "void") return toConstantValue(undefined);

	const argument = getConstantValue(expression.argument);
	if (!argument.constant) return toNonConstantValue();

	if (expression.operator === "!") return toConstantValue(isFalsyValue(argument.value));
	if (expression.operator === "+" && typeof argument.value === "number") return toConstantValue(argument.value);
	if (expression.operator === "-" && typeof argument.value === "number") return toConstantValue(-argument.value);
	if (expression.operator === "~" && typeof argument.value === "number") return toConstantValue(~argument.value);

	return toNonConstantValue();
}

function getConstantSequenceValue(expression: TSESTree.SequenceExpression): ConstantValueResult {
	return getConstantValue(getLastElement(expression.expressions, "Expected sequence expression to have children."));
}

function getConstantTemplateValue(expression: TSESTree.TemplateLiteral): ConstantValueResult {
	if (expression.expressions.length > 0) return toNonConstantValue();
	const quasi = getLastElement(expression.quasis, "Expected template literal to have a quasi.");
	return toConstantValue(quasi.value.cooked);
}

function getConstantValue(expression: TSESTree.Expression): ConstantValueResult {
	const unwrapped = unwrapExpression(expression);

	switch (unwrapped.type) {
		case AST_NODE_TYPES.ArrayExpression:
			return toConstantValue([]);

		case AST_NODE_TYPES.ArrowFunctionExpression:
		case AST_NODE_TYPES.ClassExpression:
		case AST_NODE_TYPES.FunctionExpression:
			return toConstantValue(true);

		case AST_NODE_TYPES.Identifier: {
			if (unwrapped.name === "undefined") return toConstantValue(undefined);
			if (unwrapped.name === "NaN") return toConstantValue(Number.NaN);
			if (unwrapped.name === "Infinity") return toConstantValue(Number.POSITIVE_INFINITY);
			return toNonConstantValue();
		}

		case AST_NODE_TYPES.Literal:
			return toConstantValue(unwrapped.value);

		case AST_NODE_TYPES.LogicalExpression:
			return getConstantLogicalValue(unwrapped);

		case AST_NODE_TYPES.ObjectExpression:
			return toConstantValue({});

		case AST_NODE_TYPES.SequenceExpression:
			return getConstantSequenceValue(unwrapped);

		case AST_NODE_TYPES.TemplateLiteral:
			return getConstantTemplateValue(unwrapped);

		case AST_NODE_TYPES.UnaryExpression:
			return getConstantUnaryValue(unwrapped);
		default:
			return toNonConstantValue();
	}
}

function getConditionalConstantBoolean(expression: TSESTree.ConditionalExpression): ConstantBooleanResult {
	const test = getConstantBoolean(expression.test);
	if (test.constant) {
		return test.value === true
			? getConstantBoolean(expression.consequent)
			: getConstantBoolean(expression.alternate);
	}

	const consequent = getConstantBoolean(expression.consequent);
	const alternate = getConstantBoolean(expression.alternate);
	if (consequent.constant && alternate.constant && consequent.value === alternate.value) return consequent;

	return toNonConstantBoolean();
}

function getLogicalConstantBoolean(expression: TSESTree.LogicalExpression): ConstantBooleanResult {
	const left = getConstantBoolean(expression.left);
	if (!left.constant) return toNonConstantBoolean();

	if (expression.operator === "&&") {
		if (left.value !== true) return toConstantBoolean(false);
		return getConstantBoolean(expression.right);
	}

	if (expression.operator === "||") {
		if (left.value === true) return toConstantBoolean(true);
		return getConstantBoolean(expression.right);
	}

	const leftValue = getConstantValue(expression.left);
	if (!leftValue.constant) return toNonConstantBoolean();
	if (leftValue.value !== null && leftValue.value !== undefined) return toConstantBoolean(Boolean(leftValue.value));

	return getConstantBoolean(expression.right);
}

function getSequenceConstantBoolean(expression: TSESTree.SequenceExpression): ConstantBooleanResult {
	return getConstantBoolean(getLastElement(expression.expressions, "Expected sequence expression to have children."));
}

function getConstantBoolean(expression: TSESTree.Expression): ConstantBooleanResult {
	const unwrapped = unwrapExpression(expression);

	if (unwrapped.type === AST_NODE_TYPES.ConditionalExpression) {
		return getConditionalConstantBoolean(unwrapped);
	}

	if (unwrapped.type === AST_NODE_TYPES.LogicalExpression) {
		return getLogicalConstantBoolean(unwrapped);
	}

	if (unwrapped.type === AST_NODE_TYPES.SequenceExpression) {
		return getSequenceConstantBoolean(unwrapped);
	}

	const value = getConstantValue(unwrapped);
	if (!value.constant) return toNonConstantBoolean();
	return toConstantBoolean(Boolean(value.value));
}

type LoopNode =
	| TSESTree.DoWhileStatement
	| TSESTree.ForInStatement
	| TSESTree.ForOfStatement
	| TSESTree.ForStatement
	| TSESTree.WhileStatement;

function isLoopNode(node: TSESTree.Node | undefined): node is LoopNode {
	return (
		node?.type === AST_NODE_TYPES.DoWhileStatement ||
		node?.type === AST_NODE_TYPES.ForInStatement ||
		node?.type === AST_NODE_TYPES.ForOfStatement ||
		node?.type === AST_NODE_TYPES.ForStatement ||
		node?.type === AST_NODE_TYPES.WhileStatement
	);
}

function isFunctionBoundary(node: TSESTree.Node | undefined): boolean {
	return (
		node?.type === AST_NODE_TYPES.ArrowFunctionExpression ||
		node?.type === AST_NODE_TYPES.FunctionDeclaration ||
		node?.type === AST_NODE_TYPES.FunctionExpression
	);
}

function breaksTargetLoop(statement: TSESTree.BreakStatement, loopNode: LoopNode): boolean {
	if (statement.label) {
		let target: TSESTree.Statement | undefined;
		let current: TSESTree.Node | undefined = statement.parent;

		while (current !== undefined && target === undefined) {
			if (current.type === AST_NODE_TYPES.LabeledStatement && current.label.name === statement.label.name) {
				target = current.body;
			}
			current = current.parent;
		}

		return target === loopNode;
	}

	let breakBoundary: TSESTree.Node | undefined;
	let current: TSESTree.Node | undefined = statement.parent;

	while (current !== undefined && breakBoundary === undefined) {
		if (isFunctionBoundary(current) || current.type === AST_NODE_TYPES.SwitchStatement || isLoopNode(current)) {
			breakBoundary = current;
		}
		current = current.parent;
	}

	return breakBoundary === loopNode;
}

function forStatementInitContainsConfiguredLoopExit(
	initialization: TSESTree.ForStatement["init"],
	loopExitCalls: ReadonlySet<string>,
): boolean {
	if (!initialization) return false;

	if (initialization.type === AST_NODE_TYPES.VariableDeclaration) {
		return initialization.declarations.some((declaration) =>
			declaration.init ? expressionContainsConfiguredLoopExit(declaration.init, loopExitCalls) : false,
		);
	}

	return expressionContainsConfiguredLoopExit(initialization, loopExitCalls);
}

function loopHeaderContainsConfiguredLoopExit(loopNode: LoopNode, loopExitCalls: ReadonlySet<string>): boolean {
	let containsLoopExit: boolean;

	switch (loopNode.type) {
		case AST_NODE_TYPES.DoWhileStatement:
		case AST_NODE_TYPES.WhileStatement: {
			containsLoopExit = expressionContainsConfiguredLoopExit(loopNode.test, loopExitCalls);
			break;
		}

		case AST_NODE_TYPES.ForStatement: {
			containsLoopExit =
				forStatementInitContainsConfiguredLoopExit(loopNode.init, loopExitCalls) ||
				(loopNode.test !== null && expressionContainsConfiguredLoopExit(loopNode.test, loopExitCalls)) ||
				(loopNode.update !== null && expressionContainsConfiguredLoopExit(loopNode.update, loopExitCalls));
			break;
		}

		case AST_NODE_TYPES.ForInStatement:
		case AST_NODE_TYPES.ForOfStatement: {
			containsLoopExit = expressionContainsConfiguredLoopExit(loopNode.right, loopExitCalls);
			break;
		}
	}

	return containsLoopExit;
}

function variableDeclarationContainsConfiguredLoopExit(
	statement: TSESTree.VariableDeclaration,
	loopExitCalls: ReadonlySet<string>,
): boolean {
	return statement.declarations.some((declaration) =>
		declaration.init === null ? false : expressionContainsConfiguredLoopExit(declaration.init, loopExitCalls),
	);
}

function nestedLoopStatementContainsExit(
	statement:
		| TSESTree.DoWhileStatement
		| TSESTree.ForInStatement
		| TSESTree.ForOfStatement
		| TSESTree.ForStatement
		| TSESTree.WhileStatement,
	loopNode: LoopNode,
	loopExitCalls: ReadonlySet<string>,
): boolean {
	if (loopHeaderContainsConfiguredLoopExit(statement, loopExitCalls)) return true;
	return statementContainsLoopExit(statement.body, loopNode, loopExitCalls);
}

function ifStatementContainsLoopExit(
	statement: TSESTree.IfStatement,
	loopNode: LoopNode,
	loopExitCalls: ReadonlySet<string>,
): boolean {
	if (statementContainsLoopExit(statement.consequent, loopNode, loopExitCalls)) return true;
	return statement.alternate === null
		? false
		: statementContainsLoopExit(statement.alternate, loopNode, loopExitCalls);
}

function switchStatementContainsLoopExit(
	statement: TSESTree.SwitchStatement,
	loopNode: LoopNode,
	loopExitCalls: ReadonlySet<string>,
): boolean {
	return statement.cases.some((switchCase) =>
		switchCase.consequent.some((consequent) => statementContainsLoopExit(consequent, loopNode, loopExitCalls)),
	);
}

function tryStatementContainsLoopExit(
	statement: TSESTree.TryStatement,
	loopNode: LoopNode,
	loopExitCalls: ReadonlySet<string>,
): boolean {
	if (statementContainsLoopExit(statement.block, loopNode, loopExitCalls)) return true;
	if (statement.handler !== null && statementContainsLoopExit(statement.handler.body, loopNode, loopExitCalls)) {
		return true;
	}
	if (statement.finalizer !== null && statementContainsLoopExit(statement.finalizer, loopNode, loopExitCalls)) {
		return true;
	}
	return false;
}

function statementContainsLoopExit(
	statement: TSESTree.Statement,
	loopNode: LoopNode,
	loopExitCalls: ReadonlySet<string>,
): boolean {
	switch (statement.type) {
		case AST_NODE_TYPES.BlockStatement: {
			return statement.body.some((bodyStatement) =>
				statementContainsLoopExit(bodyStatement, loopNode, loopExitCalls),
			);
		}

		case AST_NODE_TYPES.BreakStatement:
			return breaksTargetLoop(statement, loopNode);

		case AST_NODE_TYPES.ReturnStatement:
			return true;

		case AST_NODE_TYPES.DoWhileStatement:
		case AST_NODE_TYPES.ForInStatement:
		case AST_NODE_TYPES.ForOfStatement:
		case AST_NODE_TYPES.ForStatement:
		case AST_NODE_TYPES.WhileStatement:
			return nestedLoopStatementContainsExit(statement, loopNode, loopExitCalls);

		case AST_NODE_TYPES.ExpressionStatement:
			return expressionContainsConfiguredLoopExit(statement.expression, loopExitCalls);

		case AST_NODE_TYPES.IfStatement:
			return ifStatementContainsLoopExit(statement, loopNode, loopExitCalls);

		case AST_NODE_TYPES.LabeledStatement:
			return statementContainsLoopExit(statement.body, loopNode, loopExitCalls);

		case AST_NODE_TYPES.SwitchStatement:
			return switchStatementContainsLoopExit(statement, loopNode, loopExitCalls);

		case AST_NODE_TYPES.TryStatement:
			return tryStatementContainsLoopExit(statement, loopNode, loopExitCalls);

		case AST_NODE_TYPES.VariableDeclaration:
			return variableDeclarationContainsConfiguredLoopExit(statement, loopExitCalls);

		case AST_NODE_TYPES.WithStatement: {
			if (expressionContainsConfiguredLoopExit(statement.object, loopExitCalls)) return true;
			return statementContainsLoopExit(statement.body, loopNode, loopExitCalls);
		}

		default:
			return false;
	}
}

function shouldReportLoop(
	testResult: ConstantBooleanResult,
	loopNode: LoopNode,
	loopExitCalls: ReadonlySet<string>,
): boolean {
	if (!testResult.constant) return false;
	if (testResult.value !== true) return true;
	if (loopHeaderContainsConfiguredLoopExit(loopNode, loopExitCalls)) return false;
	return !statementContainsLoopExit(loopNode.body, loopNode, loopExitCalls);
}

function reportConstantCondition(
	context: Parameters<Parameters<typeof createRule<Options, MessageIds>>[0]["create"]>[0],
	testExpression: TSESTree.Expression,
): void {
	const testResult = getConstantBoolean(testExpression);
	if (!testResult.constant) return;

	context.report({
		messageId: "unexpected",
		node: testExpression,
	});
}

const noConstantConditionWithBreak = createRule<Options, MessageIds>({
	create(context) {
		const loopExitCalls = normalizeLoopExitCalls(context.options[0]);

		return {
			ConditionalExpression(node): void {
				reportConstantCondition(context, node.test);
			},
			DoWhileStatement(node): void {
				const testResult = getConstantBoolean(node.test);
				if (!shouldReportLoop(testResult, node, loopExitCalls)) return;

				context.report({
					messageId: "unexpected",
					node: node.test,
				});
			},
			ForStatement(node): void {
				if (!node.test) return;
				const testResult = getConstantBoolean(node.test);
				if (!shouldReportLoop(testResult, node, loopExitCalls)) return;

				context.report({
					messageId: "unexpected",
					node: node.test,
				});
			},
			IfStatement(node): void {
				reportConstantCondition(context, node.test);
			},
			WhileStatement(node): void {
				const testResult = getConstantBoolean(node.test);
				if (!shouldReportLoop(testResult, node, loopExitCalls)) return;

				context.report({
					messageId: "unexpected",
					node: node.test,
				});
			},
		};
	},
	meta: {
		defaultOptions: [{ loopExitCalls: [] }],
		docs: {
			description:
				"Disallow constant conditions, but allow constant loops that include loop exits such as break, return, or configured calls.",
		},
		messages: {
			unexpected: "Unexpected constant condition.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					loopExitCalls: {
						items: {
							minLength: 1,
							type: "string",
						},
						type: "array",
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
	name: "no-constant-condition-with-break",
});

export default noConstantConditionWithBreak;
