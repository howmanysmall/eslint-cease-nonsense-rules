import fs from "node:fs";
import { resolve } from "node:path";
import { formatSync } from "$oxfmt-sync";
import { regex } from "arktype";
import { parseJSONC } from "confbox";
import fastDiff from "fast-diff";

import { isRecordFast } from "./type-utilities";

import type { FormatConfiguration } from "$oxfmt-worker";

export interface Difference {
	readonly deleteText?: string;
	readonly insertText?: string;
	readonly offset: number;
	readonly operation: "INSERT" | "DELETE" | "REPLACE";
}

let cachedConfig: FormatConfiguration | undefined;

function loadOxfmtConfig(): FormatConfiguration {
	if (cachedConfig !== undefined) return cachedConfig;

	try {
		const configPath = resolve(process.cwd(), ".oxfmtrc.json");
		const configText = fs.readFileSync(configPath, "utf8");
		const parsed = parseJSONC<Record<string, unknown>>(configText);

		if (!isRecordFast(parsed)) {
			cachedConfig = {};
			return cachedConfig;
		}

		// oxlint-disable-next-line sonar/no-unused-vars -- garbage!
		const { $schema: _schema, ignorePatterns: _ignore, ...formatOptions } = parsed;

		cachedConfig = formatOptions;
		return cachedConfig;
	} catch {
		cachedConfig = {};
		return cachedConfig;
	}
}

const enum CharacterType {
	Period = 0x2e,
	LowerC = 0x63,
	LowerJ = 0x6a,
	LowerM = 0x6d,
	LowerS = 0x73,
	LowerT = 0x74,
	LowerX = 0x78,
}

// oxlint-disable-next-line sonar/cognitive-complexity -- optimization
export function getExtension(filePath: string): string | undefined {
	const { length } = filePath;

	if (length >= 3 && filePath.codePointAt(length - 3) === CharacterType.Period) {
		const character1 = filePath.codePointAt(length - 2);
		const character2 = filePath.codePointAt(length - 1);
		if (character1 === CharacterType.LowerT && character2 === CharacterType.LowerS) return ".ts";
		if (character1 === CharacterType.LowerJ && character2 === CharacterType.LowerS) return ".js";
	}

	if (length >= 4 && filePath.codePointAt(length - 4) === CharacterType.Period) {
		const character1 = filePath.codePointAt(length - 3);
		const character2 = filePath.codePointAt(length - 2);
		const character3 = filePath.codePointAt(length - 1);

		if (character3 === CharacterType.LowerX) {
			if (character1 === CharacterType.LowerT && character2 === CharacterType.LowerS) return ".tsx";
			if (character1 === CharacterType.LowerJ && character2 === CharacterType.LowerS) return ".jsx";
		} else if (character3 === CharacterType.LowerS) {
			if (character2 === CharacterType.LowerT) {
				if (character1 === CharacterType.LowerM) return ".mts";
				if (character1 === CharacterType.LowerC) return ".cts";
			} else if (character2 === CharacterType.LowerJ) {
				if (character1 === CharacterType.LowerM) return ".mjs";
				if (character1 === CharacterType.LowerC) return ".cjs";
			}
		}
	}

	return undefined;
}

export function formatWithOxfmtSync(source: string, filePath: string): string {
	const extension = getExtension(filePath);
	if (extension === undefined) {
		const error = new Error(`Unsupported file extension for ${filePath}`);
		Error.captureStackTrace(error, formatWithOxfmtSync);
		throw error;
	}

	const config = loadOxfmtConfig();
	return formatSync(filePath, source, config);
}

// oxlint-disable-next-line sonar/cognitive-complexity -- diff algo
export function generateDifferences(original: string, formatted: string): ReadonlyArray<Difference> {
	if (original === formatted) return [];

	const diffs = fastDiff(original, formatted);
	const differences = new Array<Difference>();
	let size = 0;
	let offset = 0;
	let index = 0;

	while (index < diffs.length) {
		const diff = diffs[index];
		if (diff === undefined) break;

		const [type, text] = diff;

		if (type === 0) {
			offset += text.length;
			index += 1;
		} else if (type === -1) {
			let adjustedOffset = offset;

			const previous = diffs[index - 1];
			if (previous?.[0] === 0) {
				const [, previousText] = previous;
				let shiftCount = 0;
				while (
					shiftCount < previousText.length &&
					shiftCount < text.length &&
					previousText[previousText.length - 1 - shiftCount] === text[shiftCount]
				) {
					shiftCount += 1;
				}
				adjustedOffset -= shiftCount;
			}

			const next = diffs[index + 1];
			if (next?.[0] === 1) {
				const [, nextText] = next;
				differences[size++] = {
					deleteText: text,
					insertText: nextText,
					offset: adjustedOffset,
					operation: "REPLACE",
				};
				index += 2;
			} else {
				differences[size++] = { deleteText: text, offset: adjustedOffset, operation: "DELETE" };
				index += 1;
			}
			offset += text.length;
		} else {
			differences[size++] = { insertText: text, offset, operation: "INSERT" };
			index += 1;
		}
	}

	return differences;
}

const MAX_LENGTH = 60;
// oxlint-disable-next-line sort-keys -- conflict.
const SYMBOLS: Record<string, string> = {
	" ": "\u{00B7}",
	"\n": "\u{240A}",
	"\r": "\u{240D}",
	"\t": "\u{2192}",
};

const WHITESPACE_REGEXP = regex("[\r\n\t ]", "gu");
function toSymbol(character: string): string {
	return SYMBOLS[character] ?? character;
}

export function showInvisibles(text: string): string {
	let result = text;
	if (result.length > MAX_LENGTH) result = `${result.slice(0, MAX_LENGTH)}…`;
	return result.replaceAll(WHITESPACE_REGEXP, toSymbol);
}

function resetConfigCache(): void {
	cachedConfig = undefined;
}

export const __testing = { loadOxfmtConfig, resetConfigCache };
