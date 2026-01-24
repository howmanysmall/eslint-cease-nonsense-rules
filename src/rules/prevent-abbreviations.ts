import path from "node:path";
import { DefinitionType, ScopeType } from "@typescript-eslint/scope-manager";
import type { JSONSchema, TSESLint, TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { regex } from "arkregex";
import { isIdentifierPart, isIdentifierStart, ScriptTarget } from "typescript";
import { createRule } from "../utilities/create-rule";

type MessageIds = "replace" | "suggestion";
type ImportCheckOption = boolean | "internal";

export interface PreventAbbreviationsOptions {
	readonly checkProperties?: boolean;
	readonly checkVariables?: boolean;
	readonly checkDefaultAndNamespaceImports?: ImportCheckOption;
	readonly checkShorthandImports?: ImportCheckOption;
	readonly checkShorthandProperties?: boolean;
	readonly checkFilenames?: boolean;
	readonly extendDefaultReplacements?: boolean;
	readonly replacements?: Record<string, Record<string, boolean> | false>;
	readonly extendDefaultAllowList?: boolean;
	readonly allowList?: Record<string, boolean>;
	readonly ignore?: ReadonlyArray<string | RegExp>;
}

type Options = [PreventAbbreviationsOptions?];

const MESSAGE_ID_REPLACE = "replace";
const MESSAGE_ID_SUGGESTION = "suggestion";
const anotherNameMessage = "A more descriptive name will do too.";
const messages = {
	[MESSAGE_ID_REPLACE]: `The {{nameTypeText}} \`{{discouragedName}}\` should be named \`{{replacement}}\`. ${anotherNameMessage}`,
	[MESSAGE_ID_SUGGESTION]: `Please rename the {{nameTypeText}} \`{{discouragedName}}\`. Suggested names are: {{replacementsText}}. ${anotherNameMessage}`,
};

const schema: ReadonlyArray<JSONSchema.JSONSchema4> = [
	{
		additionalProperties: true,
		type: "object",
	},
];

const DEFAULT_REPLACEMENTS: Record<string, Record<string, boolean>> = {
	acc: {
		accumulator: true,
	},
	arg: {
		argument: true,
	},
	args: {
		arguments: true,
	},
	arr: {
		array: true,
	},
	attr: {
		attribute: true,
	},
	attrs: {
		attributes: true,
	},
	btn: {
		button: true,
	},
	cb: {
		callback: true,
	},
	conf: {
		config: true,
	},
	ctx: {
		context: true,
	},
	cur: {
		current: true,
	},
	curr: {
		current: true,
	},
	db: {
		database: true,
	},
	def: {
		defer: true,
		deferred: true,
		define: true,
		definition: true,
	},
	dest: {
		destination: true,
	},
	dev: {
		development: true,
	},
	dir: {
		direction: true,
		directory: true,
	},
	dirs: {
		directories: true,
	},
	dist: {
		distance: true,
	},
	doc: {
		document: true,
	},
	docs: {
		documentation: true,
		documents: true,
	},
	dst: {
		daylightSavingTime: true,
		destination: true,
		distribution: true,
	},
	e: {
		error: true,
		event: true,
	},
	el: {
		element: true,
	},
	elem: {
		element: true,
	},
	elems: {
		elements: true,
	},
	env: {
		environment: true,
	},
	envs: {
		environments: true,
	},
	err: {
		error: true,
	},
	ev: {
		event: true,
	},
	evt: {
		event: true,
	},
	ext: {
		extension: true,
	},
	exts: {
		extensions: true,
	},
	fn: {
		func: true,
		function: true,
	},
	func: {
		function: true,
	},
	i: {
		index: true,
	},
	idx: {
		index: true,
	},
	j: {
		index: true,
	},
	len: {
		length: true,
	},
	lib: {
		library: true,
	},
	mod: {
		module: true,
	},
	msg: {
		message: true,
	},
	num: {
		number: true,
	},
	obj: {
		object: true,
	},
	opts: {
		options: true,
	},
	param: {
		parameter: true,
	},
	params: {
		parameters: true,
	},
	pkg: {
		package: true,
	},
	prev: {
		previous: true,
	},
	prod: {
		production: true,
	},
	prop: {
		property: true,
	},
	props: {
		properties: true,
	},
	ref: {
		reference: true,
	},
	refs: {
		references: true,
	},
	rel: {
		related: true,
		relationship: true,
		relative: true,
	},
	req: {
		request: true,
	},
	res: {
		resource: true,
		response: true,
		result: true,
	},
	ret: {
		returnValue: true,
	},
	retval: {
		returnValue: true,
	},
	sep: {
		separator: true,
	},
	src: {
		source: true,
	},
	stdDev: {
		standardDeviation: true,
	},
	str: {
		string: true,
	},
	tbl: {
		table: true,
	},
	temp: {
		temporary: true,
	},
	tit: {
		title: true,
	},
	tmp: {
		temporary: true,
	},
	util: {
		utility: true,
	},
	utils: {
		utilities: true,
	},
	val: {
		value: true,
	},
	var: {
		variable: true,
	},
	vars: {
		variables: true,
	},
	ver: {
		version: true,
	},
};

const DEFAULT_ALLOW_LIST: Record<string, boolean> = {
	defaultProps: true,
	devDependencies: true,
	EmberENV: true,
	getDerivedStateFromProps: true,
	getInitialProps: true,
	getServerSideProps: true,
	getStaticProps: true,
	iOS: true,
	obj: true,
	propTypes: true,
	setupFilesAfterEnv: true,
};

const DEFAULT_IGNORE = ["i18n", "l10n"];

const WORD_SPLIT_PATTERN = /(?=\P{Lowercase_Letter})|(?<=\P{Letter})/u;

const typescriptReservedWords = new Set([
	"break",
	"case",
	"catch",
	"class",
	"const",
	"continue",
	"debugger",
	"default",
	"delete",
	"do",
	"else",
	"enum",
	"export",
	"extends",
	"false",
	"finally",
	"for",
	"function",
	"if",
	"import",
	"in",
	"instanceof",
	"new",
	"null",
	"return",
	"super",
	"switch",
	"this",
	"throw",
	"true",
	"try",
	"typeof",
	"var",
	"void",
	"while",
	"with",
	"as",
	"implements",
	"interface",
	"let",
	"package",
	"private",
	"protected",
	"public",
	"static",
	"yield",
	"any",
	"boolean",
	"constructor",
	"declare",
	"get",
	"module",
	"require",
	"number",
	"set",
	"string",
	"symbol",
	"type",
	"from",
	"of",
]);

interface PreparedOptions {
	checkProperties: boolean;
	checkVariables: boolean;
	checkDefaultAndNamespaceImports: ImportCheckOption;
	checkShorthandImports: ImportCheckOption;
	checkShorthandProperties: boolean;
	checkFilenames: boolean;
	replacements: Map<string, Map<string, boolean>>;
	allowList: Map<string, boolean>;
	ignore: ReadonlyArray<RegExp>;
}

interface NameReplacements {
	total: number;
	samples?: ReadonlyArray<string>;
}

type IdentifierLike = TSESTree.Identifier | TSESTree.JSXIdentifier;
type StringLiteral = TSESTree.Literal & { value: string };
interface VariableLike {
	readonly name: string;
	readonly defs: ReadonlyArray<TSESLint.Scope.Definition>;
	readonly identifiers: ReadonlyArray<IdentifierLike>;
	readonly references: ReadonlyArray<TSESLint.Scope.Reference>;
	readonly scope: TSESLint.Scope.Scope;
}

function isUpperCase(string: string): boolean {
	return string === string.toUpperCase();
}

function isUpperFirst(string: string): boolean {
	return isUpperCase(string.charAt(0));
}

function upperFirst(string: string): string {
	return string.charAt(0).toUpperCase() + string.slice(1);
}

function lowerFirst(string: string): string {
	return string.charAt(0).toLowerCase() + string.slice(1);
}

function isStringLiteral(node: TSESTree.Node): node is StringLiteral {
	return node.type === AST_NODE_TYPES.Literal && typeof node.value === "string";
}

function isIdentifier(node: TSESTree.Node | undefined): node is TSESTree.Identifier {
	return Boolean(node && node.type === AST_NODE_TYPES.Identifier);
}

function isJsxIdentifier(node: TSESTree.Node | undefined): node is TSESTree.JSXIdentifier {
	return Boolean(node && node.type === AST_NODE_TYPES.JSXIdentifier);
}

function isImportDeclaration(node: TSESTree.Node | undefined): node is TSESTree.ImportDeclaration {
	return Boolean(node && node.type === AST_NODE_TYPES.ImportDeclaration);
}

function isVariableDeclarator(node: TSESTree.Node | undefined): node is TSESTree.VariableDeclarator {
	return Boolean(node && node.type === AST_NODE_TYPES.VariableDeclarator);
}

function isValidIdentifier(name: string): boolean {
	if (name.length === 0 || typescriptReservedWords.has(name)) return false;

	let index = 0;
	const firstCodePoint = name.codePointAt(index);
	if (firstCodePoint === undefined || !isIdentifierStart(firstCodePoint, ScriptTarget.Latest)) return false;

	index += firstCodePoint > 0xff_ff ? 2 : 1;
	while (index < name.length) {
		const codePoint = name.codePointAt(index);
		if (codePoint === undefined || !isIdentifierPart(codePoint, ScriptTarget.Latest)) return false;

		index += codePoint > 0xff_ff ? 2 : 1;
	}

	return true;
}

function getScopes(scope: TSESLint.Scope.Scope): Array<TSESLint.Scope.Scope> {
	return [scope, ...scope.childScopes.flatMap((child) => getScopes(child))];
}

function getReferences(scope: TSESLint.Scope.Scope): ReadonlyArray<TSESLint.Scope.Reference> {
	const references = new Set<TSESLint.Scope.Reference>();
	for (const scopeItem of getScopes(scope)) for (const reference of scopeItem.references) references.add(reference);
	return [...references];
}

function resolveVariableName(
	name: string,
	scope: TSESLint.Scope.Scope | undefined,
): TSESLint.Scope.Variable | undefined {
	let currentScope = scope;
	while (currentScope) {
		const variable = currentScope.set.get(name);
		if (variable) return variable;
		currentScope = currentScope.upper ?? undefined;
	}
	return undefined;
}

function isUnresolvedName(name: string, scope: TSESLint.Scope.Scope): boolean {
	return getReferences(scope).some((reference) => {
		const { identifier } = reference;
		return Boolean(
			identifier &&
			identifier.type === AST_NODE_TYPES.Identifier &&
			identifier.name === name &&
			!reference.resolved,
		);
	});
}

function isSafeName(name: string, scopes: ReadonlyArray<TSESLint.Scope.Scope>): boolean {
	return !scopes.some((scope) => resolveVariableName(name, scope) ?? isUnresolvedName(name, scope));
}

type IsSafe = (name: string, scopes: ReadonlyArray<TSESLint.Scope.Scope>) => boolean;

function getAvailableVariableName(
	name: string,
	scopes: ReadonlyArray<TSESLint.Scope.Scope>,
	isSafe: IsSafe = () => true,
): string | undefined {
	let candidate = name;
	if (!isValidIdentifier(candidate)) {
		candidate = `${candidate}_`;
		if (!isValidIdentifier(candidate)) {
			return undefined;
		}
	}

	while (!(isSafeName(candidate, scopes) && isSafe(candidate, scopes))) {
		candidate = `${candidate}_`;
	}

	return candidate;
}

function getVariableIdentifiers(variable: VariableLike): ReadonlyArray<IdentifierLike> {
	const identifiers = new Set<IdentifierLike>();
	for (const identifier of variable.identifiers) {
		identifiers.add(identifier);
	}
	for (const reference of variable.references) {
		const { identifier } = reference;
		if (identifier) {
			identifiers.add(identifier);
		}
	}
	return [...identifiers];
}

function hasSameRange(node1: TSESTree.Node, node2: TSESTree.Node): boolean {
	const range1 = node1.range;
	const range2 = node2.range;
	return range1[0] === range2[0] && range1[1] === range2[1];
}

function isShorthandImportLocal(node: TSESTree.Identifier): boolean {
	const { parent } = node;
	if (!parent || parent.type !== AST_NODE_TYPES.ImportSpecifier || parent.local !== node) return false;
	return hasSameRange(parent.local, parent.imported);
}

function isShorthandExportLocal(node: TSESTree.Identifier): boolean {
	const { parent } = node;
	if (!parent || parent.type !== AST_NODE_TYPES.ExportSpecifier || parent.local !== node) return false;
	return hasSameRange(parent.local, parent.exported);
}

function isShorthandPropertyValue(identifier: TSESTree.Identifier): boolean {
	const { parent } = identifier;
	return Boolean(
		parent && parent.type === AST_NODE_TYPES.Property && parent.shorthand && parent.value === identifier,
	);
}

function isShorthandPropertyAssignmentPatternLeft(identifier: TSESTree.Identifier): boolean {
	const { parent } = identifier;
	if (!parent || parent.type !== AST_NODE_TYPES.AssignmentPattern || parent.left !== identifier) return false;

	const property = parent.parent;
	return Boolean(
		property && property.type === AST_NODE_TYPES.Property && property.shorthand && property.value === parent,
	);
}

function replaceReferenceIdentifier(
	identifier: IdentifierLike,
	replacement: string,
	fixer: TSESLint.RuleFixer,
): TSESLint.RuleFix | undefined {
	if (!isIdentifier(identifier)) return undefined;
	if (isShorthandPropertyValue(identifier) || isShorthandPropertyAssignmentPatternLeft(identifier)) {
		return fixer.replaceText(identifier, `${identifier.name}: ${replacement}`);
	}

	if (isShorthandImportLocal(identifier)) {
		return fixer.replaceText(identifier, `${identifier.name} as ${replacement}`);
	}

	if (isShorthandExportLocal(identifier)) {
		return fixer.replaceText(identifier, `${replacement} as ${identifier.name}`);
	}

	if (identifier.typeAnnotation) {
		const identifierRange = identifier.range;
		const annotationRange = identifier.typeAnnotation.range;
		return fixer.replaceTextRange(
			[identifierRange[0], annotationRange[0]],
			`${replacement}${identifier.optional ? "?" : ""}`,
		);
	}

	return fixer.replaceText(identifier, replacement);
}

function renameVariable(
	variable: VariableLike,
	name: string,
	fixer: TSESLint.RuleFixer,
): ReadonlyArray<TSESLint.RuleFix> {
	return getVariableIdentifiers(variable)
		.map((identifier) => replaceReferenceIdentifier(identifier, name, fixer))
		.filter((fix): fix is TSESLint.RuleFix => fix !== undefined);
}

function prepareOptions(options: PreventAbbreviationsOptions | undefined): PreparedOptions {
	const {
		checkProperties = false,
		checkVariables = true,
		checkDefaultAndNamespaceImports = "internal",
		checkShorthandImports = "internal",
		checkShorthandProperties = false,
		checkFilenames = true,
		extendDefaultReplacements = true,
		replacements = {},
		extendDefaultAllowList = true,
		allowList = {},
		ignore = [],
	} = options ?? {};

	const replacementKeys = new Set([...Object.keys(DEFAULT_REPLACEMENTS), ...Object.keys(replacements)]);
	const mergedReplacements = extendDefaultReplacements
		? Object.fromEntries(
				[...replacementKeys].map((name) => {
					const override = replacements[name];
					const base = DEFAULT_REPLACEMENTS[name] ?? {};
					if (override === false) return [name, {}];
					return [name, { ...base, ...override }];
				}),
			)
		: Object.fromEntries(
				Object.entries(replacements).map(([name, override]) => [name, override === false ? {} : override]),
			);

	const mergedAllowList = extendDefaultAllowList ? { ...DEFAULT_ALLOW_LIST, ...allowList } : allowList;

	const ignorePatterns = [...DEFAULT_IGNORE, ...ignore].map((pattern) =>
		pattern instanceof RegExp ? pattern : new RegExp(pattern, "u"),
	);

	return {
		allowList: new Map(Object.entries(mergedAllowList)),
		checkDefaultAndNamespaceImports,
		checkFilenames,
		checkProperties,
		checkShorthandImports,
		checkShorthandProperties,
		checkVariables,
		ignore: ignorePatterns,
		replacements: new Map(
			Object.entries(mergedReplacements).map(([discouragedName, replacementsForName]) => [
				discouragedName,
				new Map(Object.entries(replacementsForName ?? {})),
			]),
		),
	};
}

const IS_ALPHABETIC = regex("^[A-Za-z]+$", "u");

function getWordReplacements(word: string, options: PreparedOptions): ReadonlyArray<string> {
	if (isUpperCase(word) || options.allowList.get(word)) return [];

	const replacement =
		options.replacements.get(lowerFirst(word)) ??
		options.replacements.get(word) ??
		options.replacements.get(upperFirst(word));

	if (!replacement) return [];

	const transform = isUpperFirst(word) ? upperFirst : lowerFirst;
	// oxlint-disable-next-line unicorn/no-array-callback-reference
	const wordReplacement = [...replacement.keys()].filter((name) => replacement.get(name)).map(transform);

	return wordReplacement.length > 0 ? [...wordReplacement].toSorted() : [];
}

function isDiscouragedReplacementName(name: string, options: PreparedOptions): boolean {
	const replacement = options.replacements.get(name);
	if (!replacement) return false;

	for (const enabled of replacement.values()) if (enabled) return true;
	return false;
}

function cartesianProductSamples(
	combinations: ReadonlyArray<ReadonlyArray<string>>,
	length = Number.POSITIVE_INFINITY,
): { total: number; samples: Array<Array<string>> } {
	const total = combinations.reduce((count, { length: optionLength }) => count * optionLength, 1);
	const sampleCount = Math.min(total, length);
	const samples = Array.from({ length: sampleCount }, (_, sampleIndex) => {
		let indexRemaining = sampleIndex;
		const combination = new Array<string>();
		for (let combinationIndex = combinations.length - 1; combinationIndex >= 0; combinationIndex -= 1) {
			const items = combinations[combinationIndex] ?? [];
			const itemLength = items.length;
			const index = indexRemaining % itemLength;
			indexRemaining = (indexRemaining - index) / itemLength;
			const item = items[index];
			if (item !== undefined) combination.unshift(item);
		}
		return combination;
	});

	return { samples, total };
}

function getNameReplacements(name: string, options: PreparedOptions, limit = 3): NameReplacements {
	const { allowList, ignore } = options;
	if (isUpperCase(name) || allowList.get(name) || ignore.some((regexp) => regexp.test(name))) return { total: 0 };

	const exactReplacements = getWordReplacements(name, options);
	if (exactReplacements.length > 0) {
		return {
			samples: exactReplacements.slice(0, limit),
			total: exactReplacements.length,
		};
	}

	const words = name.split(WORD_SPLIT_PATTERN).filter(Boolean);
	let hasReplacements = false;
	const combinations = words.map((word) => {
		const wordReplacements = getWordReplacements(word, options);
		if (wordReplacements.length > 0) {
			hasReplacements = true;
			return wordReplacements;
		}
		return [word];
	});

	if (!hasReplacements) return { total: 0 };

	const { total, samples } = cartesianProductSamples(combinations, limit);
	for (const parts of samples) {
		for (let index = parts.length - 1; index > 0; index -= 1) {
			const word = parts[index] ?? "";
			if (IS_ALPHABETIC.test(word) && parts[index - 1]?.endsWith(word)) parts.splice(index, 1);
		}
	}

	return {
		samples: samples.map((parts) => parts.join("")),
		total,
	};
}

function getMessage(
	discouragedName: string,
	replacements: NameReplacements,
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
			messageId: MESSAGE_ID_REPLACE,
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
		messageId: MESSAGE_ID_SUGGESTION,
	};
}

