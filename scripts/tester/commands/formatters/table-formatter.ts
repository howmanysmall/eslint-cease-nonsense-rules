// oxlint-disable no-array-callback-reference
import { blue, bold, dim, green, magenta, yellow } from "picocolors";
import { formatSeverity, isRecord } from "./reused";
import type { RuleEntry, RuleFormatter } from "./types";

function colorizeValue(value: unknown): string {
	if (typeof value === "string") return green(`"${value}"`);
	if (typeof value === "number") return yellow(String(value));
	if (typeof value === "boolean") return magenta(String(value));
	if (Array.isArray(value)) return `[${value.map(colorizeValue).join(", ")}]`;
	if (isRecord(value)) {
		const pairs = Object.entries(value).map(([key, val]) => `${key}: ${colorizeValue(val)}`);
		return `{ ${pairs.join(", ")} }`;
	}
	return dim(String(value));
}
function formatConfigurationLine(key: string, value: unknown): string {
	return `${blue(key)}: ${colorizeValue(value)}`;
}

function padEnd(value: string, length: number): string {
	return value + " ".repeat(Math.max(0, length - Bun.stripANSI(value).length));
}

function formatRecordConfiguration(
	record: Record<string, unknown>,
	ruleColumn: string,
	severityColumn: string,
	indent: string,
): ReadonlyArray<string> {
	const configEntries = Object.entries(record);
	const [first, ...rest] = configEntries;
	if (first === undefined) return [];

	const lines = [`${ruleColumn}${severityColumn}${formatConfigurationLine(first[0], first[1])}`];
	let size = 1;

	for (const [key, subValue] of rest) lines[size++] = `${indent}${formatConfigurationLine(key, subValue)}`;
	return lines;
}

/**
 * Formats rules in gh CLI-style aligned table output with wrapped configs.
 * @param entries - The rule entries to format.
 * @returns The formatted string.
 */
export function formatRulesAsTable(entries: ReadonlyArray<RuleEntry>): ReturnType<RuleFormatter> {
	let maxRuleWidth = 4;
	let maxSeverityWidth = 8;

	for (const entry of entries) {
		maxRuleWidth = Math.max(maxRuleWidth, entry.name.length);
		if (entry.rule !== undefined) {
			const severity = formatSeverity(entry.rule[0]);
			maxSeverityWidth = Math.max(maxSeverityWidth, Bun.stripANSI(severity).length);
		}
	}

	maxRuleWidth += 2;
	maxSeverityWidth += 2;

	const indent = " ".repeat(maxRuleWidth + maxSeverityWidth);
	const lines = [
		`${bold(padEnd("RULE", maxRuleWidth))}${bold(padEnd("SEVERITY", maxSeverityWidth))}${bold("CONFIG")}`,
	];

	for (const { name, rule } of entries) {
		if (rule === undefined) {
			lines.push(
				`${padEnd(name, maxRuleWidth)}${padEnd(bold(yellow("n/a")), maxSeverityWidth)}${dim("does not exist")}`,
			);
			continue;
		}

		const [severity, ...configuration] = rule;
		const ruleColumn = padEnd(name, maxRuleWidth);
		const severityColumn = padEnd(formatSeverity(severity), maxSeverityWidth);

		if (configuration.length === 0) {
			lines.push(`${ruleColumn}${severityColumn}${dim("—")}`);
			continue;
		}

		if (configuration.length === 1) {
			const [value] = configuration;
			if (isRecord(value)) {
				lines.push(...formatRecordConfiguration(value, ruleColumn, severityColumn, indent));
				continue;
			}
			lines.push(`${ruleColumn}${severityColumn}${colorizeValue(value)}`);
			continue;
		}

		const [first, ...rest] = configuration;
		lines.push(`${ruleColumn}${severityColumn}${colorizeValue(first)}`);
		for (const item of rest) lines.push(`${indent}${colorizeValue(item)}`);
	}

	return lines.join("\n");
}
