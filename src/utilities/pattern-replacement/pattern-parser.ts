import type { ParsedArg, ParsedPattern, ParsedReplacement, WhenCondition } from "./pattern-types";

const CONSTRUCTOR_PATTERN = /^new\s+(\w+)\((.*)\)$/;
const STATIC_METHOD_PATTERN = /^(\w+)\.(\w+)\((.*)\)$/;
const STATIC_ACCESS_PATTERN = /^(\w+)\.(\w+)$/;
const CALL_PATTERN = /^(\w+)\((.*)\)$/;

/**
 * Parse argument string into ParsedArg array
 * @param argsString - Comma-separated argument string
 * @returns Array of parsed arguments
 */
export function parseArgs(argsString: string): ReadonlyArray<ParsedArg> {
	const trimmed = argsString.trim();
	if (trimmed === "") return [];

	const args = trimmed.split(",").map((arg) => arg.trim());
	const result: Array<ParsedArg> = [];

	for (const arg of args) {
		if (arg === "_") {
			result.push({ kind: "wildcard" });
		} else if (arg.startsWith("$")) {
			result.push({ kind: "capture", name: arg.slice(1) });
		} else if (arg.endsWith("?")) {
			const value = Number.parseFloat(arg.slice(0, -1));
			result.push({ kind: "optional", value });
		} else {
			const value = Number.parseFloat(arg);
			result.push({ kind: "literal", value });
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
	// Check for static access: Type.prop
	const staticMatch = replacement.match(STATIC_ACCESS_PATTERN);
	if (staticMatch && !replacement.includes("(")) {
		const [, typeName, prop] = staticMatch;
		if (!(typeName && prop)) throw new Error(`Invalid static access: ${replacement}`);

		return {
			kind: "staticAccess",
			prop,
			typeName,
		};
	}

	// Check for function call: name(args)
	const callMatch = replacement.match(CALL_PATTERN);
	if (callMatch) {
		const [, name, argsStr] = callMatch;
		if (!name || argsStr === undefined) throw new Error(`Invalid call: ${replacement}`);

		const args = argsStr.trim() === "" ? [] : argsStr.split(",").map((a) => a.trim());
		return {
			args,
			kind: "call",
			name,
		};
	}

	// Simple identifier
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
	if (when) {
		for (const [key, value] of Object.entries(when)) {
			conditions.set(key, value);
		}
	}

	// Try constructor pattern: new Type(args)
	const constructorMatch = match.match(CONSTRUCTOR_PATTERN);
	if (constructorMatch) {
		const [, typeName, argsStr] = constructorMatch;
		if (!typeName || argsStr === undefined) throw new Error(`Invalid constructor: ${match}`);

		return {
			args: parseArgs(argsStr),
			conditions,
			original: match,
			replacement: parseReplacement(replacement),
			type: "constructor",
			typeName,
		};
	}

	// Try static method pattern: Type.method(args)
	const staticMethodMatch = match.match(STATIC_METHOD_PATTERN);
	if (staticMethodMatch) {
		const [, typeName, methodName, argsStr] = staticMethodMatch;
		if (!(typeName && methodName) || argsStr === undefined) throw new Error(`Invalid static method: ${match}`);

		return {
			args: parseArgs(argsStr),
			conditions,
			methodName,
			original: match,
			replacement: parseReplacement(replacement),
			type: "staticMethod",
			typeName,
		};
	}

	throw new Error(`Invalid pattern: ${match}`);
}
