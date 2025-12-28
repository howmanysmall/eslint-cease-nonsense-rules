// oxlint-disable prefer-string-raw

import { regex } from "arkregex";
import type { ParsedParameter, ParsedPattern, ParsedReplacement, WhenCondition } from "./pattern-types";

const CONSTRUCTOR_PATTERN = regex("^new\\s+(?<typeName>\\w+)\\((?<argumentsString>.*)\\)$");
const STATIC_METHOD_PATTERN = regex("^(?<typeName>\\w+)\\.(?<methodName>\\w+)\\((?<argumentsString>.*)\\)$");
const STATIC_ACCESS_PATTERN = regex("^(?<typeName>\\w+)\\.(?<property>\\w+)$");
const CALL_PATTERN = regex("^(?<name>\\w+)\\((?<argumentsString>.*)\\)$");

/**
 * Parse argument string into ParsedArg array
 * @param parametersString - Comma-separated argument string
 * @returns Array of parsed arguments
 */
export function parseParameters(parametersString: string): ReadonlyArray<ParsedParameter> {
	const trimmed = parametersString.trim();
	if (trimmed === "") return [];

	const parameters = trimmed.split(",").map((parameter) => parameter.trim());
	const result = new Array<ParsedParameter>();
	let size = 0;

	for (const parameter of parameters) {
		if (parameter === "_") result[size++] = { kind: "wildcard" };
		else if (parameter.startsWith("$")) result[size++] = { kind: "capture", name: parameter.slice(1) };
		else if (parameter.endsWith("?")) {
			const value = Number.parseFloat(parameter.slice(0, -1));
			result[size++] = { kind: "optional", value };
		} else {
			const value = Number.parseFloat(parameter);
			result[size++] = { kind: "literal", value };
		}
	}

	return result;
}

/**
 * Parse replacement string into ParsedReplacement
 * @param replacement - Replacement expression string
 * @returns Parsed replacement structure
 */
export function parseReplacement(replacement: string): ParsedReplacement {
	const staticMatch = STATIC_ACCESS_PATTERN.exec(replacement);
	if (staticMatch && !replacement.includes("(")) return { ...staticMatch.groups, kind: "staticAccess" };

	const callMatch = CALL_PATTERN.exec(replacement);
	if (callMatch) {
		const { name, argumentsString } = callMatch.groups;
		const parameters = argumentsString.trim() === "" ? [] : argumentsString.split(",").map((value) => value.trim());
		return { kind: "call", name, parameters };
	}

	return { kind: "identifier", name: replacement };
}

/**
 * Parse a pattern string into ParsedPattern
 * @param match - Pattern match expression
 * @param replacement - Replacement expression
 * @param when - Optional conditions for captures
 * @returns Parsed pattern structure
 */
export function parsePattern(
	match: string,
	replacement: string,
	when: Record<string, WhenCondition> | undefined,
): ParsedPattern {
	const conditions = new Map<string, WhenCondition>();
	if (when) for (const [key, value] of Object.entries(when)) conditions.set(key, value);

	const constructorMatch = CONSTRUCTOR_PATTERN.exec(match);
	if (constructorMatch) {
		const { typeName, argumentsString } = constructorMatch.groups;
		return {
			conditions,
			original: match,
			parameters: parseParameters(argumentsString),
			replacement: parseReplacement(replacement),
			type: "constructor",
			typeName,
		};
	}

	const staticMethodMatch = STATIC_METHOD_PATTERN.exec(match);
	if (staticMethodMatch) {
		const { typeName, methodName, argumentsString } = staticMethodMatch.groups;

		return {
			conditions,
			methodName,
			original: match,
			parameters: parseParameters(argumentsString),
			replacement: parseReplacement(replacement),
			type: "staticMethod",
			typeName,
		};
	}

	throw new Error(`Invalid pattern: ${match}`);
}
