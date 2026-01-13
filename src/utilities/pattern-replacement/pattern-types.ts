import type { TSESTree } from "@typescript-eslint/types";

// Brand symbol - internal, cannot be faked
declare const PatternBrand: unique symbol;

// Extract variable name from capture, stopping at delimiters
type ExtractVariableName<VariableString extends string> = VariableString extends `${infer Name},${infer Rest}`
	? [Name, `,${Rest}`]
	: VariableString extends `${infer Name})${infer Rest}`
		? [Name, `)${Rest}`]
		: VariableString extends `${infer Name} ${infer Rest}`
			? [Name, ` ${Rest}`]
			: VariableString extends `${infer Name}?${infer Rest}`
				? [Name, `?${Rest}`]
				: [VariableString, ""];

// Extract capture variable names from match string at compile time
type ExtractCaptures<VariableString extends string> = VariableString extends `${string}$${infer Rest}`
	? ExtractVariableName<Rest> extends [infer Name extends string, infer Remainder extends string]
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
	readonly when?: Readonly<Partial<Record<ExtractCaptures<Match>, WhenCondition>>>;
}

// // Input type for pattern() helper (without brand)
// Export interface PatternInput<Match extends string> {
// 	Readonly match: Match;
// 	Readonly replacement: string;
// 	Readonly when?: { readonly [Key in ExtractCaptures<Match>]?: WhenCondition };
// }

// The ONLY way to create a valid Pattern
export function pattern<const Match extends string, const WhenClause extends object = object>(configuration: {
	readonly match: Match;
	readonly replacement: string;
	readonly when?: WhenClause & ValidateWhenClause<Match, WhenClause>;
}): Pattern<Match> {
	return configuration as unknown as Pattern<Match>;
}

// Rule options
export interface PreferPatternReplacementsOptions {
	readonly patterns: ReadonlyArray<Pattern>;
}

// Parsed argument types
export type ParsedParameter =
	| { readonly kind: "literal"; readonly value: number }
	| { readonly kind: "optional"; readonly value: number }
	| { readonly kind: "capture"; readonly name: string }
	| { readonly kind: "wildcard" };

// Parsed replacement types
export type ParsedReplacement =
	| { readonly kind: "identifier"; readonly name: string }
	| { readonly kind: "staticAccess"; readonly typeName: string; readonly property: string }
	| { readonly kind: "call"; readonly name: string; readonly parameters: ReadonlyArray<string> };

// Parsed pattern structure
export interface ParsedPattern {
	readonly conditions: ReadonlyMap<string, WhenCondition>;
	readonly methodName?: string;
	readonly original: string;
	readonly parameters: ReadonlyArray<ParsedParameter>;
	readonly replacement: ParsedReplacement;
	readonly type: "constructor" | "staticMethod";
	readonly typeName: string;
}

// Captured value during matching
export interface CapturedValue {
	readonly constValue?: number;
	readonly expressionKey: string;
	readonly isComplex: boolean;
	readonly node: TSESTree.Expression;
	readonly sourceText: string;
}
