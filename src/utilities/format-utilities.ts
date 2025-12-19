import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { regex } from "arkregex";

import type { FormatOptions } from "oxfmt";

import { formatSync, terminateWorker } from "./oxfmt-sync";

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
		const parsed: unknown = JSON.parse(configText);

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

export function getExtension(filePath: string): string | undefined {
	if (filePath.endsWith(".tsx")) return ".tsx";
	if (filePath.endsWith(".ts")) return ".ts";
	if (filePath.endsWith(".jsx")) return ".jsx";
	if (filePath.endsWith(".js")) return ".js";
	if (filePath.endsWith(".mts")) return ".mts";
	if (filePath.endsWith(".mjs")) return ".mjs";
	if (filePath.endsWith(".cts")) return ".cts";
	if (filePath.endsWith(".cjs")) return ".cjs";
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

	return [
		{
			deleteText: original,
			insertText: formatted,
			offset: 0,
			operation: "REPLACE",
		},
	];
}

const MAX_LENGTH = 60;
const SYMBOLS: Record<string, string> = {
	" ": "·",
	"\n": "␊",
	"\r": "␍",
	"\t": "→",
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

export const __testing = { loadOxfmtConfig };

export { terminateWorker };
