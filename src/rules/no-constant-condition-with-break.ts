import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utilities/create-rule";

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

function unwrapExpression(expression: TSESTree.Expression): TSESTree.Expression {
	if (expression.type === AST_NODE_TYPES.ChainExpression) return unwrapExpression(expression.expression);
	if (expression.type === AST_NODE_TYPES.TSAsExpression) return unwrapExpression(expression.expression);
	if (expression.type === AST_NODE_TYPES.TSInstantiationExpression) return unwrapExpression(expression.expression);
	if (expression.type === AST_NODE_TYPES.TSNonNullExpression) return unwrapExpression(expression.expression);
	if (expression.type === AST_NODE_TYPES.TSTypeAssertion) return unwrapExpression(expression.expression);
	return expression;
}

function unwrapNode(node: TSESTree.Node): TSESTree.Node {
	if (node.type === AST_NODE_TYPES.ChainExpression) return unwrapNode(node.expression);
	if (node.type === AST_NODE_TYPES.TSAsExpression) return unwrapNode(node.expression);
	if (node.type === AST_NODE_TYPES.TSInstantiationExpression) return unwrapNode(node.expression);
	if (node.type === AST_NODE_TYPES.TSNonNullExpression) return unwrapNode(node.expression);
	if (node.type === AST_NODE_TYPES.TSTypeAssertion) return unwrapNode(node.expression);
	return node;
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.length > 0;
}

function normalizeLoopExitCalls(options: NoConstantConditionWithBreakOptions | undefined): ReadonlySet<string> {
	const loopExitCalls = new Set<string>();
	if (!options?.loopExitCalls) return loopExitCalls;

	for (const loopExitCall of options.loopExitCalls) {
		if (isNonEmptyString(loopExitCall)) loopExitCalls.add(loopExitCall);
	}

	return loopExitCalls;
}

function getMemberPropertyName(node: TSESTree.MemberExpression): string | undefined {
	if (!node.computed && node.property.type === AST_NODE_TYPES.Identifier) return node.property.name;
	if (node.computed && node.property.type === AST_NODE_TYPES.Literal && typeof node.property.value === "string") {
		return node.property.value;
	}

	return undefined;
}

function getNodePath(node: TSESTree.Node): string | undefined {
	const unwrapped = unwrapNode(node);
	if (unwrapped.type === AST_NODE_TYPES.Identifier) return unwrapped.name;
	if (unwrapped.type !== AST_NODE_TYPES.MemberExpression) return undefined;

	const objectPath = getNodePath(unwrapped.object);
	if (!objectPath) return undefined;

	const propertyName = getMemberPropertyName(unwrapped);
	if (!propertyName) return undefined;

	return `${objectPath}.${propertyName}`;
}

function isConfiguredLoopExitCall(
	callExpression: TSESTree.CallExpression,
	loopExitCalls: ReadonlySet<string>,
): boolean {
	if (loopExitCalls.size === 0) return false;

	const calleePath = getNodePath(callExpression.callee);
	if (!calleePath) return false;

	return loopExitCalls.has(calleePath);
}

