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

function splitIdentifierIntoWords(identifier: string): ReadonlyArray<string> {
	return identifier.split(WORD_BOUNDARY_REGEX);
}

type MatcherResult =
	| { type: "exact"; original: string; replacement: string }
	| { type: "pattern"; matcher: ShorthandMatcher };

function createMatcher(key: string, replacement: string): MatcherResult {
	if (key.startsWith("/")) {
		const match = REGEX_PATTERN_MATCHER.exec(key);
		if (match) {
			return {
				matcher: {
					original: key,
					pattern: new RegExp(`^${match.groups.first}$`, match.groups.second),
					replacement,
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
			for (let index = 1; index < match.length; index += 1) {
				replaced = replaced.replaceAll(new RegExp(`\\$${index}`, "g"), match[index] ?? "");
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
	for (const matcher of ignoreMatchers) {
		if (matcher.pattern.test(word)) return true;
	}
	return false;
}

function buildReplacementIdentifier(identifier: string, options: NormalizedOptions): ReplacementResult | undefined {
	const words = splitIdentifierIntoWords(identifier);
	const matches = new Array<ShorthandMatch>();
	let hasMatch = false;

	const newWords = words.map((word) => {
		const match = matchWord(word, options.matchers, options.exactMatchers);
		if (match) {
			hasMatch = true;
			matches.push(match);
			return match.replacement;
		}
		return word;
	});

	if (!hasMatch) return undefined;
	return { matches, replaced: newWords.join("") };
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

const noShorthandNames: Rule.RuleModule = {
	create(context) {
		const validatedOptions = isRuleOptions.Check(context.options[0]) ? context.options[0] : undefined;
		const normalized = normalizeOptions(validatedOptions);
		const { allowPropertyAccess, ignoreMatchers, ignoreExact, selector } = normalized;

		return {
			[selector](node: Rule.Node & { name: string; parent?: unknown }) {
				const identifierName = node.name;
				const result = buildReplacementIdentifier(identifierName, normalized);
				if (result === undefined) return;

				const { replaced, matches } = result;
				const { parent } = node;

				// Skip import specifiers - user doesn't control external package naming
				if (parent !== undefined && isRecord(parent)) {
					const parentType = parent.type as string;
					// Import { InstanceProps } or { InstanceProps as X } from "pkg"
					if (parentType === "ImportSpecifier") {
						return;
					}
					// Import InstanceProps from "pkg" (default import)
					if (parentType === "ImportDefaultSpecifier") {
						return;
					}
					// Import * as Props from "pkg" (namespace import)
					if (parentType === "ImportNamespaceSpecifier") {
						return;
					}
				}

				// Check if full identifier name is ignored (for external package exports)
				if (isWordIgnored(identifierName, ignoreMatchers, ignoreExact)) return;

				// Check if ALL matched words are ignored
				const allIgnored = matches.every((match) =>
					isWordIgnored(match.matchedWord, ignoreMatchers, ignoreExact),
				);
				if (allIgnored) return;

				// Check allowPropertyAccess in member/qualified name context
				if (parent !== undefined && isRecord(parent)) {
					const parentType = parent.type as string;
					const isPropertyAccess =
						(parentType === "MemberExpression" && parent.property === node) ||
						(parentType === "TSQualifiedName" && parent.right === node);

					if (isPropertyAccess) {
						// Check full identifier name OR all matched words
						const allWordsAllowed = matches.every((match) => allowPropertyAccess.has(match.matchedWord));
						if (allowPropertyAccess.has(identifierName) || allWordsAllowed) {
							return;
						}
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
