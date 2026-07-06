import { createRule } from "$utilities/create-rule";
import { getContextualTypeForExpressionNode } from "$utilities/typescript-node-utilities";
import { AST_NODE_TYPES, ESLintUtils } from "@typescript-eslint/utils";
import { isUnionType, unionConstituents } from "ts-api-utils";

import type { EnumValueLookup } from "$utilities/enum-utilities";
import type { TSESTree } from "@typescript-eslint/utils";
import type { Type, TypeChecker } from "typescript";

type MessageIds = "preferEnumItem";

function isJSXAttributeValue(node: TSESTree.Literal): boolean {
	const { parent } = node;
	return parent !== undefined && parent.type === AST_NODE_TYPES.JSXAttribute && parent.value === node;
}

function canHaveContextualEnumType(node: TSESTree.Literal): boolean {
	const { parent } = node;

	switch (parent.type) {
		case AST_NODE_TYPES.CallExpression:
		case AST_NODE_TYPES.NewExpression:
			return parent.arguments.includes(node);

		case AST_NODE_TYPES.Property:
			return parent.value === node;

		case AST_NODE_TYPES.JSXAttribute:
			return parent.value === node;

		case AST_NODE_TYPES.VariableDeclarator: {
			const { id } = parent;
			return parent.init === node && id.type === AST_NODE_TYPES.Identifier && id.typeAnnotation !== undefined;
		}

		default:
			return false;
	}
}

interface EnumMatch {
	readonly enumPath: string;
}

interface EnumItemInfo {
	readonly enumPath: string;
	readonly nameLiteral?: string;
	readonly valueLiteral?: number;
}

export interface PreferEnumItemOptions {
	readonly fixNumericToValue?: boolean;
	readonly performanceMode?: boolean;
}

type Options = [PreferEnumItemOptions?];

const ENUM_PREFIX = "Enum.";
const NESTED_ENUM_PREFIX = `.${ENUM_PREFIX}`;

interface EnumItemCaches {
	readonly enumLookupCache: WeakMap<Type, EnumValueLookup | false>;
}

function createEnumItemCaches(): EnumItemCaches {
	return {
		enumLookupCache: new WeakMap<Type, EnumValueLookup | false>(),
	};
}

function getFullEnumPath(checker: TypeChecker, type: Type): string | undefined {
	const symbol = type.getSymbol();
	if (symbol === undefined) return undefined;

	const fullName = checker.getFullyQualifiedName(symbol);
	if (fullName.startsWith(ENUM_PREFIX)) return fullName;

	const enumStart = fullName.indexOf(NESTED_ENUM_PREFIX);
	if (enumStart === -1) return undefined;

	return fullName.slice(enumStart + 1);
}

function getPropertyLiteralType(
	checker: TypeChecker,
	type: Type,
	propertyName: "Name" | "Value",
): string | number | undefined {
	const property = type.getProperty(propertyName);
	if (property === undefined) return undefined;

	const propertyType = checker.getTypeOfSymbol(property);
	if (propertyType.isStringLiteral()) return propertyType.value;
	if (propertyType.isNumberLiteral()) return propertyType.value;

	return undefined;
}

function getUnionTypesCached(type: Type): ReadonlyArray<Type> {
	const constituents = isUnionType(type) ? unionConstituents(type) : undefined;
	return constituents && constituents.length > 0 ? constituents : [type];
}

function createEnumMatch(enumPath: string): EnumMatch {
	return { enumPath };
}