function isExportedIdentifier(identifier: IdentifierLike): boolean {
	if (!isIdentifier(identifier)) return false;

	const { parent } = identifier;
	if (!parent) return false;

	if (parent.type === AST_NODE_TYPES.VariableDeclarator && parent.id === identifier) {
		const declaration = parent.parent;
		const declarationParent = declaration?.parent;
		return Boolean(
			declaration &&
			declaration.type === AST_NODE_TYPES.VariableDeclaration &&
			declarationParent &&
			declarationParent.type === AST_NODE_TYPES.ExportNamedDeclaration,
		);
	}

	if (parent.type === AST_NODE_TYPES.FunctionDeclaration && parent.id === identifier) {
		return parent.parent?.type === AST_NODE_TYPES.ExportNamedDeclaration;
	}

	if (parent.type === AST_NODE_TYPES.ClassDeclaration && parent.id === identifier) {
		return parent.parent?.type === AST_NODE_TYPES.ExportNamedDeclaration;
	}

	if (parent.type === AST_NODE_TYPES.TSTypeAliasDeclaration && parent.id === identifier) {
		return parent.parent?.type === AST_NODE_TYPES.ExportNamedDeclaration;
	}

	return false;
}

function shouldFix(variable: VariableLike): boolean {
	return getVariableIdentifiers(variable).every(
		(identifier) => !(isExportedIdentifier(identifier) || isJsxIdentifier(identifier)),
	);
}

