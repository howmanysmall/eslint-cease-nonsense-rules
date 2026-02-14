import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utilities/create-rule";

type MessageIds = "unexpected";
type Options = [];

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

function unwrapExpression(expression: TSESTree.Expression): TSESTree.Expression {
	if (expression.type === AST_NODE_TYPES.ChainExpression) return unwrapExpression(expression.expression);
	if (expression.type === AST_NODE_TYPES.TSAsExpression) return unwrapExpression(expression.expression);
	if (expression.type === AST_NODE_TYPES.TSInstantiationExpression) return unwrapExpression(expression.expression);
	if (expression.type === AST_NODE_TYPES.TSNonNullExpression) return unwrapExpression(expression.expression);
	if (expression.type === AST_NODE_TYPES.TSTypeAssertion) return unwrapExpression(expression.expression);
	return expression;
}

function getConstantValue(expression: TSESTree.Expression): ConstantValueResult {
	const unwrapped = unwrapExpression(expression);

	switch (unwrapped.type) {
		case AST_NODE_TYPES.ArrayExpression:
			return toConstantValue([]);
		case AST_NODE_TYPES.ArrowFunctionExpression:
			return toConstantValue(true);
		case AST_NODE_TYPES.ClassExpression:
			return toConstantValue(true);
		case AST_NODE_TYPES.FunctionExpression:
			return toConstantValue(true);
		case AST_NODE_TYPES.Identifier:
			if (unwrapped.name === "undefined") return toConstantValue(undefined);
			if (unwrapped.name === "NaN") return toConstantValue(Number.NaN);
			if (unwrapped.name === "Infinity") return toConstantValue(Number.POSITIVE_INFINITY);
			return toNonConstantValue();
		case AST_NODE_TYPES.Literal:
			return toConstantValue(unwrapped.value);
		case AST_NODE_TYPES.LogicalExpression: {
			const left = getConstantValue(unwrapped.left);
			if (!left.constant) return toNonConstantValue();

			if (unwrapped.operator === "&&") {
				if (!left.value) return toConstantValue(left.value);
				return getConstantValue(unwrapped.right);
			}

			if (unwrapped.operator === "||") {
				if (left.value) return toConstantValue(left.value);
				return getConstantValue(unwrapped.right);
			}

			if (left.value !== null && left.value !== undefined) return toConstantValue(left.value);
			return getConstantValue(unwrapped.right);
		}
		case AST_NODE_TYPES.ObjectExpression:
			return toConstantValue({});
		case AST_NODE_TYPES.SequenceExpression: {
			const lastExpression = unwrapped.expressions.at(-1);
			if (!lastExpression) return toNonConstantValue();
			return getConstantValue(lastExpression);
		}
		case AST_NODE_TYPES.TemplateLiteral:
			if (unwrapped.expressions.length > 0) return toNonConstantValue();
			if (unwrapped.quasis.length === 0) return toConstantValue("");
			return toConstantValue(unwrapped.quasis[0]?.value.cooked ?? "");
		case AST_NODE_TYPES.UnaryExpression: {
			if (unwrapped.operator === "typeof") return toConstantValue("string");
			if (unwrapped.operator === "void") return toConstantValue(undefined);

			const argument = getConstantValue(unwrapped.argument);
			if (!argument.constant) return toNonConstantValue();

			if (unwrapped.operator === "!") return toConstantValue(!argument.value);
			if (unwrapped.operator === "+" && typeof argument.value === "number") {
				return toConstantValue(Number(argument.value));
			}
			if (unwrapped.operator === "-" && typeof argument.value === "number")
				return toConstantValue(-argument.value);
			if (unwrapped.operator === "~" && typeof argument.value === "number")
				return toConstantValue(~argument.value);

			return toNonConstantValue();
		}
		default:
			return toNonConstantValue();
	}
}

