import type { Rule, SourceCode } from "eslint";
import {
	formatWithOxfmtSync as formatWithOxfmt,
	generateDifferences,
	showInvisibles,
} from "../utilities/format-utilities";

const INSERT = "INSERT";
const DELETE = "DELETE";
const REPLACE = "REPLACE";

function getLocFromIndex(sourceCode: SourceCode, index: number): { line: number; column: number } {
	if (typeof sourceCode.getLocFromIndex === "function") return sourceCode.getLocFromIndex(index);
	return { column: index, line: 1 };
}

const fastFormat: Rule.RuleModule = {
	create(context) {
		const { filename, sourceCode } = context;
		const source = sourceCode.text;

		return {
			Program() {
				let formatted: string;

				try {
					formatted = formatWithOxfmt(source, filename);
				} catch (error) {
					context.report({
						loc: { column: 0, line: 1 },
						message: `Oxfmt error: ${error instanceof Error ? error.message : String(error)}`,
					});
					return;
				}

				if (source === formatted) return;

				const differences = generateDifferences(source, formatted);
				for (const { operation, offset, deleteText, insertText } of differences) {
					const range: [number, number] = [offset, offset + (deleteText?.length ?? 0)];

					context.report({
						data: {
							deleteText: showInvisibles(deleteText ?? ""),
							insertText: showInvisibles(insertText ?? ""),
						},
						fix: (fixer) => fixer.replaceTextRange(range, insertText ?? ""),
						loc: {
							end: getLocFromIndex(sourceCode, range[1]),
							start: getLocFromIndex(sourceCode, range[0]),
						},
						messageId: operation,
					});
				}
			},
		};
	},
	meta: {
		docs: {
			description: "Enforce oxfmt code formatting",
			recommended: true,
		},
		fixable: "code",
		messages: {
			[INSERT]: "Insert `{{ insertText }}`",
			[DELETE]: "Delete `{{ deleteText }}`",
			[REPLACE]: "Replace `{{ deleteText }}` with `{{ insertText }}`",
		},
		schema: [],
		type: "layout",
	},
};

export default fastFormat;
