import { TSESTree } from "@typescript-eslint/types";
import { regex } from "arkregex";
import type { Rule } from "eslint";
import Typebox from "typebox";
import { Compile } from "typebox/compile";

export interface NoShorthandOptions {
	readonly allowPropertyAccess?: ReadonlyArray<string>;
	readonly ignoreShorthands?: ReadonlyArray<string>;
	readonly shorthands?: Record<string, string>;
}

const isRuleOptions = Compile(
	Typebox.Object({
		allowPropertyAccess: Typebox.Optional(Typebox.Array(Typebox.String())),
		ignoreShorthands: Typebox.Optional(Typebox.Array(Typebox.String())),
		shorthands: Typebox.Optional(Typebox.Record(Typebox.String(), Typebox.String())),
	}),
);

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object";
}

interface ShorthandMatcher {
	readonly pattern: RegExp;
	readonly replacement: string;
	readonly original: string;
	readonly replacementPatterns: ReadonlyArray<RegExp>;
}

interface NormalizedOptions {
	readonly matchers: ReadonlyArray<ShorthandMatcher>;
	readonly exactMatchers: Map<string, string>;
	readonly allowPropertyAccess: ReadonlySet<string>;
	readonly ignoreMatchers: ReadonlyArray<ShorthandMatcher>;
	readonly ignoreExact: ReadonlySet<string>;
	readonly selector: string;
}

const DEFAULT_OPTIONS: Required<NoShorthandOptions> = {
	allowPropertyAccess: ["char"],
	ignoreShorthands: [],
	shorthands: {
		args: "parameters",
		char: "character",
		dt: "deltaTime",
		plr: "player",
	},
};

const REGEX_PATTERN_MATCHER = regex("^/(?<first>.+)/(?<second>[gimsuy]*)$");

interface ShorthandMatch {
	readonly shorthand: string;
	readonly matchedWord: string;
	readonly replacement: string;
}

interface ReplacementResult {
	readonly replaced: string;
	readonly matches: ReadonlyArray<ShorthandMatch>;
}

// Split by:
// 1. camelCase boundaries: (?<=[a-z])(?=[A-Z])
// 2. Acronym boundaries: (?<=[A-Z])(?=[A-Z][a-z])
// 3. Letter-Digit: (?<=[a-zA-Z])(?=\d)
// 4. Digit-Letter: (?<=\d)(?=[a-zA-Z])
const WORD_BOUNDARY_REGEX = /(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])|(?<=[a-zA-Z])(?=\d)|(?<=\d)(?=[a-zA-Z])/;
// oxlint-disable-next-line no-template-curly-in-string
const FUNT_PATTERN = regex("[.+^${}()|[\\]\\\\]", "g");

// Module-level split cache with bounded size
const SPLIT_CACHE = new Map<string, ReadonlyArray<string>>();
const MAX_SPLIT_CACHE_SIZE = 1024;

function splitIdentifierIntoWords(identifier: string): ReadonlyArray<string> {
	const cached = SPLIT_CACHE.get(identifier);
	if (cached !== undefined) return cached;

	const words = identifier.split(WORD_BOUNDARY_REGEX);

	// Prevent unbounded growth - simple eviction of oldest entry
	if (SPLIT_CACHE.size >= MAX_SPLIT_CACHE_SIZE) {
		const firstKey = SPLIT_CACHE.keys().next().value;
		if (firstKey !== undefined) SPLIT_CACHE.delete(firstKey);
	}

	SPLIT_CACHE.set(identifier, words);
	return words;
}

type MatcherResult =
	| { type: "exact"; original: string; replacement: string }
	| { type: "pattern"; matcher: ShorthandMatcher };

function countCaptureGroups(replacement: string): number {
	const matches = replacement.match(/\$(\d+)/g);
	if (matches === null) return 0;
	let maxGroup = 0;
	for (const dollarRef of matches) {
		const groupNum = Number.parseInt(dollarRef.slice(1), 10);
		if (groupNum > maxGroup) maxGroup = groupNum;
	}
	return maxGroup;
}

// Pre-computed replacement patterns cache (module-level, shared across instances)
const REPLACEMENT_PATTERN_CACHE = new Map<number, RegExp>();
function getReplacementPattern(index: number): RegExp {
	let pattern = REPLACEMENT_PATTERN_CACHE.get(index);
	if (pattern === undefined) {
		pattern = new RegExp(`\\$${index}`, "g");
		REPLACEMENT_PATTERN_CACHE.set(index, pattern);
	}
	return pattern;
}

function buildReplacementPatterns(replacement: string): ReadonlyArray<RegExp> {
	const count = countCaptureGroups(replacement);
	if (count === 0) return [];
	const patterns = new Array<RegExp>(count);
	for (let index = 1; index <= count; index += 1) {
		patterns[index - 1] = getReplacementPattern(index);
	}
	return patterns;
}

