import { AST_NODE_TYPES, ESLintUtils } from "@typescript-eslint/utils";
import { TypeFlags } from "typescript";

import { PredefinedFormatToCheckFunction } from "./format";
import { selectorTypeToMessageString } from "./shared";

import type { TSESTree } from "@typescript-eslint/utils";
import type { Symbol as TsSymbol, Type, TypeChecker } from "typescript";

import type { ModifiersString, SelectorsString } from "./enums";
import type { Context, NormalizedSelector, TypeReference, ValidatorFunction } from "./types";

interface ParserServicesWithTypeInformation {
	getTypeAtLocation: (node: TSESTree.Node) => Type;
	program: {
		getTypeChecker: () => TypeChecker;
	};
}

interface TypeInfo {
	checker: TypeChecker;
	services: ParserServicesWithTypeInformation;
}

function hasTypeInformation(services: unknown): services is ParserServicesWithTypeInformation {
	if (!services || typeof services !== "object") return false;

	const getTypeAtLocation: unknown = Reflect.get(services, "getTypeAtLocation");
	if (typeof getTypeAtLocation !== "function") return false;

	const program: unknown = Reflect.get(services, "program");
	if (!program || typeof program !== "object") return false;

	const getTypeChecker: unknown = Reflect.get(program, "getTypeChecker");
	return typeof getTypeChecker === "function";
}

export function createValidator(
	type: SelectorsString,
	context: Context,
	allConfigs: Array<NormalizedSelector>,
): ValidatorFunction {
	const configs = allConfigs.toSorted((first, second) => {
		if (first.selectorPriority !== second.selectorPriority) return second.selectorPriority - first.selectorPriority;
		if (first.modifierWeight !== second.modifierWeight) return second.modifierWeight - first.modifierWeight;
		return 0;
	});

	const hasTypeOptions = configs.some((config) => (config.types?.length ?? 0) > 0);
	let typeInfo: TypeInfo | undefined;

	function getTypeInfo(): TypeInfo | undefined {
		if (!hasTypeOptions) return undefined;
		if (typeInfo) return typeInfo;

		const services = ESLintUtils.getParserServices(context, true);
		if (!hasTypeInformation(services)) return undefined;

		const { program } = services;
		if (!program) return undefined;

		typeInfo = {
			checker: program.getTypeChecker(),
			services,
		};

		return typeInfo;
	}

	return (node, modifiers = new Set<ModifiersString>()): void => {
		const originalName =
			node.type === AST_NODE_TYPES.Identifier || node.type === AST_NODE_TYPES.PrivateIdentifier
				? node.name
				: `${node.value}`;

		for (const config of configs) {
			if (config.filter && config.filter.regex.test(originalName) !== config.filter.match) continue;
			if (modifiers.has("requiresQuotes") && !config.modifiers?.includes("requiresQuotes")) continue;
			if (config.modifiers?.some((modifier) => !modifiers.has(modifier))) continue;
			if (!isCorrectType(node, config, type, getTypeInfo)) continue;

			let name: string | undefined = originalName;

			name = validateUnderscore("leading", config, name, node, originalName, context, type);
			if (name === undefined) return;

			name = validateUnderscore("trailing", config, name, node, originalName, context, type);
			if (name === undefined) return;

			name = validateAffix("prefix", config, name, node, originalName, context, type);
			if (name === undefined) return;

			name = validateAffix("suffix", config, name, node, originalName, context, type);
			if (name === undefined) return;
			if (!validateCustom(config, name, node, originalName, context, type)) return;
			if (!validatePredefinedFormat(config, name, node, originalName, context, type, modifiers)) return;

			return;
		}
	};
}

function formatReportData(
	selectorType: SelectorsString,
	options: {
		affixes?: Array<string>;
		count?: "one" | "two";
		custom?: NormalizedSelector["custom"];
		formats?: Array<string>;
		originalName: string;
		position?: "leading" | "prefix" | "suffix" | "trailing";
		processedName?: string;
	},
): Record<string, unknown> {
	return {
		affixes: options.affixes?.join(", "),
		count: options.count,
		formats: options.formats?.join(", "),
		name: options.originalName,
		position: options.position,
		processedName: options.processedName,
		regex: options.custom?.regex.toString(),
		regexMatch:
			options.custom?.match === true ? "match" : options.custom?.match === false ? "not match" : undefined,
		type: selectorTypeToMessageString(selectorType),
	};
}

