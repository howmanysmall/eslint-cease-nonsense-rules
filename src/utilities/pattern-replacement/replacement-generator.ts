import type { CapturedValue, ParsedReplacement } from "./pattern-types";

/**
 * Get the identifier name from a replacement (for scope conflict checking)
 * Returns undefined for static access (no local conflict possible)
 * @param replacement - The parsed replacement to extract identifier from
 * @returns The identifier name or undefined for static access
 */
export function getReplacementIdentifier(replacement: ParsedReplacement): string | undefined {
	switch (replacement.kind) {
		case "identifier":
			return replacement.name;

		case "call":
			return replacement.name;

		case "staticAccess":
			return undefined;
	}
}

/**
 * Generate replacement text from a parsed replacement and captured values
 * @param replacement - The parsed replacement pattern
 * @param captures - Map of captured values from pattern matching
 * @returns The generated replacement text
 */
export function generateReplacement(
	replacement: ParsedReplacement,
	captures: ReadonlyMap<string, CapturedValue>,
): string {
	const { kind } = replacement;
	switch (kind) {
		case "identifier":
			return replacement.name;

		case "staticAccess":
			return `${replacement.typeName}.${replacement.property}`;

		case "call": {
			const parameters = replacement.parameters.map((argument) => {
				if (argument.startsWith("$")) {
					const captureName = argument.slice(1);
					const captured = captures.get(captureName);
					if (captured === undefined) throw new Error(`Missing capture: ${captureName}`);
					return captured.sourceText;
				}
				return argument;
			});
			return `${replacement.name}(${parameters.join(", ")})`;
		}

		default:
			kind satisfies never;
			throw new Error(`Unknown replacement kind: ${kind as string}`);
	}
}
