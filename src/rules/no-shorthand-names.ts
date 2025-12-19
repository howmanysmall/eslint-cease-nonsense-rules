import { TSESTree } from "@typescript-eslint/types";
import type { Rule } from "eslint";
import Type from "typebox";
import { Compile } from "typebox/compile";

export interface NoShorthandOptions {
	readonly allowPropertyAccess?: ReadonlyArray<string>;
	readonly shorthands?: Record<string, string>;
}

const isRuleOptions = Compile(
	Type.Object({
		allowPropertyAccess: Type.Optional(Type.Array(Type.String())),
		shorthands: Type.Optional(Type.Record(Type.String(), Type.String())),
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
	readonly selector: string;
}

const DEFAULT_OPTIONS: Required<NoShorthandOptions> = {
	allowPropertyAccess: ["char"],
	shorthands: {
		args: "parameters",
		char: "character",
		dt: "deltaTime",
		plr: "player",
	},
};

const REGEX_PATTERN_MATCHER = /^\/(.+)\/([gimsuy]*)$/;

interface ShorthandMatch {
	readonly shorthand: string;
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

function splitIdentifierIntoWords(identifier: string): Array<string> {
	return identifier.split(WORD_BOUNDARY_REGEX);
}

type MatcherResult =
	| { type: "exact"; original: string; replacement: string }
	| { type: "pattern"; matcher: ShorthandMatcher };

function createMatcher(key: string, replacement: string): MatcherResult {
	// Regex: /pattern/ or /pattern/flags
	if (key.startsWith("/")) {
		const match = key.match(REGEX_PATTERN_MATCHER);
		if (match) {
			return {
				matcher: {
					original: key,
					pattern: new RegExp(`^${match[1]}$`, match[2]),
					replacement,
				},
				type: "pattern",
			};
		}
	}

	// Glob: contains * or ?
	if (key.includes("*") || key.includes("?")) {
		const regexPattern = key
			.replaceAll(/[.+^${}()|[\]\\]/g, String.raw`\$&`)
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

	// Exact match
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
			replacement: exactReplacement,
			shorthand: word,
		};
	}

	// Check regex/glob matchers
	for (const matcher of matchers) {
		const match = word.match(matcher.pattern);
		if (match) {
			let replaced = matcher.replacement;
			for (let i = 1; i < match.length; i++) {
				replaced = replaced.replaceAll(new RegExp(`\\$${i}`, "g"), match[i] ?? "");
			}
			return {
				replacement: replaced,
				shorthand: matcher.original,
			};
		}
	}
	return undefined;
}

function buildReplacementIdentifier(identifier: string, options: NormalizedOptions): ReplacementResult | undefined {
	const words = splitIdentifierIntoWords(identifier);
	const matches: Array<ShorthandMatch> = [];
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
	if (rawOptions?.shorthands)
		for (const [key, value] of Object.entries(rawOptions.shorthands)) mergedShorthands[key] = value;

	const matchers: Array<ShorthandMatcher> = [];
	const exactMatchers = new Map<string, string>();

	for (const [key, value] of Object.entries(mergedShorthands)) {
		const result = createMatcher(key, value);
		if (result.type === "exact") {
			exactMatchers.set(result.original, result.replacement);
		} else {
			matchers.push(result.matcher);
		}
	}

	const allowPropertyAccessSource = rawOptions?.allowPropertyAccess ?? DEFAULT_OPTIONS.allowPropertyAccess;

	return {
		allowPropertyAccess: new Set(allowPropertyAccessSource),
		exactMatchers,
		matchers,
		selector: "Identifier",
	};
}

const noShorthandNames: Rule.RuleModule = {
	create(context) {
		const validatedOptions = isRuleOptions.Check(context.options[0]) ? context.options[0] : undefined;
		const normalized = normalizeOptions(validatedOptions);
		const { allowPropertyAccess, selector } = normalized;

		return {
			[selector](node: Rule.Node & { name: string; parent?: unknown }) {
				const identifierName = node.name;
				const result = buildReplacementIdentifier(identifierName, normalized);
				if (result === undefined) return;

				const { replaced, matches } = result;
				const { parent } = node;

				// Handle allowPropertyAccess for single-word matches only
				const [match] = matches;
				if (
					matches.length === 1 &&
					match !== undefined &&
					allowPropertyAccess.has(match.shorthand) &&
					parent !== undefined &&
					isRecord(parent) &&
					parent.type === TSESTree.AST_NODE_TYPES.MemberExpression &&
					parent.property === node
				)
					return;

				// Handle plr -> localPlayer special case (only for exact "plr" identifier)
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

				const shorthandList = matches.map((m) => m.shorthand).join(", ");
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
						description: "Shorthand names that are allowed as property access",
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
