import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

import type { MessageIds, Options } from "../../rules/naming-convention";
import type {
	IndividualAndMetaSelectorsString,
	ModifiersString,
	PredefinedFormatsString,
	TypeModifiersString,
	UnderscoreOptionsString,
} from "./enums";

export interface MatchRegex {
	match: boolean;
	regex: string;
}

export interface Selector {
	custom?: MatchRegex;
	filter?: string | MatchRegex;
	format?: Array<PredefinedFormatsString> | undefined;
	leadingUnderscore?: UnderscoreOptionsString;
	modifiers?: Array<ModifiersString>;
	prefix?: Array<string>;
	selector: IndividualAndMetaSelectorsString | Array<IndividualAndMetaSelectorsString>;
	suffix?: Array<string>;
	trailingUnderscore?: UnderscoreOptionsString;
	types?: Array<TypeModifiersString>;
}

export interface NormalizedMatchRegex {
	match: boolean;
	regex: RegExp;
}

export interface NormalizedSelector {
	custom?: NormalizedMatchRegex | undefined;
	filter?: NormalizedMatchRegex | undefined;
	format?: Array<PredefinedFormatsString> | undefined;
	leadingUnderscore?: UnderscoreOptionsString | undefined;
	modifiers?: Array<ModifiersString> | undefined;
	modifierWeight: number;
	prefix?: Array<string> | undefined;
	selectors: Array<string>;
	selectorPriority: number;
	suffix?: Array<string> | undefined;
	trailingUnderscore?: UnderscoreOptionsString | undefined;
	types?: Array<TypeModifiersString> | undefined;
}

export type ValidatorFunction = (
	node: TSESTree.Identifier | TSESTree.Literal | TSESTree.PrivateIdentifier,
	modifiers?: Set<string>,
) => void;

export type ParsedOptions = Record<string, ValidatorFunction>;
export type Context = Readonly<TSESLint.RuleContext<MessageIds, Options>>;
