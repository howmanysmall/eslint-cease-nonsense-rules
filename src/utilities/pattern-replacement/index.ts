export type { PatternIndex } from "./pattern-matcher";

export {
	buildPatternIndex,
	canSafelySubstitute,
	evaluateConditions,
	matchParameters,
	resolveCallee,
} from "./pattern-matcher";
export { parsePattern } from "./pattern-parser";
export type { ParsedPattern, Pattern, PreferPatternReplacementsOptions } from "./pattern-types";

export { pattern } from "./pattern-types";
export { generateReplacement, getReplacementIdentifier } from "./replacement-generator";
