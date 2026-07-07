import { getDefinedValue } from "$utilities/defined-utilities";

import {
	MetaSelectors,
	ModifierWeights,
	Selectors,
	TYPE_REFERENCE_LOOSE_MODIFIER_WEIGHT,
	TYPE_REFERENCE_STRICT_MODIFIER_WEIGHT,
	TypeModifierWeights,
} from "./enums";
import { getEnumNames } from "./get-enum-names";
import { isMetaSelector, isMethodOrPropertySelector } from "./shared";
import { createValidator } from "./validator";

import type { Except } from "type-fest";

import type { IndividualAndMetaSelectorsString, MetaSelectorsString } from "./enums";
import type { Context, NormalizedMatchRegex, NormalizedSelector, ParsedOptions, Selector } from "./types";

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

// oxlint-disable-next-line sonar/cognitive-complexity -- lol.
function normalizeOption(option: Selector): Array<NormalizedSelector> {
	let weight = 0;
	if (option.modifiers) for (const modifier of option.modifiers) weight += ModifierWeights[modifier];
	if (option.types) {
		for (const matcher of option.types) {
			if (typeof matcher === "string") {
				weight += TypeModifierWeights[matcher];
			} else {
				weight +=
					matcher.from === undefined
						? TYPE_REFERENCE_LOOSE_MODIFIER_WEIGHT
						: TYPE_REFERENCE_STRICT_MODIFIER_WEIGHT;
			}
		}
	}
	if (option.filter !== undefined) weight += 1_000_000_000;

	const normalizedOption: Except<NormalizedSelector, "selectors" | "selectorPriority"> = {
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
		const resolvedSelectors = isMetaSelector(selector)
			? getDefinedValue(META_SELECTOR_MAP[selector])
			: [Selectors[selector]];

		normalizedSelectors.push({
			...normalizedOption,
			selectorPriority: getSelectorPriority(selector),
			selectors: resolvedSelectors,
		});
	}

	return normalizedSelectors;
}

function getSelectorPriority(selector: IndividualAndMetaSelectorsString): number {
	if (selector === MetaSelectors.default) return 0;
	if (isMetaSelector(selector)) return isMethodOrPropertySelector(selector) ? 2 : 1;
	return 3;
}

export function parseOptions(context: Context, options: ReadonlyArray<Selector> = context.options): ParsedOptions {
	const normalizedOptions = options.flatMap(normalizeOption);
	const selectorNames = getEnumNames(Selectors);
	const selectorMap = new Map<string, Array<NormalizedSelector>>();

	for (const selectorName of selectorNames) selectorMap.set(selectorName, []);

	for (const option of normalizedOptions) {
		for (const selector of option.selectors) selectorMap.get(selector)?.push(option);
	}

	const parsedOptions: ParsedOptions = {};
	for (const selectorName of selectorNames) {
		parsedOptions[selectorName] = createValidator(
			selectorName,
			context,
			getDefinedValue(selectorMap.get(selectorName)),
		);
	}
	return parsedOptions;
}
