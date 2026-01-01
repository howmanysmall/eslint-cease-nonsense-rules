import path from "node:path";
import type { Rule } from "eslint";
import type { Comment } from "estree";
import { parseSync } from "oxc-parser";
import { hasCodeLines } from "../recognizers/code-recognizer";
import { createJavaScriptDetectors } from "../recognizers/javascript-footprint";

const EXCLUDED_STATEMENTS = new Set(["BreakStatement", "LabeledStatement", "ContinueStatement"]);

interface CommentWithLocation extends Comment {
	readonly loc: NonNullable<Comment["loc"]>;
	readonly range: [number, number];
}

interface CommentGroup {
	readonly value: string;
	readonly comments: ReadonlyArray<CommentWithLocation>;
}

const detectors = createJavaScriptDetectors();

function isCommentWithLocation(comment: Comment): comment is CommentWithLocation {
	return comment.loc !== undefined && comment.range !== undefined;
}

function areAdjacentLineComments(
	previous: CommentWithLocation,
	next: CommentWithLocation,
	sourceCode: Rule.RuleContext["sourceCode"],
): boolean {
	const previousLine = previous.loc.start.line;
	const nextLine = next.loc.start.line;

	if (previousLine + 1 !== nextLine) return false;

	// Check no code token between them
	// ESLint's getTokenAfter accepts Comment which has type/value/range/loc
	const commentForApi: Comment = {
		loc: previous.loc,
		range: previous.range,
		type: previous.type,
		value: previous.value,
	};
	const tokenAfterPrevious = sourceCode.getTokenAfter(commentForApi);
	return !tokenAfterPrevious || tokenAfterPrevious.loc.start.line > nextLine;
}

function groupComments(
	comments: ReadonlyArray<Comment>,
	sourceCode: Rule.RuleContext["sourceCode"],
): Array<CommentGroup> {
	const groups = new Array<CommentGroup>();
	let groupsSize = 0;
	let currentLineComments = new Array<CommentWithLocation>();
	let size = 0;

	for (const comment of comments) {
		if (!isCommentWithLocation(comment)) continue;

		if (comment.type === "Block") {
			// Flush current line comments
			if (size > 0) {
				groups[groupsSize++] = {
					comments: currentLineComments,
					value: currentLineComments.map(({ value }) => value).join("\n"),
				};
				currentLineComments = [];
				size = 0;
			}
			// Block comment is its own group
			groups[groupsSize++] = {
				comments: [comment],
				value: comment.value,
			};
		} else if (size === 0) currentLineComments[size++] = comment;
		else {
			const lastComment = currentLineComments.at(-1);
			if (lastComment && areAdjacentLineComments(lastComment, comment, sourceCode)) {
				currentLineComments[size++] = comment;
			} else {
				// Not adjacent, flush and start new group
				groups[groupsSize++] = {
					comments: currentLineComments,
					value: currentLineComments.map(({ value }) => value).join("\n"),
				};
				currentLineComments = [comment];
				size = 1;
			}
		}
	}

	// Flush remaining line comments
	if (size > 0) {
		groups[groupsSize++] = {
			comments: currentLineComments,
			value: currentLineComments.map(({ value }) => value).join("\n"),
		};
	}

	return groups;
}

function injectMissingBraces(value: string): string {
	const openCount = (value.match(/{/g) ?? []).length;
	const closeCount = (value.match(/}/g) ?? []).length;
	const diff = openCount - closeCount;

	if (diff > 0) return value + "}".repeat(diff);
	if (diff < 0) return "{".repeat(-diff) + value;
	return value;
}

function couldBeJsCode(input: string): boolean {
	const lines = input.split("\n");
	return hasCodeLines(detectors, lines);
}

function isReturnOrThrowExclusion(statement: { type: string; argument?: { type: string } | undefined }): boolean {
	if (statement.type !== "ReturnStatement" && statement.type !== "ThrowStatement") return false;
	return statement.argument === undefined || statement.argument.type === "Identifier";
}

function isUnaryPlusMinus(expression: { type: string; operator?: string }): boolean {
	return expression.type === "UnaryExpression" && (expression.operator === "+" || expression.operator === "-");
}

function isExcludedLiteral(expression: { type: string; value?: unknown }): boolean {
	if (expression.type !== "Literal") return false;
	return typeof expression.value === "string" || typeof expression.value === "number";
}

interface ParsedExpression {
	type: string;
	operator?: string;
	value?: unknown;
}

