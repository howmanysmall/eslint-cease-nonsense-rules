import type { Rule } from "eslint";
import type { ArrowFunctionExpression, BlockStatement, FunctionDeclaration, FunctionExpression, IfStatement } from "estree";

const DEFAULT_MAXIMUM_STATEMENTS = 1;

interface Options {
	readonly maximumStatements?: number;
}

type FunctionNode = FunctionDeclaration | FunctionExpression | ArrowFunctionExpression;

/**
 * Checks if a statement is a lonely if statement (no else clause).
 * @param statement - The statement to check
 * @returns True if the statement is an if without else
 */
function isLonelyIfStatement(statement: IfStatement): boolean {
	return statement.alternate === null;
}

/**
 * Checks if the if statement's consequent exceeds the maximum statements.
 * @param consequent - The if consequent node
 * @param maxStatements - The maximum allowed statements
 * @returns True if the consequent exceeds the maximum
 */
function isOffendingConsequent(consequent: IfStatement["consequent"], maxStatements: number): boolean {
	if (consequent.type === "ExpressionStatement" && maxStatements === 0) {
		return true;
	}
	if (consequent.type === "BlockStatement" && consequent.body.length > maxStatements) {
		return true;
	}
	return false;
}

/**
 * Checks if a function body can be simplified with an early return.
 *
 * Returns true if:
 * - The body is a block statement
 * - It contains exactly one statement
 * - That statement is an if without else
 * - The if's consequent exceeds maximumStatements
 * @param body - The function body block
 * @param maxStatements - The maximum allowed statements
 * @returns True if the body can be simplified with an early return
 */
function hasSimplifiableConditionalBody(body: BlockStatement, maxStatements: number): boolean {
	if (body.body.length !== 1) return false;

	const [statement] = body.body;
	if (statement === undefined || statement.type !== "IfStatement") return false;
	if (!isLonelyIfStatement(statement)) return false;

	return isOffendingConsequent(statement.consequent, maxStatements);
}

const preferEarlyReturn: Rule.RuleModule = {
	create(context) {
		const options = (context.options[0] as Options | undefined) ?? {};
		const maxStatements = options.maximumStatements ?? DEFAULT_MAXIMUM_STATEMENTS;

		function checkFunctionBody(node: FunctionNode): void {
			const { body } = node;

			// Arrow functions with expression bodies are fine
			if (body.type !== "BlockStatement") return;

			if (hasSimplifiableConditionalBody(body, maxStatements)) {
				context.report({
					message: "Prefer an early return to a conditionally-wrapped function body",
					node: body,
				});
			}
		}

		return {
			ArrowFunctionExpression: checkFunctionBody,
			FunctionDeclaration: checkFunctionBody,
			FunctionExpression: checkFunctionBody,
		};
	},
	meta: {
		docs: {
			description: "Prefer early returns over full-body conditional wrapping in function declarations.",
			recommended: false,
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
};

export default preferEarlyReturn;
