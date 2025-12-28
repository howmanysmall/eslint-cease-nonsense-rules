export { evaluateConstant, normalizeZero, unwrap } from "./constant-folder";
export type { PatternIndex, ResolvedCallee } from "./pattern-matcher";

export {
	buildPatternIndex,
	canSafelySubstitute,
	captureParameter as captureArg,
	evaluateConditions,
	matchParameters as matchArgs,
	resolveCallee,
} from "./pattern-matcher";
export { parseParameters as parseArgs, parsePattern, parseReplacement } from "./pattern-parser";
export type {
	CapturedValue,
	MatchResult,
	ParsedParameter as ParsedArg,
	ParsedPattern,
	ParsedReplacement,
	Pattern,
	PatternInput,
	PreferPatternReplacementsOptions,
	WhenCondition,
} from "./pattern-types";

export { pattern } from "./pattern-types";
export { generateReplacement, getReplacementIdentifier } from "./replacement-generator";
