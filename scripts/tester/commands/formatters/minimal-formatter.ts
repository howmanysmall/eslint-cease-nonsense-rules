// oxlint-disable no-array-callback-reference
import { blue, bold, cyan, dim, green, magenta, yellow } from "picocolors";
import { formatSeverity, isRecord } from "./reused";
import type { RuleEntry, RuleFormatter } from "./types";

function mapEntries([key, value]: [string, unknown]): string {
	return `${key}: ${colorizeValue(value)}`;
}
function mapEntriesBlue([key, value]: [string, unknown]): string {
	return `${blue(key)}: ${colorizeValue(value)}`;
}

function colorizeValue(value: unknown): string {
	if (value === undefined) return dim("undefined");
	if (typeof value === "string") return green(value);
	if (typeof value === "number") return yellow(String(value));
	if (typeof value === "boolean") return magenta(String(value));

	if (Array.isArray(value)) {
		const items = value.map(colorizeValue);
		return `[${items.join(", ")}]`;
	}

	if (isRecord(value)) return `{ ${Object.entries(value).map(mapEntries).join(", ")} }`;

	return dim(typeof value === "bigint" || typeof value === "symbol" ? value.toString() : "unknown");
}

function formatConfigEntries(config: ReadonlyArray<unknown>): ReadonlyArray<string> {
	if (config.length === 0) return [];

	if (config.length === 1) {
		const [value] = config;
		return isRecord(value) ? Object.entries(value).map(mapEntriesBlue) : [colorizeValue(value)];
	}

	return config.map((item) => colorizeValue(item));
}

function formatRule(entry: RuleEntry, isLast: boolean): string {
	const { name, rule } = entry;
	const bullet = bold(cyan("●"));

	if (rule === undefined) return `${bullet} ${bold(name)}  ${bold(yellow("does not exist"))}`;

	const [severity, ...config] = rule;
	const header = `${bullet} ${bold(name)}  ${formatSeverity(severity)}`;

	const configLines = formatConfigEntries(config);
	if (configLines.length === 0) return header;

	const treeLines = configLines.map((line, index) => {
		const isLastLine = index === configLines.length - 1;
		const prefix = isLastLine ? dim("└") : dim("├");
		return `  ${prefix} ${line}`;
	});

	const result = `${header}\n${treeLines.join("\n")}`;
	return isLast ? result : `${result}\n`;
}

/**
 * Formats rules in pnpm/bun-style minimal tree output.
 * @param entries - The rule entries to format.
 * @returns The formatted string.
 */
export function formatRulesAsMinimal(entries: ReadonlyArray<RuleEntry>): ReturnType<RuleFormatter> {
	return entries.map((entry, index) => formatRule(entry, index === entries.length - 1)).join("\n");
}