function createMatcher(key: string, replacement: string): MatcherResult {
	if (key.startsWith("/")) {
		const match = key.match(REGEX_PATTERN_MATCHER);
		if (match?.groups) {
			return {
				matcher: {
					original: key,
					pattern: new RegExp(`^${match.groups.first}$`, match.groups.second),
					replacement,
					replacementPatterns: buildReplacementPatterns(replacement),
				},
				type: "pattern",
			};
		}
	}

	if (key.includes("*") || key.includes("?")) {
		const regexPattern = key
			.replaceAll(FUNT_PATTERN, String.raw`\$&`)
			.replaceAll("*", "(.*)")
			.replaceAll("?", "(.)");

		let captureIndex = 0;
		const regexReplacement = replacement.replaceAll("*", () => `$${++captureIndex}`);

		return {
			matcher: {
				original: key,
				pattern: new RegExp(`^${regexPattern}$`),
				replacement: regexReplacement,
				replacementPatterns: buildReplacementPatterns(regexReplacement),
			},
			type: "pattern",
		};
	}

	return {
		original: key,
		replacement,
		type: "exact",
	};
}

function matchWord(
	word: string,
	matchers: ReadonlyArray<ShorthandMatcher>,
	exactMatchers: Map<string, string>,
): ShorthandMatch | undefined {
	// Check exact matches first (O(1))
	const exactReplacement = exactMatchers.get(word);
	if (exactReplacement !== undefined) {
		return {
			matchedWord: word,
			replacement: exactReplacement,
			shorthand: word,
		};
	}

	// Check regex/glob matchers
	for (const matcher of matchers) {
		const match = word.match(matcher.pattern);
		if (match) {
			let replaced = matcher.replacement;
			// Use pre-computed replacement patterns instead of creating new RegExp in loop
			let captureIndex = 1;
			for (const replacementPattern of matcher.replacementPatterns) {
				replaced = replaced.replaceAll(replacementPattern, match[captureIndex] ?? "");
				captureIndex += 1;
			}
			return {
				matchedWord: word,
				replacement: replaced,
				shorthand: matcher.original,
			};
		}
	}
	return undefined;
}

function isWordIgnored(
	word: string,
	ignoreMatchers: ReadonlyArray<ShorthandMatcher>,
	ignoreExact: ReadonlySet<string>,
): boolean {
	if (ignoreExact.has(word)) return true;
	for (const matcher of ignoreMatchers) if (matcher.pattern.test(word)) return true;
	return false;
}

function normalizeOptions(rawOptions: NoShorthandOptions | undefined): NormalizedOptions {
	const mergedShorthands: Record<string, string> = { ...DEFAULT_OPTIONS.shorthands };
	if (rawOptions?.shorthands) {
		for (const [key, value] of Object.entries(rawOptions.shorthands)) mergedShorthands[key] = value;
	}

	const matchers = new Array<ShorthandMatcher>();
	const exactMatchers = new Map<string, string>();

	for (const [key, value] of Object.entries(mergedShorthands)) {
		const result = createMatcher(key, value);
		if (result.type === "exact") exactMatchers.set(result.original, result.replacement);
		else matchers.push(result.matcher);
	}

	const allowPropertyAccessSource = rawOptions?.allowPropertyAccess ?? DEFAULT_OPTIONS.allowPropertyAccess;

	// Process ignoreShorthands
	const ignoreMatchers = new Array<ShorthandMatcher>();
	const ignoreExact = new Set<string>();

	for (const pattern of rawOptions?.ignoreShorthands ?? []) {
		const result = createMatcher(pattern, "");
		if (result.type === "exact") ignoreExact.add(result.original);
		else ignoreMatchers.push(result.matcher);
	}

	return {
		allowPropertyAccess: new Set(allowPropertyAccessSource),
		exactMatchers,
		ignoreExact,
		ignoreMatchers,
		matchers,
		selector: "Identifier",
	};
}

// Import parent types to skip (O(1) lookup)
const IMPORT_PARENT_TYPES = new Set(["ImportSpecifier", "ImportDefaultSpecifier", "ImportNamespaceSpecifier"]);

