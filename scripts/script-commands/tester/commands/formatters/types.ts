import { type } from "arktype";

const isRule = type(["0 | 1 | 2", "...", "unknown[]"]).readonly();
type Rule = typeof isRule.infer;

/** An entry for a rule lookup result. */
export interface RuleEntry {
	readonly name: string;
	readonly rule: Rule | undefined;
}

/** Formatter function signature. */
export type RuleFormatter = (entries: ReadonlyArray<RuleEntry>) => string;

export const isValidRules = type({
	"[string]": "unknown",
	rules: type.Record("string", isRule).readonly(),
}).readonly();