function expressionContainsConfiguredLoopExit(
	expression: TSESTree.Expression,
	loopExitCalls: ReadonlySet<string>,
): boolean {
	if (loopExitCalls.size === 0) return false;
	const unwrapped = unwrapExpression(expression);

	switch (unwrapped.type) {
		case AST_NODE_TYPES.ArrayExpression:
			for (const element of unwrapped.elements) {
				if (!element) continue;
				if (element.type === AST_NODE_TYPES.SpreadElement) {
					if (expressionContainsConfiguredLoopExit(element.argument, loopExitCalls)) return true;
					continue;
				}

				if (expressionContainsConfiguredLoopExit(element, loopExitCalls)) return true;
			}

			return false;

		case AST_NODE_TYPES.AssignmentExpression:
			return expressionContainsConfiguredLoopExit(unwrapped.right, loopExitCalls);

		case AST_NODE_TYPES.AwaitExpression:
			return expressionContainsConfiguredLoopExit(unwrapped.argument, loopExitCalls);

		case AST_NODE_TYPES.BinaryExpression:
			if (
				unwrapped.left.type !== AST_NODE_TYPES.PrivateIdentifier &&
				expressionContainsConfiguredLoopExit(unwrapped.left, loopExitCalls)
			)
				return true;
			return expressionContainsConfiguredLoopExit(unwrapped.right, loopExitCalls);

		case AST_NODE_TYPES.LogicalExpression:
			return (
				expressionContainsConfiguredLoopExit(unwrapped.left, loopExitCalls) ||
				expressionContainsConfiguredLoopExit(unwrapped.right, loopExitCalls)
			);

		case AST_NODE_TYPES.CallExpression: {
			if (isConfiguredLoopExitCall(unwrapped, loopExitCalls)) return true;

			if (
				unwrapped.callee.type !== AST_NODE_TYPES.Super &&
				expressionContainsConfiguredLoopExit(unwrapped.callee, loopExitCalls)
			)
				return true;

			for (const argument of unwrapped.arguments) {
				if (argument.type === AST_NODE_TYPES.SpreadElement) {
					if (expressionContainsConfiguredLoopExit(argument.argument, loopExitCalls)) return true;
					continue;
				}

				if (expressionContainsConfiguredLoopExit(argument, loopExitCalls)) return true;
			}

			return false;
		}

		case AST_NODE_TYPES.ConditionalExpression:
			return (
				expressionContainsConfiguredLoopExit(unwrapped.test, loopExitCalls) ||
				expressionContainsConfiguredLoopExit(unwrapped.consequent, loopExitCalls) ||
				expressionContainsConfiguredLoopExit(unwrapped.alternate, loopExitCalls)
			);

		case AST_NODE_TYPES.MemberExpression:
			if (
				unwrapped.object.type !== AST_NODE_TYPES.Super &&
				expressionContainsConfiguredLoopExit(unwrapped.object, loopExitCalls)
			) {
				return true;
			}

			if (unwrapped.computed) {
				return expressionContainsConfiguredLoopExit(unwrapped.property, loopExitCalls);
			}

			return false;

		case AST_NODE_TYPES.NewExpression:
			if (expressionContainsConfiguredLoopExit(unwrapped.callee, loopExitCalls)) return true;

			for (const argument of unwrapped.arguments) {
				if (argument.type === AST_NODE_TYPES.SpreadElement) {
					if (expressionContainsConfiguredLoopExit(argument.argument, loopExitCalls)) return true;
					continue;
				}

				if (expressionContainsConfiguredLoopExit(argument, loopExitCalls)) return true;
			}

			return false;

		case AST_NODE_TYPES.SequenceExpression:
			return unwrapped.expressions.some((part) => expressionContainsConfiguredLoopExit(part, loopExitCalls));

		case AST_NODE_TYPES.TaggedTemplateExpression:
			if (expressionContainsConfiguredLoopExit(unwrapped.tag, loopExitCalls)) return true;
			return unwrapped.quasi.expressions.some((part) =>
				expressionContainsConfiguredLoopExit(part, loopExitCalls),
			);

		case AST_NODE_TYPES.TemplateLiteral:
			return unwrapped.expressions.some((part) => expressionContainsConfiguredLoopExit(part, loopExitCalls));

		case AST_NODE_TYPES.UnaryExpression:
		case AST_NODE_TYPES.UpdateExpression:
			return expressionContainsConfiguredLoopExit(unwrapped.argument, loopExitCalls);

		case AST_NODE_TYPES.YieldExpression:
			return unwrapped.argument ? expressionContainsConfiguredLoopExit(unwrapped.argument, loopExitCalls) : false;

		case AST_NODE_TYPES.ArrowFunctionExpression:
		case AST_NODE_TYPES.ClassExpression:
		case AST_NODE_TYPES.FunctionExpression:
			return false;

		default:
			return false;
	}
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

			if (unwrapped.operator === "-" && typeof argument.value === "number") {
				return toConstantValue(-argument.value);
			}

			if (unwrapped.operator === "~" && typeof argument.value === "number") {
				return toConstantValue(~argument.value);
			}

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
		if (test.constant) {
			return test.value ? getConstantBoolean(unwrapped.consequent) : getConstantBoolean(unwrapped.alternate);
		}

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
		if (leftValue.value !== null && leftValue.value !== undefined) {
			return toConstantBoolean(Boolean(leftValue.value));
		}

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
	switch (loopNode.type) {
		case AST_NODE_TYPES.DoWhileStatement:
		case AST_NODE_TYPES.WhileStatement:
			return expressionContainsConfiguredLoopExit(loopNode.test, loopExitCalls);

		case AST_NODE_TYPES.ForStatement:
			if (forStatementInitContainsConfiguredLoopExit(loopNode.init, loopExitCalls)) return true;
			if (loopNode.test && expressionContainsConfiguredLoopExit(loopNode.test, loopExitCalls)) return true;
			if (loopNode.update && expressionContainsConfiguredLoopExit(loopNode.update, loopExitCalls)) return true;
			return false;

		case AST_NODE_TYPES.ForInStatement:
		case AST_NODE_TYPES.ForOfStatement:
			return expressionContainsConfiguredLoopExit(loopNode.right, loopExitCalls);

		default:
			return false;
	}
}

