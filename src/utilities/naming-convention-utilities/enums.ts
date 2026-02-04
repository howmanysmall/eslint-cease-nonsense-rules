export const PredefinedFormats = {
	camelCase: "camelCase",
	PascalCase: "PascalCase",
	StrictPascalCase: "StrictPascalCase",
	snake_case: "snake_case",
	strictCamelCase: "strictCamelCase",
	UPPER_CASE: "UPPER_CASE",
};
export type PredefinedFormatsString = keyof typeof PredefinedFormats;
export type PredefinedFormats = (typeof PredefinedFormats)[PredefinedFormatsString];

export const UnderscoreOptions = {
	allow: "allow",
	allowDouble: "allowDouble",
	allowSingleOrDouble: "allowSingleOrDouble",
	forbid: "forbid",
	require: "require",
	requireDouble: "requireDouble",
};
export type UnderscoreOptionsString = keyof typeof UnderscoreOptions;
export type UnderscoreOptions = (typeof UnderscoreOptions)[UnderscoreOptionsString];

export const Selectors = {
	autoAccessor: "autoAccessor",
	class: "class",
	classicAccessor: "classicAccessor",
	classMethod: "classMethod",
	classProperty: "classProperty",
	enum: "enum",
	enumMember: "enumMember",
	function: "function",
	import: "import",
	interface: "interface",
	objectLiteralMethod: "objectLiteralMethod",
	objectLiteralProperty: "objectLiteralProperty",
	parameter: "parameter",
	parameterProperty: "parameterProperty",
	typeAlias: "typeAlias",
	typeMethod: "typeMethod",
	typeParameter: "typeParameter",
	typeProperty: "typeProperty",
	variable: "variable",
};
export type SelectorsString = keyof typeof Selectors;
export type Selectors = (typeof Selectors)[SelectorsString];

export const MetaSelectors = {
	accessor: "accessor",
	default: "default",
	memberLike: "memberLike",
	method: "method",
	property: "property",
	typeLike: "typeLike",
	variableLike: "variableLike",
};
export type MetaSelectorsString = keyof typeof MetaSelectors;
export type IndividualAndMetaSelectorsString = MetaSelectorsString | SelectorsString;

export const Modifiers = {
	"#private": "#private",
	abstract: "abstract",
	async: "async",
	const: "const",
	default: "default",
	destructured: "destructured",
	exported: "exported",
	global: "global",
	namespace: "namespace",
	override: "override",
	private: "private",
	protected: "protected",
	public: "public",
	readonly: "readonly",
	requiresQuotes: "requiresQuotes",
	static: "static",
	unused: "unused",
};
export type ModifiersString = keyof typeof Modifiers;
export type Modifiers = (typeof Modifiers)[ModifiersString];

export const TypeModifiers = {
	array: "array",
	boolean: "boolean",
	function: "function",
	number: "number",
	string: "string",
};
export type TypeModifiersString = keyof typeof TypeModifiers;
export type TypeModifiers = (typeof TypeModifiers)[TypeModifiersString];

export const ModifierWeights: Record<ModifiersString, number> = {
	"#private": 64,
	abstract: 128,
	async: 2 ** 14,
	const: 1,
	default: 2 ** 15,
	destructured: 256,
	exported: 2 ** 10,
	global: 512,
	namespace: 2 ** 16,
	override: 2 ** 13,
	private: 32,
	protected: 16,
	public: 8,
	readonly: 2,
	requiresQuotes: 2 ** 12,
	static: 4,
	unused: 2 ** 11,
};

export const TypeModifierWeights: Record<TypeModifiersString, number> = {
	array: 2 ** 21,
	boolean: 2 ** 17,
	function: 2 ** 20,
	number: 2 ** 19,
	string: 2 ** 18,
};
