// oxlint-disable-next-line sort-keys -- coal!
export const PredefinedFormats = {
	camelCase: "camelCase",
	PascalCase: "PascalCase",
	StrictPascalCase: "StrictPascalCase",
	snake_case: "snake_case",
	strictCamelCase: "strictCamelCase",
	UPPER_CASE: "UPPER_CASE",
} as const;
export type PredefinedFormatsString = keyof typeof PredefinedFormats;
export type PredefinedFormats = (typeof PredefinedFormats)[PredefinedFormatsString];

export const UnderscoreOptions = {
	allow: "allow",
	allowDouble: "allowDouble",
	allowSingleOrDouble: "allowSingleOrDouble",
	forbid: "forbid",
	require: "require",
	requireDouble: "requireDouble",
} as const;
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
} as const;
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
} as const;
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
} as const;
export type ModifiersString = keyof typeof Modifiers;
export type Modifiers = (typeof Modifiers)[ModifiersString];

export const TypeModifiers = {
	array: "array",
	boolean: "boolean",
	function: "function",
	number: "number",
	string: "string",
} as const;
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
} as const;

export const TypeModifierWeights: Record<TypeModifiersString, number> = {
	array: 2 ** 21,
	boolean: 2 ** 17,
	function: 2 ** 20,
	number: 2 ** 19,
	string: 2 ** 18,
} as const;

export const TYPE_REFERENCE_LOOSE_MODIFIER_WEIGHT = 2 ** 22;
export const TYPE_REFERENCE_STRICT_MODIFIER_WEIGHT = 2 ** 23;