function isStaticRequire(node: TSESTree.Node | undefined): node is TSESTree.CallExpression {
	if (!node || node.type !== AST_NODE_TYPES.CallExpression || node.optional) return false;

	const { callee, arguments: callArguments } = node;
	if (callee.type !== AST_NODE_TYPES.Identifier || callee.name !== "require") return false;

	if (callArguments.length !== 1) return false;

	const [argument] = callArguments;
	return Boolean(argument && isStringLiteral(argument));
}

function isDefaultOrNamespaceImportName(identifier: TSESTree.Identifier): boolean {
	const { parent } = identifier;
	if (!parent) return false;
	if (parent.type === AST_NODE_TYPES.ImportDefaultSpecifier && parent.local === identifier) return true;
	if (parent.type === AST_NODE_TYPES.ImportNamespaceSpecifier && parent.local === identifier) return true;

	if (
		parent.type === AST_NODE_TYPES.ImportSpecifier &&
		parent.local === identifier &&
		parent.imported.type === AST_NODE_TYPES.Identifier &&
		parent.imported.name === "default"
	) {
		return true;
	}

	if (
		parent.type === AST_NODE_TYPES.VariableDeclarator &&
		parent.id === identifier &&
		isStaticRequire(parent.init ?? undefined)
	) {
		return true;
	}

	return false;
}

