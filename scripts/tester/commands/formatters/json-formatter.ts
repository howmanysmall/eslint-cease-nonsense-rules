import { blue, bold, cyan, dim, green, magenta, yellow } from "picocolors";
import { formatSeverity } from "./reused";
import type { RuleEntry, RuleFormatter } from "./types";

function colorizeValue(value: unknown, indent: string): string {
	if (value === undefined) return dim("undefined");
	if (typeof value === "string") return green(`"${value}"`);
	if (typeof value === "number") return yellow(String(value));

	if (typeof value === "boolean") return magenta(String(value));

	if (Array.isArray(value)) {
		if (value.length === 0) return dim("[]");
		const items = value.map((item) => colorizeValue(item, `${indent}  `));
		return `[\n${indent}  ${items.join(`,\n${indent}  `)}\n${indent}]`;
	}

	if (typeof value === "object" && value !== null) {
		const entries = Object.entries(value as Record<string, unknown>);
		if (entries.length === 0) return dim("{}");

		const lines = entries.map(
			([key, subValue]) => `${indent}  ${blue(`"${key}"`)}: ${colorizeValue(subValue, `${indent}  `)}`,
		);
		return `{\n${lines.join(",\n")}\n${indent}}`;
	}

	return dim(typeof value === "bigint" || typeof value === "symbol" ? value.toString() : "unknown");
}

function formatConfig(configuration: ReadonlyArray<unknown>): string {
	if (configuration.length === 0) return "";

	if (configuration.length === 1) {
		const [value] = configuration;
		return colorizeValue(value, "");
	}

	return colorizeValue([...configuration], "");
}

function formatRule(entry: RuleEntry): string {
	const { name, rule } = entry;

	if (rule === undefined) return `${bold(cyan(name))}: ${bold(yellow("does not exist"))}`;

	const [severity, ...configuration] = rule;
	const header = `${bold(cyan(name))}: ${formatSeverity(severity)}`;

	const configString = formatConfig(configuration);
	if (configString === "") return header;

	return `${header}\n${configString}`;
}

/**
 * Formats rules in jq-style colored JSON output.
 * @param entries - The rule entries to format.
 * @returns The formatted string.
 */
export function formatRulesAsJson(entries: ReadonlyArray<RuleEntry>): ReturnType<RuleFormatter> {
	// oxlint-disable-next-line no-array-callback-reference
	return entries.map(formatRule).join("\n\n");
}
