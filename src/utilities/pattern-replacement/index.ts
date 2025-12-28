export { evaluateConstant, normalizeZero, unwrap } from "./constant-folder";

export { parseArgs, parsePattern, parseReplacement } from "./pattern-parser";

export {
	buildPatternIndex,
	canSafelySubstitute,
	captureArg,
	evaluateConditions,
	matchArgs,
	resolveCallee,
} from "./pattern-matcher";
export type { PatternIndex, ResolvedCallee } from "./pattern-matcher";

export { generateReplacement, getReplacementIdentifier } from "./replacement-generator";

export { pattern } from "./pattern-types";
export type {
	CapturedValue,
	MatchResult,
	ParsedArg,
	ParsedPattern,
	ParsedReplacement,
	Pattern,
	PatternInput,
	PreferPatternReplacementsOptions,
	WhenCondition,
} from "./pattern-types";
