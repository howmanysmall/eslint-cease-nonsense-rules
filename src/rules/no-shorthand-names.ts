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
const isUnknownRecord = Compile(Type.Record(Type.String(), Type.Unknown()));

interface ShorthandMatcher {
	readonly pattern: RegExp;
	readonly replacement: string;
	readonly original: string;
}

interface NormalizedOptions {
	readonly matchers: ReadonlyArray<ShorthandMatcher>;
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

function splitIdentifierIntoWords(identifier: string): Array<string> {
	return identifier
		.replaceAll(/([a-z])([A-Z])/g, "$1\0$2") // camelCase boundaries
		.replaceAll(/([A-Z]+)([A-Z][a-z])/g, "$1\0$2") // acronym boundaries
		.replaceAll(/([a-zA-Z])(\d)/g, "$1\0$2") // letter->digit
		.replaceAll(/(\d)([a-zA-Z])/g, "$1\0$2") // digit->letter
		.split("\0");
}

function createMatcher(key: string, replacement: string): ShorthandMatcher {
	// Regex: /pattern/ or /pattern/flags
	if (key.startsWith("/")) {
		const match = key.match(REGEX_PATTERN_MATCHER);
		if (match) {
			return {
				original: key,
				pattern: new RegExp(`^${match[1]}$`, match[2]),
				replacement,
			};
		}
	}

	// Glob: contains * or ?
	if (key.includes("*") || key.includes("?")) {
		const regexPattern = key
			.replaceAll(/[.+^${}()|[\]\\]/g, String.raw`\$&`) // Escape regex chars except * and ?
			.replaceAll("*", "(.*)")
			.replaceAll("?", "(.)");

		let captureIndex = 0;
		const regexReplacement = replacement.replaceAll("*", () => `$${++captureIndex}`);

		return {
			original: key,
			pattern: new RegExp(`^${regexPattern}$`),
			replacement: regexReplacement,
		};
	}

	// Exact match: escape and anchor
	const escaped = key.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
	return {
		original: key,
		pattern: new RegExp(`^${escaped}$`),
		replacement,
	};
}

function matchWord(word: string, matchers: ReadonlyArray<ShorthandMatcher>): ShorthandMatch | undefined {
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

function buildReplacementIdentifier(
	identifier: string,
	matchers: ReadonlyArray<ShorthandMatcher>,
): ReplacementResult | undefined {
	const words = splitIdentifierIntoWords(identifier);
	const matches: Array<ShorthandMatch> = [];
	let hasMatch = false;

	const newWords = words.map((word) => {
		const match = matchWord(word, matchers);
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

	const matchers = Object.entries(mergedShorthands).map(([key, value]) => createMatcher(key, value));
	const allowPropertyAccessSource = rawOptions?.allowPropertyAccess ?? DEFAULT_OPTIONS.allowPropertyAccess;

	return {
		allowPropertyAccess: new Set(allowPropertyAccessSource),
		matchers,
		selector: "Identifier",
	};
}

const noShorthandNames: Rule.RuleModule = {
	create(context) {
		const validatedOptions = isRuleOptions.Check(context.options[0]) ? context.options[0] : undefined;
		const { matchers, allowPropertyAccess, selector } = normalizeOptions(validatedOptions);

		return {
			[selector](node: Rule.Node & { name: string; parent?: unknown }) {
				const identifierName = node.name;
				const result = buildReplacementIdentifier(identifierName, matchers);
				if (result === undefined) return;

				const { replaced, matches } = result;
				const { parent } = node;

				// Handle allowPropertyAccess for single-word matches only
				if (matches.length === 1) {
					const match = matches[0];
					if (
						allowPropertyAccess.has(match.shorthand) &&
						parent !== undefined &&
						isUnknownRecord.Check(parent) &&
						parent.type === TSESTree.AST_NODE_TYPES.MemberExpression &&
						parent.property === node
					)
						return;
				}

				// Handle plr -> localPlayer special case (only for exact "plr" identifier)
				if (
					identifierName === "plr" &&
					parent?.type === TSESTree.AST_NODE_TYPES.VariableDeclarator &&
					parent.id === node
				) {
					const { init } = parent;
					if (
						init &&
						isUnknownRecord.Check(init) &&
						init.type === TSESTree.AST_NODE_TYPES.MemberExpression &&
						init.object !== undefined &&
						isUnknownRecord.Check(init.object) &&
						init.object.type === TSESTree.AST_NODE_TYPES.Identifier &&
						init.object.name === "Players" &&
						init.property !== undefined &&
						isUnknownRecord.Check(init.property) &&
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