function isClassVariable(variable: TSESLint.Scope.Variable): boolean {
	if (variable.defs.length !== 1) return false;

	const [definition] = variable.defs;
	if (!definition) return false;

	return definition.type === DefinitionType.ClassName;
}

function shouldReportIdentifierAsProperty(identifier: TSESTree.Identifier): boolean {
	const { parent } = identifier;
	if (!parent) return false;

	if (
		parent.type === AST_NODE_TYPES.MemberExpression &&
		parent.property === identifier &&
		!parent.computed &&
		parent.parent?.type === AST_NODE_TYPES.AssignmentExpression &&
		parent.parent.left === parent
	) {
		return true;
	}

	if (
		parent.type === AST_NODE_TYPES.Property &&
		parent.key === identifier &&
		!parent.computed &&
		!parent.shorthand &&
		parent.parent?.type === AST_NODE_TYPES.ObjectExpression
	) {
		return true;
	}

	if (
		parent.type === AST_NODE_TYPES.ExportSpecifier &&
		parent.exported === identifier &&
		parent.local !== identifier
	) {
		return true;
	}

	if (
		(parent.type === AST_NODE_TYPES.MethodDefinition || parent.type === AST_NODE_TYPES.PropertyDefinition) &&
		parent.key === identifier &&
		!parent.computed
	) {
		return true;
	}

	return false;
}

