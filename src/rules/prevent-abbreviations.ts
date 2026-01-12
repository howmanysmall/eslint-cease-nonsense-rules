import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utilities/create-rule";

type MessageIds = "replace" | "suggestion";

export interface PreventAbbreviationsOptions {
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
// Split before uppercase letters that follow lowercase letters
const CAMEL_CASE_SPLIT_PATTERN = /(?<=[a-z])(?=[A-Z])/u;

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

function getWordReplacements(
	word: string,
	options: PreventAbbreviationsOptions,
	includeDisabled = true,
): ReadonlyArray<string> {
	// Skip constants and allowList
	if (isUpperCase(word) || options.allowList?.[word]) return [];

	const cacheKey = `${word}:${JSON.stringify(options.replacements)}:${JSON.stringify(options.allowList)}:${includeDisabled}`;
	const cached = wordReplacementCache.get(cacheKey);
	if (cached !== undefined && cached.options === options) return cached.replacements;

	const replacements = options.replacements ?? DEFAULT_REPLACEMENTS;
	const replacement = replacements[lowerFirst(word)] ?? replacements[word] ?? replacements[upperFirst(word)];

	let wordReplacement: ReadonlyArray<string> = [];
	if (replacement !== false && replacement !== undefined) {
		const transform = isUpperFirst(word) ? upperFirst : lowerFirst;
		// Include all replacements (enabled and disabled) for suggestions, or only enabled for fixes
		wordReplacement = Object.entries(replacement)
			.filter(([, enabled]) => includeDisabled || enabled)
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

	// Find exact replacements (include disabled for suggestions)
	const exactReplacements = getWordReplacements(name, options, true);

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
		const wordReplacements = getWordReplacements(word, options, true);

		if (wordReplacements.length > 0) {
			hasReplacements = true;
			// Preserve the original case of the word when replacing
			// If word is "Err" (capital E), we want "Error" (capital E), not "error"
			const isCapitalized = isUpperFirst(word);
			return wordReplacements.map((replacement) => (isCapitalized ? upperFirst(replacement) : replacement));
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
			const replacement = combo[jndex % combo.length];
			if (replacement !== undefined) {
				sample += replacement;
			}
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
					const message = getMessage(node.name, identifierReplacements, "property");
					const reportOptions: {
						fix?: (fixer: TSESLint.RuleFixer) => TSESLint.RuleFix;
					} & typeof message & { node: TSESTree.Identifier } = {
						...message,
						node,
					};

					// Only provide fix if there's exactly one total replacement (not just enabled)
					// If there are multiple total replacements, show suggestion without fix
					if (identifierReplacements.total === 1 && identifierReplacements.samples[0]) {
						// Check if the single replacement is enabled
						const enabledReplacements = getWordReplacements(node.name, options, false);
						if (enabledReplacements.length === 1 && enabledReplacements[0]) {
							reportOptions.fix = (fixer: TSESLint.RuleFixer): TSESLint.RuleFix =>
								fixer.replaceText(node, identifierReplacements.samples[0] ?? node.name);
						}
					}

					context.report(reportOptions);
					return;
				}

				if (!checkVariables) return;

				// Check if this identifier is a variable declaration
				const { parent } = node;
				if (parent === undefined) return;

				// VariableDeclarator: const err = ...
				if (
					parent.type === AST_NODE_TYPES.VariableDeclarator &&
					parent.id.type === AST_NODE_TYPES.Identifier &&
					parent.id === node
				) {
					const message = getMessage(node.name, identifierReplacements, "variable");
					const reportOptions: {
						fix?: (fixer: TSESLint.RuleFixer) => TSESLint.RuleFix;
					} & typeof message & { node: TSESTree.Identifier } = {
						...message,
						node,
					};

					// Only provide fix if there's exactly one total replacement
					// For multi-word names (like myErr), check if any word has an enabled replacement
					if (identifierReplacements.total === 1 && identifierReplacements.samples[0]) {
						// For single-word names, check if the replacement is enabled
						// For multi-word names, if total is 1, provide the fix (words are already checked)
						const words = node.name.split(CAMEL_CASE_SPLIT_PATTERN).filter(Boolean);
						if (words.length === 1) {
							const enabledReplacements = getWordReplacements(node.name, options, false);
							if (enabledReplacements.length === 1 && enabledReplacements[0]) {
								reportOptions.fix = (fixer: TSESLint.RuleFixer): TSESLint.RuleFix =>
									fixer.replaceText(node, identifierReplacements.samples[0] ?? node.name);
							}
						} else {
							// Multi-word name: check if at least one word has an enabled replacement
							const hasEnabledReplacement = words.some((word) => {
								const enabled = getWordReplacements(word, options, false);
								return enabled.length > 0;
							});
							if (hasEnabledReplacement) {
								reportOptions.fix = (fixer: TSESLint.RuleFixer): TSESLint.RuleFix =>
									fixer.replaceText(node, identifierReplacements.samples[0] ?? node.name);
							}
						}
					}

					context.report(reportOptions);
					return;
				}

				// Function parameter: function foo(err) { ... }
				// Parameters can be identifiers directly or in patterns
				if (
					parent.type === AST_NODE_TYPES.FunctionDeclaration ||
					parent.type === AST_NODE_TYPES.FunctionExpression ||
					parent.type === AST_NODE_TYPES.ArrowFunctionExpression
				) {
					const isParameter = parent.params.some((param) => {
						if (param === node) return true;
						if (param.type === AST_NODE_TYPES.Identifier && param === node) return true;
						return false;
					});

					if (isParameter) {
						const message = getMessage(node.name, identifierReplacements, "variable");
						const reportOptions: {
							fix?: (fixer: TSESLint.RuleFixer) => TSESLint.RuleFix | ReadonlyArray<TSESLint.RuleFix>;
						} & typeof message & { node: TSESTree.Identifier } = {
							...message,
							node,
						};

						// Only provide fix if there's exactly one total replacement
						// For multi-word names (like myErr), check if any word has an enabled replacement
						if (identifierReplacements.total === 1 && identifierReplacements.samples[0]) {
							// For single-word names, check if the replacement is enabled
							// For multi-word names, if total is 1, provide the fix (words are already checked)
							const words = node.name.split(CAMEL_CASE_SPLIT_PATTERN).filter(Boolean);
							let shouldFix = false;
							if (words.length === 1) {
								const enabledReplacements = getWordReplacements(node.name, options, false);
								shouldFix = enabledReplacements.length === 1 && enabledReplacements[0] !== undefined;
							} else {
								// Multi-word name: check if at least one word has an enabled replacement
								shouldFix = words.some((word) => {
									const enabled = getWordReplacements(word, options, false);
									return enabled.length > 0;
								});
							}

							if (shouldFix) {
								reportOptions.fix = (
									fixer: TSESLint.RuleFixer,
								): TSESLint.RuleFix | ReadonlyArray<TSESLint.RuleFix> => {
									// Replace all occurrences of this parameter in the function body
									const { sourceCode } = context;
									const functionBody = parent.body;
									if (functionBody === undefined) {
										return fixer.replaceText(node, identifierReplacements.samples[0] ?? node.name);
									}

									const fixes: Array<TSESLint.RuleFix> = [
										fixer.replaceText(node, identifierReplacements.samples[0] ?? node.name),
									];

									// Find all references to this parameter in the function body
									const scope = sourceCode.getScope(functionBody);
									const variable = scope.variables.find(
										(variableItem) => variableItem.name === node.name,
									);
									if (variable !== undefined) {
										for (const reference of variable.references) {
											if (
												reference.identifier !== node &&
												reference.identifier.type === AST_NODE_TYPES.Identifier
											) {
												fixes.push(
													fixer.replaceText(
														reference.identifier,
														identifierReplacements.samples[0] ?? node.name,
													),
												);
											}
										}
									}

									return fixes;
								};
							}
						}

						context.report(reportOptions);
					}
				}
			},

			"Program:exit"(): void {
				// Variables are now checked in Identifier visitor above
				// This exit handler is kept for any edge cases but primarily
				// Variable checking happens in the Identifier visitor
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
