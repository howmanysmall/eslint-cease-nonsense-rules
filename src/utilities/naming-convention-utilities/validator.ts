import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES, ESLintUtils } from "@typescript-eslint/utils";
import type { Type, TypeChecker } from "typescript";

import type { ModifiersString, SelectorsString } from "./enums";
import { TypeModifiers } from "./enums";
import { PredefinedFormatToCheckFunction } from "./format";
import { selectorTypeToMessageString } from "./shared";
import type { Context, NormalizedSelector, ValidatorFunction } from "./types";

interface ParserServicesWithTypeInformation {
	program: {
		getTypeChecker: () => TypeChecker;
	};
	getTypeAtLocation: (node: TSESTree.Node) => Type;
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

	const hasSingleUnderscore =
		position === "leading" ? (): boolean => name.startsWith("_") : (): boolean => name.endsWith("_");
	const trimSingleUnderscore = position === "leading" ? (): string => name.slice(1) : (): string => name.slice(0, -1);

	const hasDoubleUnderscore =
		position === "leading" ? (): boolean => name.startsWith("__") : (): boolean => name.endsWith("__");
	const trimDoubleUnderscore = position === "leading" ? (): string => name.slice(2) : (): string => name.slice(0, -2);

	switch (option) {
		case "allow": {
			if (hasSingleUnderscore()) return trimSingleUnderscore();
			return name;
		}
		case "allowDouble": {
			if (hasDoubleUnderscore()) return trimDoubleUnderscore();
			return name;
		}
		case "allowSingleOrDouble": {
			if (hasDoubleUnderscore()) return trimDoubleUnderscore();
			if (hasSingleUnderscore()) return trimSingleUnderscore();
			return name;
		}
		case "forbid": {
			if (hasSingleUnderscore()) {
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
			if (!hasSingleUnderscore()) {
				context.report({
					data: formatReportData(selectorType, { count: "one", originalName, position }),
					messageId: "missingUnderscore",
					node,
				});
				return undefined;
			}
			return trimSingleUnderscore();
		}
		case "requireDouble": {
			if (!hasDoubleUnderscore()) {
				context.report({
					data: formatReportData(selectorType, { count: "two", originalName, position }),
					messageId: "missingUnderscore",
					node,
				});
				return undefined;
			}
			return trimDoubleUnderscore();
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
		const trimAffix =
			position === "prefix" ? (): string => name.slice(affix.length) : (): string => name.slice(0, -affix.length);

		if (hasAffix) return trimAffix();
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

	for (const allowedType of config.types) {
		switch (allowedType) {
			case TypeModifiers.array:
				if (
					isAllTypesMatch(
						type,
						(innerType) => checker.isArrayType(innerType) || checker.isTupleType(innerType),
					)
				) {
					return true;
				}
				break;
			case TypeModifiers.function:
				if (isAllTypesMatch(type, (innerType) => innerType.getCallSignatures().length > 0)) return true;
				break;
			case TypeModifiers.boolean:
			case TypeModifiers.number:
			case TypeModifiers.string: {
				const typeString = checker.typeToString(checker.getWidenedType(checker.getBaseTypeOfLiteralType(type)));
				if (typeString === allowedType) return true;

				break;
			}
		}
	}

	return false;
}

function isAllTypesMatch(type: Type, callback: (innerType: Type) => boolean): boolean {
	if (type.isUnion()) return type.types.every((innerType) => callback(innerType));
	return callback(type);
}