function isObjectPropertyKey(identifier: TSESTree.Identifier): boolean {
	const { parent } = identifier;
	return Boolean(
		parent &&
		parent.type === AST_NODE_TYPES.Property &&
		parent.key === identifier &&
		!parent.computed &&
		!parent.shorthand &&
		parent.parent?.type === AST_NODE_TYPES.ObjectExpression,
	);
}

function getImportSource(definition: TSESLint.Scope.Definition): string | undefined {
	if (definition.type === DefinitionType.ImportBinding) {
		const parent = definition.parent ?? undefined;
		if (parent && isImportDeclaration(parent)) {
			const { source } = parent;
			if (isStringLiteral(source)) return source.value;
		}
	}

	if (definition.type === DefinitionType.Variable) {
		const node = definition.node ?? undefined;
		if (isVariableDeclarator(node)) {
			const initializer = node.init ?? undefined;
			if (isStaticRequire(initializer)) {
				const [argument] = initializer.arguments;
				if (argument && isStringLiteral(argument)) return argument.value;
			}
		}
	}

	return undefined;
}

function isInternalImport(definition: TSESLint.Scope.Definition): boolean {
	const source = getImportSource(definition);
	if (!source) return false;

	return !source.includes("node_modules") && (source.startsWith(".") || source.startsWith("/"));
}