interface ParsedStatement {
	type: string;
	argument?: { type: string } | undefined;
	expression?: ParsedExpression;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== undefined;
}

function isParsedStatement(value: unknown): value is ParsedStatement {
	if (!isRecord(value)) return false;
	return typeof value.type === "string";
}

function toParsedStatements(body: ReadonlyArray<unknown>): ReadonlyArray<ParsedStatement> {
	const result: Array<ParsedStatement> = [];
	for (const item of body) {
		if (isParsedStatement(item)) result.push(item);
	}
	return result;
}

function isExpressionExclusion(statement: ParsedStatement, codeText: string): boolean {
	if (statement.type !== "ExpressionStatement") return false;

	const { expression } = statement;
	if (!expression) return false;

	if (expression.type === "Identifier") return true;
	if (expression.type === "SequenceExpression") return true;
	if (isUnaryPlusMinus(expression)) return true;
	if (isExcludedLiteral(expression)) return true;

	// Check for missing semicolon (code doesn't end with ;)
	if (!codeText.trimEnd().endsWith(";")) return true;

	return false;
}

function isExclusion(statements: ReadonlyArray<ParsedStatement>, codeText: string): boolean {
	if (statements.length !== 1) return false;

	const statement = statements.at(0);
	if (!statement) return false;

	if (EXCLUDED_STATEMENTS.has(statement.type)) return true;
	if (isReturnOrThrowExclusion(statement)) return true;
	if (isExpressionExclusion(statement, codeText)) return true;

	return false;
}

const ALLOWED_PARSE_ERROR_PATTERNS = [/A 'return' statement can only be used within a function body/] as const;
type Errors = ReadonlyArray<{ readonly message: string }>;
function hasOnlyAllowedErrors(errors: Errors): boolean {
	return errors.every((error) => ALLOWED_PARSE_ERROR_PATTERNS.some((pattern) => pattern.test(error.message)));
}

interface Body {
	readonly body: ReadonlyArray<unknown>;
}

interface ParseResult {
	readonly errors: Errors;
	readonly program: Body;
}

function isValidParseResult(result: ParseResult): boolean {
	const hasValidErrors = result.errors.length === 0 || hasOnlyAllowedErrors(result.errors);
	return hasValidErrors && result.program.body.length > 0;
}

function tryParse(value: string, filename: string): ParseResult | undefined {
	const ext = path.extname(filename);
	const parseFilename = `file${ext || ".js"}`;
	const result = parseSync(parseFilename, value);

	if (isValidParseResult(result)) return result;

	// Retry with .tsx for JSX support if original ext wasn't jsx/tsx
	if (ext !== ".tsx" && ext !== ".jsx") {
		const jsxResult = parseSync("file.tsx", value);
		if (isValidParseResult(jsxResult)) return jsxResult;
	}

	return undefined;
}

function containsCode(value: string, filename: string): boolean {
	if (!couldBeJsCode(value)) return false;

	const result = tryParse(value, filename);
	if (!result) return false;

	const statements = toParsedStatements(result.program.body);
	return !isExclusion(statements, value);
}

const noCommentedCode: Rule.RuleModule = {
	create(context) {
		return {
			"Program:exit"() {
				const allComments = context.sourceCode.getAllComments();
				const groups = groupComments(allComments, context.sourceCode);

				for (const group of groups) {
					const trimmedValue = group.value.trim();

					// Skip lone closing brace
					if (trimmedValue === "}") continue;

					const balanced = injectMissingBraces(trimmedValue);
					if (!containsCode(balanced, context.filename)) return;

					const firstComment = group.comments.at(0);
					const lastComment = group.comments.at(-1);

					if (!(firstComment && lastComment)) continue;

					context.report({
						loc: {
							end: lastComment.loc.end,
							start: firstComment.loc.start,
						},
						messageId: "commentedCode",
						suggest: [
							{
								desc: "Remove this commented out code",
								fix(fixer): Rule.Fix {
									return fixer.removeRange([firstComment.range[0], lastComment.range[1]]);
								},
							},
						],
					});
				}
			},
		};
	},
	meta: {
		docs: {
			description: "Disallow commented-out code",
			recommended: false,
		},
		hasSuggestions: true,
		messages: {
			commentedCode:
				"Commented-out code creates confusion about intent and clutters the codebase. Version control preserves history, making dead code comments unnecessary. Delete the commented code entirely. If needed later, retrieve it from git history.",
		},
		schema: [],
		type: "suggestion",
	},
};

export default noCommentedCode;