function getConstantBoolean(expression: TSESTree.Expression): ConstantBooleanResult {
	const unwrapped = unwrapExpression(expression);

	if (unwrapped.type === AST_NODE_TYPES.ConditionalExpression) {
		const test = getConstantBoolean(unwrapped.test);
		if (test.constant)
			return test.value ? getConstantBoolean(unwrapped.consequent) : getConstantBoolean(unwrapped.alternate);

		const consequent = getConstantBoolean(unwrapped.consequent);
		const alternate = getConstantBoolean(unwrapped.alternate);
		if (consequent.constant && alternate.constant && consequent.value === alternate.value) return consequent;

		return toNonConstantBoolean();
	}

	if (unwrapped.type === AST_NODE_TYPES.LogicalExpression) {
		const left = getConstantBoolean(unwrapped.left);
		if (!left.constant) return toNonConstantBoolean();

		if (unwrapped.operator === "&&") {
			if (!left.value) return toConstantBoolean(false);
			return getConstantBoolean(unwrapped.right);
		}

		if (unwrapped.operator === "||") {
			if (left.value) return toConstantBoolean(true);
			return getConstantBoolean(unwrapped.right);
		}

		const leftValue = getConstantValue(unwrapped.left);
		if (!leftValue.constant) return toNonConstantBoolean();
		if (leftValue.value !== null && leftValue.value !== undefined)
			return toConstantBoolean(Boolean(leftValue.value));
		return getConstantBoolean(unwrapped.right);
	}

	if (unwrapped.type === AST_NODE_TYPES.SequenceExpression) {
		const lastExpression = unwrapped.expressions.at(-1);
		if (!lastExpression) return toNonConstantBoolean();
		return getConstantBoolean(lastExpression);
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

function findLabeledStatementBody(
	labelName: string,
	startingNode: TSESTree.Node | undefined,
): TSESTree.Statement | undefined {
	let current = startingNode;

	while (current) {
		if (current.type === AST_NODE_TYPES.LabeledStatement && current.label.name === labelName) return current.body;
		current = current.parent ?? undefined;
	}

	return undefined;
}

function breaksTargetLoop(statement: TSESTree.BreakStatement, loopNode: LoopNode): boolean {
	if (statement.label) {
		const target = findLabeledStatementBody(statement.label.name, statement.parent ?? undefined);
		return target === loopNode;
	}

	let current: TSESTree.Node | undefined = statement.parent;
	while (current) {
		if (isFunctionBoundary(current)) return false;
		if (current.type === AST_NODE_TYPES.SwitchStatement) return false;
		if (isLoopNode(current)) return current === loopNode;
		current = current.parent;
	}

	return false;
}

function statementContainsLoopBreak(statement: TSESTree.Statement, loopNode: LoopNode): boolean {
	switch (statement.type) {
		case AST_NODE_TYPES.BlockStatement:
			return statement.body.some((bodyStatement) => statementContainsLoopBreak(bodyStatement, loopNode));
		case AST_NODE_TYPES.BreakStatement:
			return breaksTargetLoop(statement, loopNode);
		case AST_NODE_TYPES.DoWhileStatement:
			return statementContainsLoopBreak(statement.body, loopNode);
		case AST_NODE_TYPES.ForInStatement:
			return statementContainsLoopBreak(statement.body, loopNode);
		case AST_NODE_TYPES.ForOfStatement:
			return statementContainsLoopBreak(statement.body, loopNode);
		case AST_NODE_TYPES.ForStatement:
			return statementContainsLoopBreak(statement.body, loopNode);
		case AST_NODE_TYPES.IfStatement:
			if (statementContainsLoopBreak(statement.consequent, loopNode)) return true;
			return statement.alternate ? statementContainsLoopBreak(statement.alternate, loopNode) : false;
		case AST_NODE_TYPES.LabeledStatement:
			return statementContainsLoopBreak(statement.body, loopNode);
		case AST_NODE_TYPES.SwitchStatement:
			return statement.cases.some((switchCase) =>
				switchCase.consequent.some((consequent) => statementContainsLoopBreak(consequent, loopNode)),
			);
		case AST_NODE_TYPES.TryStatement:
			if (statementContainsLoopBreak(statement.block, loopNode)) return true;
			if (statement.handler && statementContainsLoopBreak(statement.handler.body, loopNode)) return true;
			if (statement.finalizer && statementContainsLoopBreak(statement.finalizer, loopNode)) return true;
			return false;
		case AST_NODE_TYPES.WhileStatement:
			return statementContainsLoopBreak(statement.body, loopNode);
		case AST_NODE_TYPES.WithStatement:
			return statementContainsLoopBreak(statement.body, loopNode);
		default:
			return false;
	}
}

function shouldReportLoop(testResult: ConstantBooleanResult, loopNode: LoopNode): boolean {
	if (!testResult.constant) return false;
	if (!testResult.value) return true;
	return !statementContainsLoopBreak(loopNode.body, loopNode);
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

export default createRule<Options, MessageIds>({
	create(context) {
		return {
			ConditionalExpression(node): void {
				reportConstantCondition(context, node.test);
			},
			DoWhileStatement(node): void {
				const testResult = getConstantBoolean(node.test);
				if (!shouldReportLoop(testResult, node)) return;

				context.report({
					messageId: "unexpected",
					node: node.test,
				});
			},
			ForStatement(node): void {
				if (!node.test) return;
				const testResult = getConstantBoolean(node.test);
				if (!shouldReportLoop(testResult, node)) return;

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
				if (!shouldReportLoop(testResult, node)) return;

				context.report({
					messageId: "unexpected",
					node: node.test,
				});
			},
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description:
				"Disallow constant conditions, but allow constant loops that include a break targeting the same loop.",
		},
		messages: {
			unexpected: "Unexpected constant condition.",
		},
		schema: [],
		type: "problem",
	},
	name: "no-constant-condition-with-break",
});
