/**
 * A detector scans lines and returns match counts.
 * Recognition probability: 1 - (1 - p)^matches
 */
export interface Detector {
	readonly probability: number;
	readonly scan: (line: string) => number;
}

/**
 * Calculate recognition probability based on match count.
 *
 * @param detector - The detector to use
 * @param line - The line to analyze
 * @returns Probability between 0 and 1
 */
export function recognize(detector: Detector, line: string): number {
	const matches = detector.scan(line);
	if (matches === 0) return 0;
	return 1 - (1 - detector.probability) ** matches;
}