function shouldCheckImport(option: ImportCheckOption, definition: TSESLint.Scope.Definition): boolean {
	if (option === false) return false;

	if (option === "internal") return isInternalImport(definition);

	return true;
}

function isVueTemplateReference(reference: TSESLint.Scope.Reference): boolean {
	return Reflect.get(reference, "vueUsedInTemplate") === true;
}

export default createRule<Options, MessageIds>({
	create(context) {
		const options = prepareOptions(context.options[0]);
		const filenameWithExtension = context.physicalFilename;

		const identifierToOuterClassVariable = new WeakMap<TSESTree.Identifier, TSESLint.Scope.Variable>();
		const scopeToNamesGeneratedByFixer = new WeakMap<TSESLint.Scope.Scope, Set<string>>();

		const isSafeGeneratedName: IsSafe = (name, scopes) =>
			scopes.every((scope) => {
				const generatedNames = scopeToNamesGeneratedByFixer.get(scope);
				return !generatedNames?.has(name);
			});

		function checkVariable(variable: VariableLike): void {
			if (variable.defs.length === 0) return;

			const [definition] = variable.defs;
			if (!definition) return;

			const definitionName = definition.name;
			if (!isIdentifier(definitionName)) return;

			if (
				isDefaultOrNamespaceImportName(definitionName) &&
				!shouldCheckImport(options.checkDefaultAndNamespaceImports, definition)
			) {
				return;
			}

			if (
				isShorthandImportLocal(definitionName) &&
				!shouldCheckImport(options.checkShorthandImports, definition)
			) {
				return;
			}

			if (!options.checkShorthandProperties && isShorthandPropertyValue(definitionName)) return;

			const avoidArgumentsReplacement =
				definition.type === DefinitionType.Variable &&
				definition.node &&
				definition.node.type === AST_NODE_TYPES.VariableDeclarator &&
				!definition.node.init;
			const avoidArgumentsInArrowParam =
				definition.type === DefinitionType.Parameter &&
				variable.scope.type === ScopeType.function &&
				variable.scope.block.type === AST_NODE_TYPES.ArrowFunctionExpression;
			const shouldAvoidArguments = avoidArgumentsReplacement || avoidArgumentsInArrowParam;

			const isSafeNameForVariable: IsSafe = (name, scopes) => {
				if (!isSafeGeneratedName(name, scopes)) return false;
				if (shouldAvoidArguments && name === "arguments") return false;
				return true;
			};

			const variableReplacements = getNameReplacements(variable.name, options);
			if (variableReplacements.total === 0 || !variableReplacements.samples) return;

			const { references } = variable;
			const scopes = [...references.map((reference) => reference.from), variable.scope];
			let droppedDiscouraged = 0;
			const safeSamples = variableReplacements.samples
				.map((name) => {
					const safeName = getAvailableVariableName(name, scopes, isSafeNameForVariable);
					if (!safeName) return undefined;

					if (safeName !== name && isDiscouragedReplacementName(name, options)) {
						droppedDiscouraged += 1;
						return undefined;
					}
					return safeName;
				})
				.filter((name): name is string => typeof name === "string" && name.length > 0);

			const baseSamples = safeSamples.length > 0 ? safeSamples : variableReplacements.samples;
			const hasCompleteSamples =
				typeof variableReplacements.samples?.length === "number" &&
				variableReplacements.samples.length === variableReplacements.total;
			const effectiveTotal = hasCompleteSamples
				? Math.max(0, variableReplacements.total - droppedDiscouraged)
				: variableReplacements.total;
			const messageSamples =
				variable.name === "fn" && effectiveTotal > 1
					? baseSamples.map((name) => (name === "function_" ? "function" : name))
					: baseSamples;

			const message = getMessage(
				definitionName.name,
				{ samples: messageSamples, total: effectiveTotal },
				"variable",
			);

			let fix: TSESLint.ReportFixFunction | undefined;

			if (
				effectiveTotal === 1 &&
				safeSamples.length === 1 &&
				shouldFix(variable) &&
				safeSamples[0] &&
				!references.some((ref) => isVueTemplateReference(ref))
			) {
				const [replacement] = safeSamples;

				for (const scope of scopes) {
					if (!scopeToNamesGeneratedByFixer.has(scope)) scopeToNamesGeneratedByFixer.set(scope, new Set());
					const generatedNames = scopeToNamesGeneratedByFixer.get(scope);
					generatedNames?.add(replacement);
				}

				fix = (fixer: TSESLint.RuleFixer): ReadonlyArray<TSESLint.RuleFix> =>
					renameVariable(variable, replacement, fixer);
			}

			if (fix) {
				context.report({
					...message,
					fix,
					node: definitionName,
				});
				return;
			}

			context.report({
				...message,
				node: definitionName,
			});
		}

		function checkPossiblyWeirdClassVariable(variable: TSESLint.Scope.Variable): void {
			if (!isClassVariable(variable)) {
				checkVariable(variable);
				return;
			}

			if (variable.scope.type === ScopeType.class) {
				const [definition] = variable.defs;
				if (!definition) {
					checkVariable(variable);
					return;
				}
				const definitionName = definition.name;
				if (!isIdentifier(definitionName)) {
					checkVariable(variable);
					return;
				}

				const outerClassVariable = identifierToOuterClassVariable.get(definitionName);
				if (!outerClassVariable) {
					checkVariable(variable);
					return;
				}

				const combinedVariable: VariableLike = {
					defs: variable.defs,
					identifiers: variable.identifiers,
					name: variable.name,
					references: [...variable.references, ...outerClassVariable.references],
					scope: variable.scope,
				};
				checkVariable(combinedVariable);
				return;
			}

			const [definition] = variable.defs;
			if (!definition) return;

			const definitionName = definition.name;
			if (!isIdentifier(definitionName)) return;

			identifierToOuterClassVariable.set(definitionName, variable);
		}

		function checkScope(scope: TSESLint.Scope.Scope): void {
			for (const scopeItem of getScopes(scope)) {
				for (const variable of scopeItem.variables) {
					checkPossiblyWeirdClassVariable(variable);
				}
			}
		}

		return {
			Identifier(node): void {
				if (!options.checkProperties || node.name === "__proto__") return;

				const replacements = getNameReplacements(node.name, options);
				if (replacements.total === 0 || !shouldReportIdentifierAsProperty(node)) return;

				const message = getMessage(node.name, replacements, "property");
				let fix: TSESLint.ReportFixFunction | undefined;

				if (replacements.total === 1 && replacements.samples && isObjectPropertyKey(node)) {
					const [replacement] = replacements.samples;
					const property = node.parent;
					if (
						replacement &&
						property &&
						property.type === AST_NODE_TYPES.Property &&
						isStringLiteral(property.value) &&
						isValidIdentifier(replacement)
					) {
						fix = (fixer: TSESLint.RuleFixer): TSESLint.RuleFix => fixer.replaceText(node, replacement);
					}
				}

				context.report({
					...message,
					...(fix ? { fix } : {}),
					node,
				});
			},
			JSXOpeningElement(node): void {
				if (
					!options.checkVariables ||
					node.name.type !== AST_NODE_TYPES.JSXIdentifier ||
					!isUpperFirst(node.name.name)
				) {
					return;
				}

				const replacements = getNameReplacements(node.name.name, options);
				if (replacements.total === 0) return;

				const message = getMessage(node.name.name, replacements, "variable");
				context.report({
					...message,
					node: node.name,
				});
			},
			Program(node): void {
				if (options.checkVariables && node.body.length === 0 && context.sourceCode.getText().length === 0) {
					context.report({
						data: {
							discouragedName: "empty",
							nameTypeText: "variable",
							replacementsText: "`empty`",
						},
						messageId: MESSAGE_ID_SUGGESTION,
						node,
					});
					return;
				}

				if (
					!options.checkFilenames ||
					filenameWithExtension === "<input>" ||
					filenameWithExtension === "<text>"
				) {
					return;
				}

				const filename = path.basename(filenameWithExtension);
				const extension = path.extname(filename);
				const filenameReplacements = getNameReplacements(path.basename(filename, extension), options);
				if (filenameReplacements.total === 0 || !filenameReplacements.samples) return;

				const samples = filenameReplacements.samples.map((replacement) => `${replacement}${extension}`);
				context.report({
					...getMessage(filename, { samples, total: filenameReplacements.total }, "filename"),
					node,
				});
			},
			"Program:exit"(program): void {
				if (!options.checkVariables) return;

				checkScope(context.sourceCode.getScope(program));
			},
		};
	},
	defaultOptions: [{}],
	meta: {
		defaultOptions: [{}],
		docs: {
			description: "Prevent abbreviations.",
		},
		fixable: "code",
		messages,
		schema,
		type: "suggestion",
	},
	name: "prevent-abbreviations",
});
