import nodePath from "node:path";
import { hasCodeLines } from "$recognizers/code-recognizer";
import { createJavaScriptDetectors } from "$recognizers/javascript-footprint";
import { isNumber, isString } from "$utilities/type-utilities";
import { parseSync } from "oxc-parser";

import type { Rule } from "eslint";
import type { Comment } from "estree";
import type { Directive, Expression, Statement } from "oxc-parser";

const EXCLUDED_STATEMENTS = new Set(["BreakStatement", "LabeledStatement", "ContinueStatement"]);

interface CommentWithLocation extends Comment {
	readonly loc: NonNullable<Comment["loc"]>;
	readonly range: [number, number];
}

interface CommentGroup {
	readonly firstComment: CommentWithLocation;
	readonly lastComment: CommentWithLocation;
	readonly value: string;
}

interface PendingLineCommentGroup {
	readonly comments: Array<CommentWithLocation>;
	readonly firstComment: CommentWithLocation;
	readonly lastComment: CommentWithLocation;
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
	if (!tokenAfterPrevious) return true;
	return tokenAfterPrevious.loc.start.line > nextLine;
}

function groupComments(
	comments: ReadonlyArray<CommentWithLocation>,
	sourceCode: Rule.RuleContext["sourceCode"],
): Array<CommentGroup> {
	const groups = new Array<CommentGroup>();
	let groupsSize = 0;
	let pendingLineGroup: PendingLineCommentGroup | undefined;

	for (const comment of comments) {
		if (comment.type === "Block") {
			if (pendingLineGroup) {
				groups[groupsSize++] = {
					firstComment: pendingLineGroup.firstComment,
					lastComment: pendingLineGroup.lastComment,
					value: pendingLineGroup.comments.map(({ value }) => value).join("\n"),
				};
				pendingLineGroup = undefined;
			}
			groups[groupsSize++] = {
				firstComment: comment,
				lastComment: comment,
				value: comment.value,
			};
		} else if (pendingLineGroup) {
			if (areAdjacentLineComments(pendingLineGroup.lastComment, comment, sourceCode)) {
				pendingLineGroup.comments.push(comment);
				pendingLineGroup = { ...pendingLineGroup, lastComment: comment };
			} else {
				groups[groupsSize++] = {
					firstComment: pendingLineGroup.firstComment,
					lastComment: pendingLineGroup.lastComment,
					value: pendingLineGroup.comments.map(({ value }) => value).join("\n"),
				};
				pendingLineGroup = {
					comments: [comment],
					firstComment: comment,
					lastComment: comment,
				};
			}
		} else {
			pendingLineGroup = {
				comments: [comment],
				firstComment: comment,
				lastComment: comment,
			};
		}
	}

	if (pendingLineGroup) {
		groups[groupsSize] = {
			firstComment: pendingLineGroup.firstComment,
			lastComment: pendingLineGroup.lastComment,
			value: pendingLineGroup.comments.map(({ value }) => value).join("\n"),
		};
	}

	return groups;
}

function injectMissingBraces(value: string): string {
	const openCount = (value.match(/\{/gu) ?? []).length;
	const closeCount = (value.match(/\}/gu) ?? []).length;
	const diff = openCount - closeCount;

	if (diff > 0) return value + "}".repeat(diff);
	if (diff < 0) return "{".repeat(-diff) + value;
	return value;
}

function couldBeJsCode(input: string): boolean {
	return hasCodeLines(detectors, input.split("\n"));
}

type ParsedStatement = Directive | Statement;

function isReturnOrThrowExclusion(statement: ParsedStatement): boolean {
	if (statement.type !== "ReturnStatement" && statement.type !== "ThrowStatement") return false;
	return statement.argument?.type === "Identifier";
}

function isUnaryPlusMinus(expression: Expression): boolean {
	return expression.type === "UnaryExpression" && (expression.operator === "-" || expression.operator === "+");
}

function isExcludedLiteral(expression: Expression): boolean {
	if (expression.type !== "Literal") return false;
	return isString(expression.value) || isNumber(expression.value);
}

function isExpressionExclusion(statement: ParsedStatement, codeText: string): boolean {
	if (statement.type !== "ExpressionStatement") return false;

	const { expression } = statement;

	return (
		expression.type === "Identifier" ||
		expression.type === "SequenceExpression" ||
		isUnaryPlusMinus(expression) ||
		isExcludedLiteral(expression) ||
		!codeText.trimEnd().endsWith(";")
	);
}

function getSingleStatement(statements: ReadonlyArray<ParsedStatement>): ParsedStatement | undefined {
	if (statements.length !== 1) return undefined;
	return statements[0];
}

function isExclusion(statements: ReadonlyArray<ParsedStatement>, codeText: string): boolean {
	const statement = getSingleStatement(statements);

	return (
		statement !== undefined &&
		(EXCLUDED_STATEMENTS.has(statement.type) ||
			isReturnOrThrowExclusion(statement) ||
			isExpressionExclusion(statement, codeText))
	);
}

const ALLOWED_PARSE_ERROR_PATTERNS = [/A 'return' statement can only be used within a function body/u] as const;
type Errors = ReadonlyArray<{ readonly message: string }>;
function hasOnlyAllowedErrors(errors: Errors): boolean {
	return errors.every((error) => ALLOWED_PARSE_ERROR_PATTERNS.some((pattern) => pattern.test(error.message)));
}

interface Body {
	readonly body: ReadonlyArray<ParsedStatement>;
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
	const extension = nodePath.extname(filename);
	const parseFilename = `file${extension || ".js"}`;
	const result = parseSync(parseFilename, value);

	if (isValidParseResult(result)) return result;

	const jsxResult = parseSync("file.tsx", value);
	if (isValidParseResult(jsxResult)) return jsxResult;

	return undefined;
}

function containsCode(value: string, filename: string): boolean {
	if (!couldBeJsCode(value)) return false;

	const result = tryParse(value, filename);
	if (!result) return false;

	return !isExclusion(result.program.body, value);
}

const noCommentedCode: Rule.RuleModule = {
	create(context): Rule.RuleListener {
		return {
			"Program:exit"(): void {
				const allComments = context.sourceCode.getAllComments().filter(isCommentWithLocation);
				const groups = groupComments(allComments, context.sourceCode);

				for (const group of groups) {
					const trimmedValue = group.value.trim();

					// Skip lone closing brace
					if (trimmedValue === "}") continue;

					const balanced = injectMissingBraces(trimmedValue);
					if (!containsCode(balanced, context.filename)) continue;

					const { firstComment, lastComment } = group;

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
