import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES, ESLintUtils } from "@typescript-eslint/utils";
import { isUnionType, unionConstituents } from "ts-api-utils";
import type { Expression, Type, TypeChecker, Node as TypeScriptNode, Symbol as TypeScriptSymbol } from "typescript";
import { SymbolFlags } from "typescript";
import { createRule } from "../utilities/create-rule";

type MessageIds = "preferEnumItem";

function isJSXAttributeValue(node: TSESTree.Literal): boolean {
	const { parent } = node;
	return parent !== undefined && parent.type === AST_NODE_TYPES.JSXAttribute && parent.value === node;
}

function canHaveContextualEnumType(node: TSESTree.Literal): boolean {
	const { parent } = node;
	if (parent === undefined) return false;

	switch (parent.type) {
		case AST_NODE_TYPES.CallExpression:
		case AST_NODE_TYPES.NewExpression:
			return parent.arguments.includes(node);

		case AST_NODE_TYPES.Property:
			return parent.value === node;

		case AST_NODE_TYPES.JSXAttribute:
			return parent.value === node;

		case AST_NODE_TYPES.VariableDeclarator: {
			if (parent.init !== node) return false;
			const { id } = parent;
			return id.type === AST_NODE_TYPES.Identifier && id.typeAnnotation !== undefined;
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

interface EnumLookup {
	readonly stringMap: Map<string, string>;
	readonly numberMap: Map<number, string>;
}

interface EnumLiteralIndex {
	readonly stringSet: Set<string>;
	readonly numberSet: Set<number>;
}

export interface PreferEnumItemOptions {
	readonly fixNumericToValue?: boolean;
	readonly performanceMode?: boolean;
}

type Options = [PreferEnumItemOptions?];

const ENUM_PREFIX = "Enum.";
const enumLiteralIndexCache = new WeakMap<TypeChecker, EnumLiteralIndex | false>();

function getFullEnumPath(checker: TypeChecker, type: Type): string | undefined {
	const symbol = type.getSymbol();
	if (symbol === undefined) return undefined;

	const fullName = checker.getFullyQualifiedName(symbol);
	if (!fullName.startsWith(ENUM_PREFIX)) return undefined;

	return fullName;
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

function getUnionTypes(type: Type): ReadonlyArray<Type> {
	if (isUnionType(type)) return unionConstituents(type);
	return [type];
}

function createEnumMatch(enumPath: string): EnumMatch {
	return { enumPath };
}

export default createRule<Options, MessageIds>({
	create(context) {
		const [{ fixNumericToValue = false, performanceMode = false } = {}] = context.options;
		const services = ESLintUtils.getParserServices(context);
		const checker = services.program.getTypeChecker();
		const unionTypesCache = new WeakMap<Type, ReadonlyArray<Type>>();
		const enumPathCache = new WeakMap<Type, string | false>();
		const enumItemInfoCache = new WeakMap<Type, EnumItemInfo | false>();
		const enumLookupCache = new WeakMap<Type, EnumLookup | false>();
		const contextualTypeCache = new WeakMap<TSESTree.Node, Type | false>();

		function getUnionTypesCached(type: Type): ReadonlyArray<Type> {
			const cached = unionTypesCache.get(type);
			if (cached !== undefined) return cached;
			const resolved = isUnionType(type) ? unionConstituents(type) : [type];
			unionTypesCache.set(type, resolved);
			return resolved;
		}

		function getFullEnumPathCached(type: Type): string | undefined {
			const cached = enumPathCache.get(type);
			if (cached !== undefined) return cached === false ? undefined : cached;
			const resolved = getFullEnumPath(checker, type);
			enumPathCache.set(type, resolved ?? false);
			return resolved;
		}

		function getEnumItemInfo(type: Type): EnumItemInfo | undefined {
			const cached = enumItemInfoCache.get(type);
			if (cached !== undefined) return cached === false ? undefined : cached;

			const enumPath = getFullEnumPathCached(type);
			if (enumPath === undefined) {
				enumItemInfoCache.set(type, false);
				return undefined;
			}

			const nameLiteral = getPropertyLiteralType(checker, type, "Name");
			const valueLiteral = getPropertyLiteralType(checker, type, "Value");
			const info: EnumItemInfo = {
				enumPath,
				...(typeof nameLiteral === "string" ? { nameLiteral } : {}),
				...(typeof valueLiteral === "number" ? { valueLiteral } : {}),
			};
			enumItemInfoCache.set(type, info);
			return info;
		}

		function getEnumLookup(type: Type): EnumLookup | undefined {
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

			const lookup: EnumLookup = { numberMap, stringMap };
			enumLookupCache.set(type, lookup);
			return lookup;
		}

		function resolveAliasSymbol(symbol: TypeScriptSymbol): TypeScriptSymbol {
			if ((symbol.flags & SymbolFlags.Alias) !== 0) return checker.getAliasedSymbol(symbol);
			return symbol;
		}

		function buildEnumLiteralIndex(anchorNode: TypeScriptNode): EnumLiteralIndex | undefined {
			const resolved = checker.resolveName("Enum", anchorNode, SymbolFlags.Namespace, false);
			if (resolved === undefined) return undefined;

			const enumSymbol = resolveAliasSymbol(resolved);
			if ((enumSymbol.flags & SymbolFlags.Namespace) === 0) return undefined;

			const stringSet = new Set<string>();
			const numberSet = new Set<number>();
			const stack: Array<TypeScriptSymbol> = [enumSymbol];
			const visited = new Set<TypeScriptSymbol>();

			while (stack.length > 0) {
				const current = stack.pop();
				if (current === undefined) continue;
				if (visited.has(current)) continue;
				visited.add(current);

				const exports = checker.getExportsOfModule(current);
				for (const exportSymbol of exports) {
					const unaliased = resolveAliasSymbol(exportSymbol);
					if ((unaliased.flags & SymbolFlags.Namespace) !== 0) {
						stack.push(unaliased);
						continue;
					}

					const type = checker.getTypeOfSymbol(unaliased);
					const info = getEnumItemInfo(type);
					if (info === undefined) continue;
					if (info.nameLiteral !== undefined) stringSet.add(info.nameLiteral);
					if (info.valueLiteral !== undefined) numberSet.add(info.valueLiteral);
				}
			}

			if (stringSet.size === 0 && numberSet.size === 0) return undefined;
			return { numberSet, stringSet };
		}

		function getEnumLiteralIndex(anchorNode: TypeScriptNode): EnumLiteralIndex | undefined {
			const cached = enumLiteralIndexCache.get(checker);
			if (cached !== undefined) return cached === false ? undefined : cached;
			const built = buildEnumLiteralIndex(anchorNode);
			enumLiteralIndexCache.set(checker, built ?? false);
			return built;
		}

		function getContextualType(node: TSESTree.Node): Type | undefined {
			const cached = contextualTypeCache.get(node);
			if (cached !== undefined) return cached === false ? undefined : cached;

			const tsNode = services.esTreeNodeToTSNodeMap.get(node);
			if (tsNode === undefined) {
				contextualTypeCache.set(node, false);
				return undefined;
			}

			const type = checker.getContextualType(tsNode as Expression);
			contextualTypeCache.set(node, type ?? false);
			return type;
		}

		function shouldSkipLiteral(node: TSESTree.Literal, value: string | number): boolean {
			if (!performanceMode) return false;
			const tsNode = services.esTreeNodeToTSNodeMap.get(node);
			if (tsNode === undefined) return false;
			const index = getEnumLiteralIndex(tsNode);
			if (index === undefined) return false;
			if (typeof value === "string") return !index.stringSet.has(value);
			return !index.numberSet.has(value);
		}

		function findEnumMatch(contextualType: Type, literalValue: string | number): EnumMatch | undefined {
			if (performanceMode) {
				const lookup = getEnumLookup(contextualType);
				if (lookup === undefined) return undefined;
				const enumPath =
					typeof literalValue === "string"
						? lookup.stringMap.get(literalValue)
						: lookup.numberMap.get(literalValue);
				return enumPath === undefined ? undefined : createEnumMatch(enumPath);
			}

			const unionTypes = getUnionTypes(contextualType);

			for (const memberType of unionTypes) {
				const enumPath = getFullEnumPath(checker, memberType);
				if (enumPath === undefined) continue;

				if (typeof literalValue === "string") {
					const nameProperty = getPropertyLiteralType(checker, memberType, "Name");
					if (nameProperty === literalValue) return createEnumMatch(enumPath);
				} else {
					const valueProperty = getPropertyLiteralType(checker, memberType, "Value");
					if (valueProperty === literalValue) return createEnumMatch(enumPath);
				}
			}

			return undefined;
		}

		return {
			Literal(node): void {
				const { value } = node;
				if (typeof value !== "string" && typeof value !== "number") return;

				if (!canHaveContextualEnumType(node)) return;

				const contextualType = getContextualType(node);
				if (contextualType === undefined) return;

				if (performanceMode && shouldSkipLiteral(node, value)) return;

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
	defaultOptions: [{ fixNumericToValue: false, performanceMode: false }],
	meta: {
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
						default: false,
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
