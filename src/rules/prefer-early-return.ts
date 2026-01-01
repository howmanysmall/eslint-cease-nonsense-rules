import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utilities/create-rule";

type MessageIds = "preferEarlyReturn";

const DEFAULT_MAXIMUM_STATEMENTS = 1;

interface Options {
	readonly maximumStatements?: number;
}

type FunctionNode = TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression;

function isLonelyIfStatement(statement: TSESTree.IfStatement): boolean {
	return statement.alternate === null;
}

function isOffendingConsequent(consequent: TSESTree.IfStatement["consequent"], maxStatements: number): boolean {
	return (
		(consequent.type === AST_NODE_TYPES.ExpressionStatement && maxStatements === 0) ||
		(consequent.type === AST_NODE_TYPES.BlockStatement && consequent.body.length > maxStatements)
	);
}

function canSimplifyConditionalBody(body: TSESTree.BlockStatement, maxStatements: number): boolean {
	if (body.body.length !== 1) return false;

	const [statement] = body.body;
	if (statement === undefined || statement.type !== AST_NODE_TYPES.IfStatement || !isLonelyIfStatement(statement)) {
		return false;
	}

	return isOffendingConsequent(statement.consequent, maxStatements);
}

export default createRule<[Options?], MessageIds>({
	create(context) {
		const options = context.options[0] ?? {};
		const maxStatements = options.maximumStatements ?? DEFAULT_MAXIMUM_STATEMENTS;

		function checkFunctionBody(node: FunctionNode): void {
			const { body } = node;
			if (body.type !== AST_NODE_TYPES.BlockStatement || !canSimplifyConditionalBody(body, maxStatements)) return;
			context.report({
				messageId: "preferEarlyReturn",
				node: body,
			});
		}

		return {
			ArrowFunctionExpression: checkFunctionBody,
			FunctionDeclaration: checkFunctionBody,
			FunctionExpression: checkFunctionBody,
		};
	},
	defaultOptions: [{}],
	meta: {
		docs: {
			description: "Prefer early returns over full-body conditional wrapping in function declarations.",
		},
		messages: {
			preferEarlyReturn: "Prefer an early return to a conditionally-wrapped function body",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					maximumStatements: { type: "integer" },
				},
				type: "object",
			},
		],
		type: "suggestion",
	},
	name: "prefer-early-return",
});