const noShorthandNames: Rule.RuleModule = {
	create(context) {
		const validatedOptions = isRuleOptions.Check(context.options[0]) ? context.options[0] : undefined;
		const normalized = normalizeOptions(validatedOptions);
		const { allowPropertyAccess, ignoreMatchers, ignoreExact, selector, matchers, exactMatchers } = normalized;

		// Full identifier result cache - biggest optimization
		const identifierResultCache = new Map<string, ReplacementResult | undefined>();
		const ignoredWordCache = new Map<string, boolean>();

		function cachedIsWordIgnored(word: string): boolean {
			const cached = ignoredWordCache.get(word);
			if (cached !== undefined) return cached;
			const result = isWordIgnored(word, ignoreMatchers, ignoreExact);
			ignoredWordCache.set(word, result);
			return result;
		}

		function getIdentifierResult(identifier: string): ReplacementResult | undefined {
			// Check full identifier cache first
			if (identifierResultCache.has(identifier)) return identifierResultCache.get(identifier);

			const words = splitIdentifierIntoWords(identifier);
			const matches = new Array<ShorthandMatch>();
			let hasMatch = false;

			for (const word of words) {
				const match = matchWord(word, matchers, exactMatchers);
				if (match) {
					hasMatch = true;
					matches.push(match);
				}
			}

			if (!hasMatch) {
				identifierResultCache.set(identifier, undefined);
				return undefined;
			}

			// Build replaced string only when needed
			let replaced = "";
			let matchIndex = 0;
			for (const word of words) {
				const currentMatch = matches[matchIndex];
				if (currentMatch !== undefined && currentMatch.matchedWord === word) {
					replaced += currentMatch.replacement;
					matchIndex += 1;
				} else {
					replaced += word;
				}
			}

			const result: ReplacementResult = { matches, replaced };
			identifierResultCache.set(identifier, result);
			return result;
		}

		return {
			[selector](node: Rule.Node & { name: string; parent?: unknown }) {
				const { parent } = node;

				// Skip import specifiers FIRST - before any computation
				if (parent !== undefined && isRecord(parent)) {
					const parentType = parent.type as string;
					if (IMPORT_PARENT_TYPES.has(parentType)) return;
				}

				const identifierName = node.name;
				const result = getIdentifierResult(identifierName);
				if (result === undefined) return;

				const { replaced, matches } = result;

				// Check if full identifier name is ignored
				if (cachedIsWordIgnored(identifierName)) return;

				// Check if ALL matched words are ignored
				let allIgnored = true;
				for (const match of matches) {
					if (!cachedIsWordIgnored(match.matchedWord)) {
						allIgnored = false;
						break;
					}
				}
				if (allIgnored) return;

				// Check allowPropertyAccess in member/qualified name context
				if (parent !== undefined && isRecord(parent)) {
					const parentType = parent.type as string;
					const isPropertyAccess =
						(parentType === "MemberExpression" && parent.property === node) ||
						(parentType === "TSQualifiedName" && parent.right === node);

					if (isPropertyAccess) {
						if (allowPropertyAccess.has(identifierName)) return;
						let allWordsAllowed = true;
						for (const match of matches) {
							if (!allowPropertyAccess.has(match.matchedWord)) {
								allWordsAllowed = false;
								break;
							}
						}
						if (allWordsAllowed) return;
					}
				}

				if (
					identifierName === "plr" &&
					parent?.type === TSESTree.AST_NODE_TYPES.VariableDeclarator &&
					parent.id === node
				) {
					const { init } = parent;
					if (
						init &&
						isRecord(init) &&
						init.type === TSESTree.AST_NODE_TYPES.MemberExpression &&
						init.object !== undefined &&
						isRecord(init.object) &&
						init.object.type === TSESTree.AST_NODE_TYPES.Identifier &&
						init.object.name === "Players" &&
						init.property !== undefined &&
						isRecord(init.property) &&
						init.property.type === TSESTree.AST_NODE_TYPES.Identifier &&
						init.property.name === "LocalPlayer"
					) {
						context.report({
							data: { replacement: "localPlayer", shorthand: "plr" },
							messageId: "useReplacement",
							node,
						});
						return;
					}
				}

				const shorthandList = matches.map(({ shorthand }) => shorthand).join(", ");
				context.report({
					data: { replacement: replaced, shorthand: shorthandList },
					messageId: "useReplacement",
					node,
				});
			},
		};
	},
	meta: {
		docs: {
			description: "Ban shorthand variable names. Use descriptive full names instead.",
			recommended: true,
		},
		messages: {
			useReplacement: "Use '{{replacement}}' instead of '{{shorthand}}' shorthand",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					allowPropertyAccess: {
						description: "Shorthand names allowed as property access or qualified names",
						items: { type: "string" },
						type: "array",
					},
					ignoreShorthands: {
						description: "Shorthand patterns to ignore completely (supports exact, glob, regex)",
						items: { type: "string" },
						type: "array",
					},
					shorthands: {
						additionalProperties: { type: "string" },
						description: "Map of shorthand names to their full replacements",
						type: "object",
					},
				},
				type: "object",
			},
		],
		type: "suggestion",
	},
};

export default noShorthandNames;
