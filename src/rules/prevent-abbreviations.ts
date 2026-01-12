import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utilities/create-rule";

type MessageIds = "replace" | "suggestion";

interface PreventAbbreviationsOptions {
	readonly checkFilenames?: boolean;
	readonly checkProperties?: boolean;
	readonly checkVariables?: boolean;
	readonly replacements?: Record<string, Record<string, boolean> | false>;
	readonly allowList?: Record<string, boolean>;
	readonly ignore?: ReadonlyArray<string | RegExp>;
}

type Options = [PreventAbbreviationsOptions?];

// Default replacements (subset of unicorn defaults, can be extended)
const DEFAULT_REPLACEMENTS: Record<string, Record<string, boolean>> = {
	args: { arguments: true },
	ctx: { context: true },
	dist: { distance: true },
	// oxlint-disable-next-line id-length
	e: { error: true },
	err: { error: true },
	fn: { func: true, function: false },
	func: {},
	inst: { instance: true },
	jsdoc: {},
	nums: { numbers: true },
	pos: { position: true },
	props: {},
	ref: {},
	refs: {},
	str: { string: true },
	util: {},
	utils: {},
};

// Default allow list
const DEFAULT_ALLOW_LIST: Record<string, boolean> = {};

// Default ignore patterns
const DEFAULT_IGNORE: ReadonlyArray<string | RegExp> = [];

// Regex for splitting camelCase/PascalCase words
const CAMEL_CASE_SPLIT_PATTERN = /(?=[A-Z])|(?<=[A-Z])/u;

function isUpperCase(str: string): boolean {
	return str === str.toUpperCase();
}

