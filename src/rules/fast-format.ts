import type { Difference } from "@utilities/format-utilities";
import {
	formatWithOxfmtSync as formatWithOxfmt,
	generateDifferences,
	getExtension,
	showInvisibles,
} from "@utilities/format-utilities";
import type { Rule, SourceCode } from "eslint";

const INSERT = "INSERT";
const DELETE = "DELETE";
const REPLACE = "REPLACE";
const DEFAULT_CACHE_CAPACITY = 32;

interface LocatableSourceCode {
	readonly getLocFromIndex?: SourceCode["getLocFromIndex"];
	readonly text: string;
}

type FormatCacheEntry =
	| {
			readonly formatted: string;
			readonly kind: "formatted";
	  }
	| {
			readonly kind: "error";
			readonly message: string;
	  };

interface FormatCache {
	clear(): void;
	get(key: string): FormatCacheEntry | undefined;
	set(key: string, value: FormatCacheEntry): FormatCacheEntry;
}

interface FastFormatServices {
	readonly format: (source: string, filePath: string) => string;
	readonly generate: (original: string, formatted: string) => ReadonlyArray<Difference>;
	readonly show: (text: string) => string;
}

interface FastFormatOptions {
	readonly cache?: FormatCache;
	readonly services?: Partial<FastFormatServices>;
}

export function getLocFromIndex(sourceCode: LocatableSourceCode, index: number): { line: number; column: number } {
	if (typeof sourceCode.getLocFromIndex === "function") return sourceCode.getLocFromIndex(index);
	return { column: index, line: 1 };
}

function createCacheKey(filename: string, source: string): string {
	return `${filename}::${source}`;
}

function createLruCache(limit: number): FormatCache {
	const entries = new Map<string, FormatCacheEntry>();
	const capacity = Math.max(limit, 1);

	function clear(): void {
		entries.clear();
	}

	function get(key: string): FormatCacheEntry | undefined {
		const value = entries.get(key);
		if (value === undefined) return undefined;

		entries.delete(key);
		entries.set(key, value);
		return value;
	}

	function set(key: string, value: FormatCacheEntry): FormatCacheEntry {
		entries.set(key, value);

		if (entries.size > capacity) {
			const oldestKey = entries.keys().next().value;
			if (oldestKey !== undefined) entries.delete(oldestKey);
		}

		return value;
	}

	return { clear, get, set };
}

function cacheFormattedResult(
	cache: FormatCache,
	filename: string,
	source: string,
	formatted: string,
): FormatCacheEntry {
	const entry: FormatCacheEntry = { formatted, kind: "formatted" };
	const sourceKey = createCacheKey(filename, source);
	cache.set(sourceKey, entry);
	if (formatted !== source) {
		const formattedKey = createCacheKey(filename, formatted);
		cache.set(formattedKey, entry);
	}
	return entry;
}

function formatWithCaching(
	cache: FormatCache,
	filename: string,
	source: string,
	services: FastFormatServices,
): FormatCacheEntry {
	const cacheKey = createCacheKey(filename, source);
	const cached = cache.get(cacheKey);
	if (cached !== undefined) return cached;

	try {
		const formatted = services.format(source, filename);
		return cacheFormattedResult(cache, filename, source, formatted);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return cache.set(cacheKey, { kind: "error", message: `Oxfmt error: ${message}` });
	}
}

export function createFormatCache(limit = DEFAULT_CACHE_CAPACITY): FormatCache {
	return createLruCache(limit);
}

const defaultServices: FastFormatServices = {
	format: formatWithOxfmt,
	generate: generateDifferences,
	show: showInvisibles,
};

const defaultCache = createFormatCache();

export function createFastFormatRule(options: FastFormatOptions = {}): Rule.RuleModule {
	const cache = options.cache ?? defaultCache;
	const services: FastFormatServices = {
		format: options.services?.format ?? defaultServices.format,
		generate: options.services?.generate ?? defaultServices.generate,
		show: options.services?.show ?? defaultServices.show,
	};

	return {
		create(context) {
			const { filename, sourceCode } = context;

			// Optimization: Skip non-JS/TS files entirely
			if (getExtension(filename) === undefined) return {};

			return {
				Program() {
					const source = sourceCode.text;
					const outcome = formatWithCaching(cache, filename, source, services);

					if (outcome.kind === "error") {
						context.report({
							loc: { column: 0, line: 1 },
							message: outcome.message,
						});
						return;
					}

					if (source === outcome.formatted) return;

					const differences = services.generate(source, outcome.formatted);
					for (const { operation, offset, deleteText, insertText } of differences) {
						const range: [number, number] = [offset, offset + (deleteText?.length ?? 0)];

						context.report({
							data: {
								deleteText: services.show(deleteText ?? ""),
								insertText: services.show(insertText ?? ""),
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
}

const fastFormat = createFastFormatRule();

export default fastFormat;