function validateUnderscore(
	position: "leading" | "trailing",
	config: NormalizedSelector,
	name: string,
	node: TSESTree.Identifier | TSESTree.Literal | TSESTree.PrivateIdentifier,
	originalName: string,
	context: Context,
	selectorType: SelectorsString,
): string | undefined {
	const option = position === "leading" ? config.leadingUnderscore : config.trailingUnderscore;
	if (option === undefined) {
		return name;
	}

	const hasSingleUnderscore = position === "leading" ? name.startsWith("_") : name.endsWith("_");
	const trimmedSingleUnderscore = position === "leading" ? name.slice(1) : name.slice(0, -1);

	const hasDoubleUnderscore = position === "leading" ? name.startsWith("__") : name.endsWith("__");
	const trimmedDoubleUnderscore = position === "leading" ? name.slice(2) : name.slice(0, -2);

	switch (option) {
		case "allow": {
			if (hasSingleUnderscore) return trimmedSingleUnderscore;
			return name;
		}
		case "allowDouble": {
			if (hasDoubleUnderscore) return trimmedDoubleUnderscore;
			return name;
		}
		case "allowSingleOrDouble": {
			if (hasDoubleUnderscore) return trimmedDoubleUnderscore;
			if (hasSingleUnderscore) return trimmedSingleUnderscore;
			return name;
		}
		case "forbid": {
			if (hasSingleUnderscore) {
				context.report({
					data: formatReportData(selectorType, { count: "one", originalName, position }),
					messageId: "unexpectedUnderscore",
					node,
				});
				return undefined;
			}
			return name;
		}
		case "require": {
			if (!hasSingleUnderscore) {
				context.report({
					data: formatReportData(selectorType, { count: "one", originalName, position }),
					messageId: "missingUnderscore",
					node,
				});
				return undefined;
			}
			return trimmedSingleUnderscore;
		}
		case "requireDouble": {
			if (!hasDoubleUnderscore) {
				context.report({
					data: formatReportData(selectorType, { count: "two", originalName, position }),
					messageId: "missingUnderscore",
					node,
				});
				return undefined;
			}
			return trimmedDoubleUnderscore;
		}
	}
}

function validateAffix(
	position: "prefix" | "suffix",
	config: NormalizedSelector,
	name: string,
	node: TSESTree.Identifier | TSESTree.Literal | TSESTree.PrivateIdentifier,
	originalName: string,
	context: Context,
	selectorType: SelectorsString,
): string | undefined {
	const affixes = config[position];
	if (!affixes || affixes.length === 0) return name;

	for (const affix of affixes) {
		const hasAffix = position === "prefix" ? name.startsWith(affix) : name.endsWith(affix);
		if (hasAffix) {
			return position === "prefix" ? name.slice(affix.length) : name.slice(0, -affix.length);
		}
	}

	context.report({
		data: formatReportData(selectorType, { affixes, originalName, position }),
		messageId: "missingAffix",
		node,
	});
	return undefined;
}

function validateCustom(
	config: NormalizedSelector,
	name: string,
	node: TSESTree.Identifier | TSESTree.Literal | TSESTree.PrivateIdentifier,
	originalName: string,
	context: Context,
	selectorType: SelectorsString,
): boolean {
	const { custom } = config;
	if (!custom) return true;

	const result = custom.regex.test(name);
	if (custom.match && result) return true;
	if (!(custom.match || result)) return true;

	context.report({
		data: formatReportData(selectorType, { custom, originalName }),
		messageId: "satisfyCustom",
		node,
	});
	return false;
}

function validatePredefinedFormat(
	config: NormalizedSelector,
	name: string,
	node: TSESTree.Identifier | TSESTree.Literal | TSESTree.PrivateIdentifier,
	originalName: string,
	context: Context,
	selectorType: SelectorsString,
	modifiers: Set<string>,
): boolean {
	const formats = config.format;
	if (!formats || formats.length === 0) return true;

	if (!modifiers.has("requiresQuotes")) {
		for (const format of formats) {
			const checker = PredefinedFormatToCheckFunction[format];
			if (checker?.(name)) return true;
		}
	}

	context.report({
		data: formatReportData(selectorType, { formats, originalName, processedName: name }),
		messageId: originalName === name ? "doesNotMatchFormat" : "doesNotMatchFormatTrimmed",
		node,
	});
	return false;
}

const selectorsAllowedToHaveTypes = new Set<SelectorsString>([
	"variable",
	"parameter",
	"classProperty",
	"objectLiteralProperty",
	"typeProperty",
	"parameterProperty",
	"classicAccessor",
]);

function isCorrectType(
	node: TSESTree.Node,
	config: NormalizedSelector,
	selector: SelectorsString,
	getTypeInfo: () => TypeInfo | undefined,
): boolean {
	if (!config.types || config.types.length === 0 || !selectorsAllowedToHaveTypes.has(selector)) return true;

	const typeInfo = getTypeInfo();
	if (!typeInfo) return true;

	const { checker, services } = typeInfo;
	const type = services.getTypeAtLocation(node).getNonNullableType();

	const predicates: Array<(innerType: Type) => boolean> = [];
	for (const allowedType of config.types) {
		if (typeof allowedType === "object") {
			predicates.push((innerType) => matchesTypeReference(innerType, allowedType));
			continue;
		}

		switch (allowedType) {
			case "array": {
				predicates.push((innerType) => isArrayLikeType(checker, innerType));
				break;
			}

			case "function": {
				predicates.push((innerType) => innerType.getCallSignatures().length > 0);
				break;
			}

			case "boolean":
			case "number":
			case "string": {
				predicates.push((innerType) => {
					const typeString = checker.typeToString(
						checker.getWidenedType(checker.getBaseTypeOfLiteralType(innerType)),
					);
					return typeString === allowedType;
				});
				break;
			}
		}
	}

	return isAllTypesMatch(type, (innerType) => predicates.some((predicate) => predicate(innerType)));
}

