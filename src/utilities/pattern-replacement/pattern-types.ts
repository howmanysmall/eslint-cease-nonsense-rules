import type { TSESTree } from "@typescript-eslint/types";

// Brand symbol - internal, cannot be faked
declare const PatternBrand: unique symbol;

// Extract variable name from capture, stopping at delimiters
type ExtractVarName<Str extends string> = Str extends `${infer Name},${infer Rest}`
	? [Name, `,${Rest}`]
	: Str extends `${infer Name})${infer Rest}`
		? [Name, `)${Rest}`]
		: Str extends `${infer Name} ${infer Rest}`
			? [Name, ` ${Rest}`]
			: Str extends `${infer Name}?${infer Rest}`
				? [Name, `?${Rest}`]
				: [Str, ""];

// Extract capture variable names from match string at compile time
type ExtractCaptures<Str extends string> = Str extends `${string}$${infer Rest}`
	? ExtractVarName<Rest> extends [infer Name extends string, infer Remainder extends string]
		? Name | ExtractCaptures<Remainder>
		: never
	: never;

// Error message carrier type for better DX
interface TypeError<Message extends string> {
	readonly __typeError__: Message;
}

// Condition operators
export type WhenCondition =
	| `!= ${string}`
	| `== ${string}`
	| `> ${string}`
	| `< ${string}`
	| `>= ${string}`
	| `<= ${string}`;

// Validate when keys against captures
type ValidateWhenClause<Match extends string, When> = {
	readonly [Key in keyof When]: Key extends ExtractCaptures<Match>
		? WhenCondition
		: TypeError<`'${Key & string}' is not a capture variable. Valid captures: ${ExtractCaptures<Match> extends never ? "(none)" : ExtractCaptures<Match>}`>;
};

// Branded pattern type - requires going through pattern()
export interface Pattern<Match extends string = string> {
	readonly [PatternBrand]: Match;
	readonly match: Match;
	readonly replacement: string;
	readonly when?: { readonly [Key in ExtractCaptures<Match>]?: WhenCondition };
}

// Input type for pattern() helper (without brand)
export interface PatternInput<MatchStr extends string> {
	readonly match: MatchStr;
	readonly replacement: string;
	readonly when?: { readonly [Key in ExtractCaptures<MatchStr>]?: WhenCondition };
}

// The ONLY way to create a valid Pattern
export function pattern<const MatchStr extends string, const WhenClause extends object = object>(config: {
	readonly match: MatchStr;
	readonly replacement: string;
	readonly when?: WhenClause & ValidateWhenClause<MatchStr, WhenClause>;
}): Pattern<MatchStr> {
	return config as unknown as Pattern<MatchStr>;
}

// Rule options
export interface PreferPatternReplacementsOptions {
	readonly patterns: ReadonlyArray<Pattern>;
}

// Parsed argument types
export type ParsedArg =
	| { readonly kind: "literal"; readonly value: number }
	| { readonly kind: "optional"; readonly value: number }
	| { readonly kind: "capture"; readonly name: string }
	| { readonly kind: "wildcard" };

// Parsed replacement types
export type ParsedReplacement =
	| { readonly kind: "identifier"; readonly name: string }
	| { readonly kind: "staticAccess"; readonly typeName: string; readonly prop: string }
	| { readonly kind: "call"; readonly name: string; readonly args: ReadonlyArray<string> };

// Parsed pattern structure
export interface ParsedPattern {
	readonly type: "constructor" | "staticMethod";
	readonly typeName: string;
	readonly methodName?: string;
	readonly args: ReadonlyArray<ParsedArg>;
	readonly replacement: ParsedReplacement;
	readonly conditions: ReadonlyMap<string, WhenCondition>;
	readonly original: string;
}

// Captured value during matching
export interface CapturedValue {
	readonly exprKey: string;
	readonly constValue?: number;
	readonly sourceText: string;
	readonly isComplex: boolean;
	readonly node: TSESTree.Expression;
}

// Match result
export interface MatchResult {
	readonly pattern: ParsedPattern;
	readonly captures: ReadonlyMap<string, CapturedValue>;
	readonly originalText: string;
	readonly replacementText: string;
}
