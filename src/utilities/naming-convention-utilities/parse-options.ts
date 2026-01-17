import type { MetaSelectorsString } from "./enums";
import { MetaSelectors, ModifierWeights, Selectors, TypeModifierWeights } from "./enums";
import { getEnumNames } from "./get-enum-names";
import { isMetaSelector, isMethodOrPropertySelector } from "./shared";
import type { Context, NormalizedMatchRegex, NormalizedSelector, ParsedOptions, Selector } from "./types";
import { createValidator } from "./validator";

const META_SELECTOR_MAP: Record<MetaSelectorsString, Array<keyof typeof Selectors>> = {
	accessor: ["classicAccessor", "autoAccessor"],
	default: getEnumNames(Selectors),
	memberLike: [
		"classProperty",
		"objectLiteralProperty",
		"typeProperty",
		"parameterProperty",
		"enumMember",
		"classMethod",
		"objectLiteralMethod",
		"typeMethod",
		"classicAccessor",
		"autoAccessor",
	],
	method: ["classMethod", "objectLiteralMethod", "typeMethod"],
	property: ["classProperty", "objectLiteralProperty", "typeProperty"],
	typeLike: ["class", "interface", "typeAlias", "enum", "typeParameter"],
	variableLike: ["variable", "function", "parameter"],
};
function normalizeFilter(option: Selector): NormalizedMatchRegex | undefined {
	if (option.filter === undefined) return undefined;
	if (typeof option.filter === "string") return { match: true, regex: new RegExp(option.filter, "u") };
	return { match: option.filter.match, regex: new RegExp(option.filter.regex, "u") };
}

function normalizeCustom(option: Selector): NormalizedMatchRegex | undefined {
	if (option.custom === undefined) return undefined;

	return { match: option.custom.match, regex: new RegExp(option.custom.regex, "u") };
}

function normalizeOption(option: Selector): Array<NormalizedSelector> {
	let weight = 0;
	if (option.modifiers) for (const modifier of option.modifiers) weight += ModifierWeights[modifier];
	if (option.types) for (const modifier of option.types) weight += TypeModifierWeights[modifier];
	if (option.filter !== undefined) weight += 1_000_000_000;

	const normalizedOption: Omit<NormalizedSelector, "selectors" | "selectorPriority"> = {
		modifierWeight: weight,
	};

	const custom = normalizeCustom(option);
	if (custom !== undefined) normalizedOption.custom = custom;

	const filter = normalizeFilter(option);
	if (filter !== undefined) normalizedOption.filter = filter;
	if (Array.isArray(option.format)) normalizedOption.format = option.format;

	if (option.leadingUnderscore !== undefined) normalizedOption.leadingUnderscore = option.leadingUnderscore;
	if (option.modifiers && option.modifiers.length > 0) normalizedOption.modifiers = option.modifiers;
	if (option.prefix && option.prefix.length > 0) normalizedOption.prefix = option.prefix;
	if (option.suffix && option.suffix.length > 0) normalizedOption.suffix = option.suffix;
	if (option.trailingUnderscore !== undefined) normalizedOption.trailingUnderscore = option.trailingUnderscore;
	if (option.types && option.types.length > 0) normalizedOption.types = option.types;

	const selectors = Array.isArray(option.selector) ? option.selector : [option.selector];
	const normalizedSelectors = new Array<NormalizedSelector>();

	for (const selector of selectors) {
		const isDefault = selector === MetaSelectors.default;
		const selectorPriority = isDefault
			? 0
			: isMetaSelector(selector)
				? isMethodOrPropertySelector(selector)
					? 2
					: 1
				: 3;

		const resolvedSelectors = (
			isMetaSelector(selector) ? (META_SELECTOR_MAP[selector] ?? []) : [Selectors[selector]]
		) as Array<string>;

		normalizedSelectors.push({
			...normalizedOption,
			selectorPriority,
			selectors: resolvedSelectors,
		});
	}

	return normalizedSelectors;
}

export function parseOptions(context: Context): ParsedOptions {
	const normalizedOptions = context.options.flatMap(normalizeOption);
	const selectorNames = getEnumNames(Selectors);
	const selectorMap = new Map<string, Array<NormalizedSelector>>();

	for (const selectorName of selectorNames) selectorMap.set(selectorName, []);

	for (const option of normalizedOptions) {
		if (option.selectors.length === 0) {
			for (const selectorName of selectorNames) selectorMap.get(selectorName)?.push(option);
			continue;
		}

		for (const selector of option.selectors) selectorMap.get(selector)?.push(option);
	}

	const entries = selectorNames.map((selectorName) => [
		selectorName,
		createValidator(selectorName, context, selectorMap.get(selectorName) ?? []),
	]);
	return Object.fromEntries(entries) as ParsedOptions;
}
