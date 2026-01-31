import { regex } from "arktype";
import { applyEdits, modify, parse } from "jsonc-parser";
import { diff } from "just-diff";

// oxlint-disable-next-line unicorn/prefer-string-raw
const INDENTATION_REGEXP = regex("^(?<whitespace>\\s+)");
// oxlint-disable-next-line unicorn/prefer-string-raw
const MISSING_SPACE_AFTER_COLON_REGEXP = regex('":(?!\\s)', "g");

function getIndentation(line: string): string | undefined {
	return INDENTATION_REGEXP.exec(line)?.groups.whitespace ?? undefined;
}
function detectIndentation(content: string): string {
	// oxlint-disable-next-line unicorn/no-array-callback-reference
	return content.split("\n").find(getIndentation) ?? "\t";
}

/**
 * Edits a JSONC string while preserving indentation and comments.
 *
 * @param content - The JSONC string to edit.
 * @param validator - A function that validates the parsed JSONC data.
 * @param callback - A function that modifies the parsed JSONC data.
 * @returns The edited JSONC string.
 */
export function editJsonc<TInput extends object, TOutput extends TInput>(
	content: string,
	validator: (data: unknown) => TInput,
	callback: (draft: TInput) => TOutput,
): string {
	const parsed = validator(parse(content));
	const indentation = detectIndentation(content);

	const modified = callback(structuredClone(parsed));
	const changes = diff(parsed, modified);

	let updatedContent = content;
	for (const change of changes) {
		const edits = modify(updatedContent, change.path, change.value, {});

		for (const edit of edits) {
			if (edit.length === 0) {
				const indentString = `\n${indentation.repeat(change.path.length)}`;

				if (edit.content.startsWith(",")) edit.content = `,${indentString}${edit.content.slice(1)}`;
				else if (edit.content.length > 0) edit.content = `${indentString}${edit.content}`;

				edit.content = edit.content.replaceAll(MISSING_SPACE_AFTER_COLON_REGEXP, '": ');
			}
		}

		updatedContent = applyEdits(updatedContent, edits);
	}

	return updatedContent;
}