function matchesTypeReference(type: Type, reference: TypeReference): boolean {
	if (isAnyType(type)) return false;
	if (symbolMatchesTypeReference(type.aliasSymbol, reference)) return true;
	if (symbolMatchesTypeReference(type.symbol, reference)) return true;

	if (type.isIntersection() || type.isUnion()) {
		for (const innerType of type.types) {
			if (matchesTypeReference(innerType, reference)) return true;
		}
	}

	return false;
}

function symbolMatchesTypeReference(symbol: TsSymbol | undefined, reference: TypeReference): boolean {
	if (!symbol || symbol.name !== reference.name) return false;
	if (reference.from === undefined) return true;

	const { declarations } = symbol;
	if (!declarations || declarations.length === 0) return false;

	for (const declaration of declarations) {
		const { fileName } = declaration.getSourceFile();
		if (moduleSpecifierMatches(fileName, reference.from)) return true;
	}

	return false;
}

/**
 * Checks whether a declaration's source file matches a module specifier.
 *
 * Two specifier shapes are supported:
 *
 * 1. **Bare package specifier** (e.g. `"@rbxts/jecs"`, `"lodash"`) — matches when the
 *    declaration's file path contains `/node_modules/<specifier>/` as a substring.
 *    Handles flat and pnpm-style layouts (pnpm paths still contain a final
 *    `/node_modules/<specifier>/` segment after the virtual store directory).
 *    **Not** supported: Yarn Plug'n'Play (no `node_modules` on disk), vendored
 *    packages outside `node_modules`, or types provided by separate `@types/*`
 *    packages.
 *
 * 2. **Path specifier** (starts with `.`, `/`, or a Windows drive letter) — matches
 *    against the normalized declaration path with `.d.ts` / `.tsx?` stripped.
 *    Windows absolute paths require exact equality. POSIX-style absolute or
 *    relative paths are normalized to a bare tail and matched as a suffix; this
 *    means `"./shared/network"` matches a declaration at `<root>/shared/network.ts`.
 */
const BACKSLASH_PATTERN = /\\/gu;
const TYPESCRIPT_EXTENSION_PATTERN = /\.d\.ts$|\.tsx?$/u;
const WINDOWS_DRIVE_PATTERN = /^[A-Za-z]:\//u;
const LEADING_DOT_SLASH_OR_SLASH_PATTERN = /^(\.\/|\/)/u;

function moduleSpecifierMatches(declarationFile: string, specifier: string): boolean {
	const normalizedFile = declarationFile.replace(BACKSLASH_PATTERN, "/");
	const normalizedSpecifier = specifier.replace(BACKSLASH_PATTERN, "/");

	if (looksLikePath(normalizedSpecifier)) {
		const stripped = normalizedFile.replace(TYPESCRIPT_EXTENSION_PATTERN, "");
		if (WINDOWS_DRIVE_PATTERN.test(normalizedSpecifier)) return stripped === normalizedSpecifier;

		const tail = normalizedSpecifier.replace(LEADING_DOT_SLASH_OR_SLASH_PATTERN, "");
		if (stripped === tail) return true;
		return stripped.endsWith(`/${tail}`);
	}

	return normalizedFile.includes(`/node_modules/${normalizedSpecifier}/`);
}

/**
 * Path-form specifiers start with `.`, `/`, or a Windows drive letter (e.g. `C:/`).
 *
 * @param specifier - the module specifier to classify
 * @returns true if the specifier should be treated as a filesystem path rather than a package name
 */
function looksLikePath(specifier: string): boolean {
	if (specifier.startsWith(".")) return true;
	if (specifier.startsWith("/")) return true;
	return WINDOWS_DRIVE_PATTERN.test(specifier);
}

function isAllTypesMatch(type: Type, callback: (innerType: Type) => boolean): boolean {
	if (type.isUnion()) return type.types.every((innerType) => callback(innerType));
	return callback(type);
}

function isArrayLikeType(checker: TypeChecker, type: Type): boolean {
	if (isAnyType(type) || isStringLikeType(type)) return false;

	if (checker.isArrayType(type) || checker.isTupleType(type)) return true;

	return checker.isArrayLikeType(type);
}

function isAnyType(type: Type): boolean {
	return (type.flags & TypeFlags.Any) !== 0;
}

function isStringLikeType(type: Type): boolean {
	return (type.flags & TypeFlags.StringLike) !== 0;
}
