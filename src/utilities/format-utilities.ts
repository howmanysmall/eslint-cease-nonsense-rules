import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface Difference {
	readonly operation: "INSERT" | "DELETE" | "REPLACE";
	readonly offset: number;
	readonly deleteText?: string;
	readonly insertText?: string;
}

const IS_DIRNAME_UNDEFINED = typeof __dirname === "undefined";

export function resolveOxfmtPath(
	pathResolver: (path: string) => string = fileURLToPath,
	usePathResolver: boolean = IS_DIRNAME_UNDEFINED,
): string {
	if (usePathResolver) {
		try {
			const currentDirectory = dirname(pathResolver(import.meta.url));
			const oxfmtBin = resolve(currentDirectory, "../../node_modules/.bin/oxfmt");
			return oxfmtBin;
		} catch {
			return "oxfmt";
		}
	}

	return resolve(__dirname, "../../node_modules/.bin/oxfmt");
}

function getExtension(filePath: string): string {
	return filePath.endsWith(".tsx")
		? ".tsx"
		: filePath.endsWith(".jsx")
			? ".jsx"
			: filePath.endsWith(".js")
				? ".js"
				: ".ts";
}

/**
 * Format source code with oxfmt (synchronous).
 *
 * @param source - The source code to format
 * @param filePath - Original filepath (used for extension detection)
 * @returns Formatted source code
 * @throws Error if formatting fails
 */
export function formatWithOxfmtSync(source: string, filePath: string): string {
	const extension = getExtension(filePath);
	const tempDir = mkdtempSync(join(tmpdir(), "eslint-oxfmt-"));
	const tempFile = join(tempDir, `format${extension}`);

	try {
		writeFileSync(tempFile, source, "utf8");

		const oxfmtPath = resolveOxfmtPath();
		const result = spawnSync(oxfmtPath, [tempFile], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		});

		if (result.error) throw new Error(`Failed to execute oxfmt: ${result.error.message}`);
		if (result.status !== 0) throw new Error(`Oxfmt failed: ${result.stderr || "Unknown error"}`);

		const formatted = readFileSync(tempFile, "utf8");
		return formatted;
	} finally {
		try {
			unlinkSync(tempFile);
		} catch {
			// No operation
		}
	}
}

/**
 * Generate differences between original and formatted text.
 * Simple implementation - just one big REPLACE if different.
 * ESLint will show the specific locations anyway.
 *
 * @param original - Original source code
 * @param formatted - Formatted source code
 * @returns Array of differences
 */
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

const WHITESPACE_REGEXP = /[\r\n\t ]/g;
function toSymbol(character: string): string {
	return SYMBOLS[character] ?? character;
}

/**
 * Show invisible characters for better error messages.
 *
 * @param text - Text to process
 * @returns Text with invisible characters made visible
 */
export function showInvisibles(text: string): string {
	let result = text;
	if (result.length > MAX_LENGTH) result = `${result.slice(0, MAX_LENGTH)}…`;
	return result.replaceAll(WHITESPACE_REGEXP, toSymbol);
}