const preferEnumItem = createRule<Options, MessageIds>({
	create(context) {
		const [{ fixNumericToValue = false, performanceMode = true } = {}] = context.options;
		const services = ESLintUtils.getParserServices(context);
		const checker = services.program.getTypeChecker();
		const { enumLookupCache } = createEnumItemCaches();

		function getEnumItemInfo(type: Type): EnumItemInfo | undefined {
			const enumPath = getFullEnumPath(checker, type);
			if (enumPath === undefined) return undefined;

			const nameLiteral = getPropertyLiteralType(checker, type, "Name");
			const valueLiteral = getPropertyLiteralType(checker, type, "Value");
			const info: EnumItemInfo = {
				enumPath,
				...(typeof nameLiteral === "string" ? { nameLiteral } : {}),
				...(typeof valueLiteral === "number" ? { valueLiteral } : {}),
			};
			return info;
		}

		function getEnumLookup(type: Type): EnumValueLookup | undefined {
			const cached = enumLookupCache.get(type);
			if (cached !== undefined) return cached === false ? undefined : cached;

			const unionTypes = getUnionTypesCached(type);
			const stringMap = new Map<string, string>();
			const numberMap = new Map<number, string>();
			let hasAny = false;

			for (const memberType of unionTypes) {
				const info = getEnumItemInfo(memberType);
				if (info === undefined) continue;
				hasAny = true;

				if (info.nameLiteral !== undefined && !stringMap.has(info.nameLiteral)) {
					stringMap.set(info.nameLiteral, info.enumPath);
				}

				if (info.valueLiteral !== undefined && !numberMap.has(info.valueLiteral)) {
					numberMap.set(info.valueLiteral, info.enumPath);
				}
			}

			if (!hasAny) {
				enumLookupCache.set(type, false);
				return undefined;
			}

			const lookup: EnumValueLookup = { numberMap, stringMap };
			enumLookupCache.set(type, lookup);
			return lookup;
		}

		function getContextualType(node: TSESTree.Node): Type | undefined {
			const tsNode = services.esTreeNodeToTSNodeMap.get(node);
			return getContextualTypeForExpressionNode(checker, tsNode);
		}

		function findPerformanceEnumMatch(contextualType: Type, literalValue: string | number): EnumMatch | undefined {
			const lookup = getEnumLookup(contextualType);
			if (lookup === undefined) return undefined;

			const enumPath =
				typeof literalValue === "string"
					? lookup.stringMap.get(literalValue)
					: lookup.numberMap.get(literalValue);
			return enumPath === undefined ? undefined : createEnumMatch(enumPath);
		}

		function literalMatchesEnumMember(memberType: Type, literalValue: string | number): boolean {
			if (typeof literalValue === "string") {
				return getPropertyLiteralType(checker, memberType, "Name") === literalValue;
			}

			return getPropertyLiteralType(checker, memberType, "Value") === literalValue;
		}

		function findExhaustiveEnumMatch(contextualType: Type, literalValue: string | number): EnumMatch | undefined {
			for (const memberType of getUnionTypesCached(contextualType)) {
				const enumPath = getFullEnumPath(checker, memberType);
				if (enumPath === undefined) continue;
				if (literalMatchesEnumMember(memberType, literalValue)) return createEnumMatch(enumPath);
			}

			return undefined;
		}

		function findEnumMatch(contextualType: Type, literalValue: string | number): EnumMatch | undefined {
			if (performanceMode) return findPerformanceEnumMatch(contextualType, literalValue);
			return findExhaustiveEnumMatch(contextualType, literalValue);
		}

		return {
			Literal(node): void {
				const { value } = node;
				if (typeof value !== "string" && typeof value !== "number") return;

				if (!canHaveContextualEnumType(node)) return;

				const contextualType = getContextualType(node);
				if (contextualType === undefined) return;

				const match = findEnumMatch(contextualType, value);
				if (match === undefined) return;

				const isString = typeof value === "string";
				const displayValue = isString ? `"${value}"` : String(value);
				const fixPath = fixNumericToValue && !isString ? `${match.enumPath}.Value` : match.enumPath;

				const needsJSXBraces = isJSXAttributeValue(node);
				const fixText = needsJSXBraces ? `{${fixPath}}` : fixPath;

				context.report({
					data: {
						enumType: match.enumPath.split(".").slice(0, -1).join("."),
						expected: fixPath,
						value: displayValue,
					},
					fix(fixer) {
						return fixer.replaceText(node, fixText);
					},
					messageId: "preferEnumItem",
					node,
				});
			},
		};
	},
	meta: {
		defaultOptions: [{ fixNumericToValue: false, performanceMode: true }],
		docs: {
			description: "Enforce using EnumItem values instead of string or number literals.",
		},
		fixable: "code",
		messages: {
			preferEnumItem:
				"Use `{{ expected }}` instead of `{{ value }}`. EnumItems provide type safety and avoid magic values.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					fixNumericToValue: {
						default: false,
						description: "When true, numeric literals fix to Enum.X.Y.Value instead of Enum.X.Y",
						type: "boolean",
					},
					performanceMode: {
						default: true,
						description: "When true, uses caching to speed up enum lookups without changing behavior",
						type: "boolean",
					},
				},
				type: "object",
			},
		],
		type: "suggestion",
	},
	name: "prefer-enum-item",
});

export default preferEnumItem;
