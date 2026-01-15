import type { IndividualAndMetaSelectorsString, MetaSelectorsString } from "./enums";
import { MetaSelectors } from "./enums";

export function selectorTypeToMessageString(selectorType: string): string {
	const notCamelCase = selectorType.replaceAll(/([A-Z])/g, " $1");
	return notCamelCase.charAt(0).toUpperCase() + notCamelCase.slice(1);
}

export function isMetaSelector(selector: IndividualAndMetaSelectorsString): selector is MetaSelectorsString {
	return selector in MetaSelectors;
}

export function isMethodOrPropertySelector(selector: IndividualAndMetaSelectorsString): boolean {
	return selector === "method" || selector === "property";
}
