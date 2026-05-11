import {
	buildPatternIndex,
	canSafelySubstitute,
	evaluateConditions,
	matchParameters,
	resolveCallee,
} from "./pattern-matcher";
import { parsePattern } from "./pattern-parser";
import { pattern } from "./pattern-types";
import { generateReplacement, getReplacementIdentifier } from "./replacement-generator";

export type { PatternIndex } from "./pattern-matcher";

export { buildPatternIndex, canSafelySubstitute, evaluateConditions, matchParameters, resolveCallee };
export { parsePattern };
export type { ParsedPattern, Pattern, PreferPatternReplacementsOptions } from "./pattern-types";

export { pattern };
export { generateReplacement, getReplacementIdentifier };
