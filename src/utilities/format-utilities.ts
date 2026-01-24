import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { regex } from "arkregex";
import { parseJSONC } from "confbox";
import fastDiff from "fast-diff";
import { formatSync } from "../oxfmt-sync";
import type { FormatOptions } from "../oxfmt-worker";

export interface Difference {
	readonly operation: "INSERT" | "DELETE" | "REPLACE";
	readonly offset: number;
	readonly deleteText?: string;
	readonly insertText?: string;
}

let cachedConfig: FormatOptions | undefined;

function loadOxfmtConfig(): FormatOptions {
	if (cachedConfig !== undefined) return cachedConfig;

	try {
		const configPath = resolve(process.cwd(), ".oxfmtrc.json");
		const configText = readFileSync(configPath, "utf8");
		const parsed: unknown = parseJSONC(configText);

		if (typeof parsed !== "object" || parsed === null) {
			cachedConfig = {};
			return cachedConfig;
		}

		const config = parsed as Record<string, unknown>;
		const { $schema: _schema, ignorePatterns: _ignore, ...formatOptions } = config;

		cachedConfig = formatOptions as FormatOptions;
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
	if (extension === undefined) throw new Error(`Unsupported file extension for ${filePath}`);

	const config = loadOxfmtConfig();
	return formatSync(filePath, source, config);
}

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
				const [, prevText] = previous;
				let shiftCount = 0;
				while (
					shiftCount < prevText.length &&
					shiftCount < text.length &&
					prevText[prevText.length - 1 - shiftCount] === text[shiftCount]
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
const SYMBOLS: Record<string, string> = {
	" ": "\u{00B7}",
	"\n": "\u{240A}",
	"\r": "\u{240D}",
	"\t": "\u{2192}",
};

const WHITESPACE_REGEXP = regex("[\r\n\t ]", "g");
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