function statementContainsLoopExit(
	statement: TSESTree.Statement,
	loopNode: LoopNode,
	loopExitCalls: ReadonlySet<string>,
): boolean {
	switch (statement.type) {
		case AST_NODE_TYPES.BlockStatement:
			return statement.body.some((bodyStatement) =>
				statementContainsLoopExit(bodyStatement, loopNode, loopExitCalls),
			);

		case AST_NODE_TYPES.BreakStatement:
			return breaksTargetLoop(statement, loopNode);

		case AST_NODE_TYPES.ReturnStatement:
			return true;

		case AST_NODE_TYPES.DoWhileStatement:
			if (expressionContainsConfiguredLoopExit(statement.test, loopExitCalls)) return true;
			return statementContainsLoopExit(statement.body, loopNode, loopExitCalls);

		case AST_NODE_TYPES.ExpressionStatement:
			return expressionContainsConfiguredLoopExit(statement.expression, loopExitCalls);

		case AST_NODE_TYPES.ForInStatement:
			if (expressionContainsConfiguredLoopExit(statement.right, loopExitCalls)) return true;
			return statementContainsLoopExit(statement.body, loopNode, loopExitCalls);

		case AST_NODE_TYPES.ForOfStatement:
			if (expressionContainsConfiguredLoopExit(statement.right, loopExitCalls)) return true;
			return statementContainsLoopExit(statement.body, loopNode, loopExitCalls);

		case AST_NODE_TYPES.ForStatement:
			if (forStatementInitContainsConfiguredLoopExit(statement.init, loopExitCalls)) return true;
			if (statement.test && expressionContainsConfiguredLoopExit(statement.test, loopExitCalls)) return true;
			if (statement.update && expressionContainsConfiguredLoopExit(statement.update, loopExitCalls)) return true;
			return statementContainsLoopExit(statement.body, loopNode, loopExitCalls);

		case AST_NODE_TYPES.IfStatement:
			if (statementContainsLoopExit(statement.consequent, loopNode, loopExitCalls)) return true;
			return statement.alternate
				? statementContainsLoopExit(statement.alternate, loopNode, loopExitCalls)
				: false;

		case AST_NODE_TYPES.LabeledStatement:
			return statementContainsLoopExit(statement.body, loopNode, loopExitCalls);

		case AST_NODE_TYPES.SwitchStatement:
			return statement.cases.some((switchCase) =>
				switchCase.consequent.some((consequent) =>
					statementContainsLoopExit(consequent, loopNode, loopExitCalls),
				),
			);

		case AST_NODE_TYPES.TryStatement:
			if (statementContainsLoopExit(statement.block, loopNode, loopExitCalls)) return true;
			if (statement.handler && statementContainsLoopExit(statement.handler.body, loopNode, loopExitCalls))
				return true;
			if (statement.finalizer && statementContainsLoopExit(statement.finalizer, loopNode, loopExitCalls))
				return true;
			return false;

		case AST_NODE_TYPES.VariableDeclaration:
			return statement.declarations.some((declaration) =>
				declaration.init ? expressionContainsConfiguredLoopExit(declaration.init, loopExitCalls) : false,
			);

		case AST_NODE_TYPES.WhileStatement:
			if (expressionContainsConfiguredLoopExit(statement.test, loopExitCalls)) return true;
			return statementContainsLoopExit(statement.body, loopNode, loopExitCalls);

		case AST_NODE_TYPES.WithStatement:
			if (expressionContainsConfiguredLoopExit(statement.object, loopExitCalls)) return true;
			return statementContainsLoopExit(statement.body, loopNode, loopExitCalls);

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
	if (!testResult.value) return true;
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

export default createRule<Options, MessageIds>({
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
	defaultOptions: [{ loopExitCalls: [] }],
	meta: {
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