function upperFirst(str: string): string {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

function lowerFirst(str: string): string {
	return str.charAt(0).toLowerCase() + str.slice(1);
}

function isUpperFirst(str: string): boolean {
	return str.length > 0 && isUpperCase(str.charAt(0));
}

// Cache for compiled regex patterns
const regexCache = new Map<string, RegExp>();

function compileRegex(pattern: string | RegExp): RegExp {
	if (pattern instanceof RegExp) return pattern;

	const cached = regexCache.get(pattern);
	if (cached !== undefined) return cached;

	const compiled = new RegExp(pattern, "u");
	regexCache.set(pattern, compiled);
	return compiled;
}

// Cache for word replacements
const wordReplacementCache = new Map<
	string,
	{
		replacements: ReadonlyArray<string>;
		options: PreventAbbreviationsOptions;
	}
>();

function getWordReplacements(word: string, options: PreventAbbreviationsOptions): ReadonlyArray<string> {
	// Skip constants and allowList
	if (isUpperCase(word) || options.allowList?.[word]) return [];

	const cacheKey = `${word}:${JSON.stringify(options.replacements)}:${JSON.stringify(options.allowList)}`;
	const cached = wordReplacementCache.get(cacheKey);
	if (cached !== undefined && cached.options === options) return cached.replacements;

	const replacements = options.replacements ?? DEFAULT_REPLACEMENTS;
	const replacement = replacements[lowerFirst(word)] ?? replacements[word] ?? replacements[upperFirst(word)];

	let wordReplacement: ReadonlyArray<string> = [];
	if (replacement !== false && replacement !== undefined) {
		const transform = isUpperFirst(word) ? upperFirst : lowerFirst;
		wordReplacement = Object.entries(replacement)
			.filter(([, enabled]) => enabled)
			.map(([name]) => transform(name))
			.toSorted();
	}

	wordReplacementCache.set(cacheKey, { options, replacements: wordReplacement });
	return wordReplacement;
}

// Cache for name replacements
const nameReplacementCache = new Map<
	string,
	{
		result: { total: number; samples: ReadonlyArray<string> };
		options: PreventAbbreviationsOptions;
	}
>();

function getNameReplacements(
	name: string,
	options: PreventAbbreviationsOptions,
	limit = 3,
): { total: number; samples: ReadonlyArray<string> } {
	// Skip constants and allowList
	if (isUpperCase(name) || options.allowList?.[name]) return { samples: [], total: 0 };

	// Check ignore patterns
	if (options.ignore !== undefined) {
		for (const pattern of options.ignore) {
			const regex = compileRegex(pattern);
			if (regex.test(name)) return { samples: [], total: 0 };
		}
	}

	const cacheKey = `${name}:${JSON.stringify(options.replacements)}:${JSON.stringify(options.allowList)}:${JSON.stringify(options.ignore)}`;
	const cached = nameReplacementCache.get(cacheKey);
	if (cached !== undefined && cached.options === options) return cached.result;

	// Find exact replacements
	const exactReplacements = getWordReplacements(name, options);

	if (exactReplacements.length > 0) {
		const result = {
			samples: exactReplacements.slice(0, limit),
			total: exactReplacements.length,
		};
		nameReplacementCache.set(cacheKey, { options, result });
		return result;
	}

	const words = name.split(CAMEL_CASE_SPLIT_PATTERN).filter(Boolean);

	let hasReplacements = false;
	const combinations = words.map((word) => {
		const wordReplacements = getWordReplacements(word, options);

		if (wordReplacements.length > 0) {
			hasReplacements = true;
			return wordReplacements;
		}

		return [word];
	});

	// No replacements for any word
	if (!hasReplacements) {
		const result = { samples: [], total: 0 };
		nameReplacementCache.set(cacheKey, { options, result });
		return result;
	}

	// Simple cartesian product (limited)
	const samplesArray: Array<string> = [];
	let total = 1;
	for (const combo of combinations) total *= combo.length;

	// Generate samples (simplified - just take first few combinations)
	const maxSamples = Math.min(limit, total);
	for (let index = 0; index < maxSamples; index += 1) {
		let sample = "";
		let jndex = index;
		for (const combo of combinations) {
			sample += combo[jndex % combo.length];
			jndex = Math.floor(jndex / combo.length);
		}
		samplesArray.push(sample);
	}

	const samples: ReadonlyArray<string> = samplesArray;

	const result = { samples, total };
	nameReplacementCache.set(cacheKey, { options, result });
	return result;
}

function getMessage(
	discouragedName: string,
	replacements: { total: number; samples: ReadonlyArray<string> },
	nameTypeText: string,
): { messageId: MessageIds; data: Record<string, string> } {
	const { total, samples = [] } = replacements;

	if (total === 1) {
		return {
			data: {
				discouragedName,
				nameTypeText,
				replacement: samples[0] ?? "",
			},
			messageId: "replace",
		};
	}

	let replacementsText = samples.map((replacement) => `\`${replacement}\``).join(", ");

	const omittedReplacementsCount = total - samples.length;
	if (omittedReplacementsCount > 0) {
		replacementsText += `, ... (${omittedReplacementsCount > 99 ? "99+" : omittedReplacementsCount} more omitted)`;
	}

	return {
		data: {
			discouragedName,
			nameTypeText,
			replacementsText,
		},
		messageId: "suggestion",
	};
}

function shouldReportIdentifierAsProperty(node: TSESTree.Identifier): boolean {
	const { parent } = node;
	if (parent === undefined) return false;

	if (
		parent.type === AST_NODE_TYPES.MemberExpression &&
		parent.property === node &&
		!parent.computed &&
		parent.parent !== undefined &&
		parent.parent.type === AST_NODE_TYPES.AssignmentExpression &&
		parent.parent.left === parent
	) {
		return true;
	}

	if (
		parent.type === AST_NODE_TYPES.Property &&
		parent.key === node &&
		!parent.computed &&
		!parent.shorthand &&
		parent.parent !== undefined &&
		parent.parent.type === AST_NODE_TYPES.ObjectExpression
	) {
		return true;
	}

	if (
		(parent.type === AST_NODE_TYPES.MethodDefinition || parent.type === AST_NODE_TYPES.PropertyDefinition) &&
		parent.key === node &&
		!parent.computed
	) {
		return true;
	}

	return false;
}

export default createRule<Options, MessageIds>({
	create(context) {
		const [
			{
				checkFilenames = true,
				checkProperties = false,
				checkVariables = true,
				replacements,
				allowList,
				ignore,
			} = {},
		] = context.options;

		const options: PreventAbbreviationsOptions = {
			allowList: { ...DEFAULT_ALLOW_LIST, ...allowList },
			checkFilenames,
			checkProperties,
			checkVariables,
			ignore: [...DEFAULT_IGNORE, ...(ignore ?? [])],
			replacements: replacements ?? DEFAULT_REPLACEMENTS,
		};

		return {
			Identifier(node): void {
				if (!(checkProperties || checkVariables)) return;

				const identifierReplacements = getNameReplacements(node.name, options);
				if (identifierReplacements.total === 0) return;

				if (checkProperties && shouldReportIdentifierAsProperty(node)) {
					context.report({
						...getMessage(node.name, identifierReplacements, "property"),
						node,
					});
				}
			},

			"Program:exit"(program): void {
				if (!checkVariables) return;

				const scope = context.sourceCode.getScope(program);

				for (const variable of scope.variables) {
					if (variable.defs.length === 0) continue;

					const variableReplacements = getNameReplacements(variable.name, options);

					if (variableReplacements.total === 0) continue;

					const [definition] = variable.defs;
					if (definition === undefined) continue;
					if (definition.name === undefined) continue;
					if (definition.name.type !== AST_NODE_TYPES.Identifier) continue;

					context.report({
						...getMessage(definition.name.name, variableReplacements, "variable"),
						node: definition.name,
					});
				}
			},
		};
	},
	defaultOptions: [{}],
	meta: {
		docs: {
			description: "Prevent abbreviations",
		},
		fixable: "code",
		messages: {
			replace:
				"The {{nameTypeText}} `{{discouragedName}}` should be named `{{replacement}}`. A more descriptive name will do too.",
			suggestion:
				"Please rename the {{nameTypeText}} `{{discouragedName}}`. Suggested names are: {{replacementsText}}. A more descriptive name will do too.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					allowList: {
						type: "object",
					},
					checkFilenames: {
						default: true,
						type: "boolean",
					},
					checkProperties: {
						default: false,
						type: "boolean",
					},
					checkVariables: {
						default: true,
						type: "boolean",
					},
					ignore: {
						items: {
							oneOf: [{ type: "string" }, { type: "object" }],
						},
						type: "array",
					},
					replacements: {
						type: "object",
					},
				},
				type: "object",
			},
		],
		type: "suggestion",
	},
	name: "prevent-abbreviations",
});
