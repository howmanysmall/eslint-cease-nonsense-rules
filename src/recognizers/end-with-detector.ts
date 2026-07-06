import { regex } from "arktype";

import type { Detector } from "./detector";

// oxlint-disable-next-line prefer-string-raw -- Dynamic regex source is built from escaped string fragments.
const WHITESPACE_REGEX = regex("\\s", "u");

/**
 * Creates a detector for lines ending with specific characters. Scans backwards, skipping whitespace and comment
 * markers (* /).
 *
 * @param probability - Base probability (0-1)
 * @param endings - Characters to match at line end
 * @returns Detector instance
 */
export function createEndWithDetector(probability: number, endings: ReadonlyArray<string>): Detector {
	const endingsSet = new Set(endings);

	return {
		probability,
		scan(line: string): number {
			for (let index = line.length - 1; index >= 0; index -= 1) {
				const character = line.charAt(index);
				if (endingsSet.has(character)) return 1;
				if (!WHITESPACE_REGEX.test(character) && character !== "*" && character !== "/") return 0;
			}

			return 0;
		},
	};
}
