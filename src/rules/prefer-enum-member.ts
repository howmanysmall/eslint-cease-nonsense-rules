import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES, ESLintUtils } from "@typescript-eslint/utils";
import { isUnionType, unionConstituents } from "ts-api-utils";
import type { Type, TypeChecker, Node as TypeScriptNode, Symbol as TypeScriptSymbol } from "typescript";
import {
	isEnumDeclaration,
	isEnumMember,
	isExpression,
	isIdentifier,
	isMappedTypeNode,
	isTypeAliasDeclaration,
	isTypeNode,
	isTypeReferenceNode,
	SymbolFlags,
} from "typescript";
import { createRule } from "../utilities/create-rule";

type MessageIds = "preferEnumMember";

type Options = [];

interface EnumMemberMatch {
	readonly enumSymbol: TypeScriptSymbol;
	readonly memberName: string;
}

interface EnumMemberLookup {
	readonly numberMap: Map<number, string>;
	readonly stringMap: Map<string, string>;
}

const IDENTIFIER_PATH = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/u;
const SINGLE_ARG_OBJECT_WRAPPERS = new Set(["Readonly"]);
const RECORD_ALIAS_NAME = "Record";

function getUnionTypes(type: Type): ReadonlyArray<Type> {
	if (isUnionType(type)) return unionConstituents(type);
	return [type];
}

function resolveAliasSymbol(checker: TypeChecker, symbol: TypeScriptSymbol): TypeScriptSymbol {
	if ((symbol.flags & SymbolFlags.Alias) !== 0) return checker.getAliasedSymbol(symbol);
	return symbol;
}

function isPropertyKeyLiteral(node: TSESTree.Literal): boolean {
	const { parent } = node;
	if (!parent || parent.type !== AST_NODE_TYPES.Property) return false;
	return parent.key === node;
}

function isJSXAttributeValue(node: TSESTree.Literal): boolean {
	const { parent } = node;
	return parent !== undefined && parent.type === AST_NODE_TYPES.JSXAttribute && parent.value === node;
}

function getRecordKeyType(type: Type): Type | undefined {
	const { aliasSymbol } = type;
	if (!aliasSymbol || aliasSymbol.getName() !== RECORD_ALIAS_NAME) return undefined;
	const { aliasTypeArguments } = type;
	if (!aliasTypeArguments?.[0]) return undefined;
	return aliasTypeArguments[0];
}

interface PropertyKeyInfo {
	readonly value: string | number;
	readonly isComputed: boolean;
}

function getPropertyKeyInfo(node: TSESTree.Property): PropertyKeyInfo | undefined {
	const { key } = node;
	if (key.type === AST_NODE_TYPES.Identifier) {
		if (node.computed) return undefined;
		return { isComputed: node.computed, value: key.name };
	}
	if (key.type === AST_NODE_TYPES.Literal) {
		const { value } = key;
		if (typeof value !== "string" && typeof value !== "number") return undefined;
		return { isComputed: node.computed, value };
	}
	return undefined;
}

export default createRule<Options, MessageIds>({
	create(context) {
		const services = ESLintUtils.getParserServices(context);
		const checker = services.program.getTypeChecker();
		const { sourceCode } = context;
		const enumMemberCache = new WeakMap<TypeScriptSymbol, EnumMemberLookup | false>();
		const enumMatchCache = new WeakMap<Type, Map<string | number, EnumMemberMatch | false>>();
		const contextualTypeCache = new WeakMap<TSESTree.Node, Type | false>();
		const objectKeyTypeCache = new WeakMap<Type, Type | false>();
		const aliasTypeParameterCache = new WeakMap<TypeScriptSymbol, Map<string, number> | false>();

		function isEquivalentType(left: Type, right: Type): boolean {
			if (left === right) return true;
			return checker.isTypeAssignableTo(left, right) && checker.isTypeAssignableTo(right, left);
		}

		function getEnumSymbolFromType(type: Type): TypeScriptSymbol | undefined {
			const symbol = type.aliasSymbol ?? type.getSymbol();
			if (symbol === undefined) return undefined;
			const resolved = resolveAliasSymbol(checker, symbol);
			if ((resolved.flags & (SymbolFlags.Enum | SymbolFlags.ConstEnum)) !== 0) return resolved;
			if ((resolved.flags & SymbolFlags.EnumMember) !== 0) {
				const declarations = resolved.declarations ?? [];
				for (const declaration of declarations) {
					if (!isEnumMember(declaration)) continue;
					const { parent } = declaration;
					if (!isEnumDeclaration(parent)) continue;
					const parentSymbol = checker.getSymbolAtLocation(parent.name);
					if (parentSymbol) return parentSymbol;
				}
			}
			return undefined;
		}

		function getEnumMemberValue(memberSymbol: TypeScriptSymbol): string | number | undefined {
			const { valueDeclaration } = memberSymbol;
			if (!valueDeclaration) return undefined;
			const memberType = checker.getTypeOfSymbolAtLocation(memberSymbol, valueDeclaration);
			if (memberType.isStringLiteral()) return memberType.value;
			if (memberType.isNumberLiteral()) return memberType.value;
			return undefined;
		}

		function getEnumMembers(enumSymbol: TypeScriptSymbol): EnumMemberLookup | undefined {
			const cached = enumMemberCache.get(enumSymbol);
			if (cached !== undefined) return cached === false ? undefined : cached;

			const enumType = checker.getTypeOfSymbol(enumSymbol);
			const stringMap = new Map<string, string>();
			const numberMap = new Map<number, string>();

			for (const memberSymbol of checker.getPropertiesOfType(enumType)) {
				if ((memberSymbol.flags & SymbolFlags.EnumMember) === 0) continue;
				const value = getEnumMemberValue(memberSymbol);
				if (typeof value === "string" && !stringMap.has(value)) {
					stringMap.set(value, memberSymbol.getName());
				} else if (typeof value === "number" && !numberMap.has(value)) {
					numberMap.set(value, memberSymbol.getName());
				}
			}

			if (stringMap.size === 0 && numberMap.size === 0) {
				enumMemberCache.set(enumSymbol, false);
				return undefined;
			}

			const lookup: EnumMemberLookup = { numberMap, stringMap };
			enumMemberCache.set(enumSymbol, lookup);
			return lookup;
		}

		function getEnumMemberMatch(contextualType: Type, value: string | number): EnumMemberMatch | undefined {
			const cachedByType = enumMatchCache.get(contextualType);
			if (cachedByType) {
				const cachedMatch = cachedByType.get(value);
				if (cachedMatch !== undefined) return cachedMatch === false ? undefined : cachedMatch;
			}

			const matches = new Map<TypeScriptSymbol, string>();
			const unionTypes = getUnionTypes(contextualType);

			for (const memberType of unionTypes) {
				const enumSymbol = getEnumSymbolFromType(memberType);
				if (!enumSymbol) continue;
				const lookup = getEnumMembers(enumSymbol);
				if (!lookup) continue;

				const memberName =
					typeof value === "string" ? lookup.stringMap.get(value) : lookup.numberMap.get(value);
				if (!memberName) continue;

				matches.set(enumSymbol, memberName);
				if (matches.size > 1) break;
			}

			let resolved: EnumMemberMatch | undefined;
			if (matches.size === 1) {
				const [entry] = matches.entries();
				if (entry) {
					const [enumSymbol, memberName] = entry;
					resolved = { enumSymbol, memberName };
				}
			}

			const cacheMap = cachedByType ?? new Map<string | number, EnumMemberMatch | false>();
			cacheMap.set(value, resolved ?? false);
			if (!cachedByType) enumMatchCache.set(contextualType, cacheMap);

			return resolved;
		}

		function getEnumReferenceName(enumSymbol: TypeScriptSymbol, location: TypeScriptNode): string | undefined {
			const name = checker.symbolToString(enumSymbol, location);
			return IDENTIFIER_PATH.test(name) ? name : undefined;
		}

			function getTypeParameterMap(aliasSymbol: TypeScriptSymbol): Map<string, number> | undefined {
				const cached = aliasTypeParameterCache.get(aliasSymbol);
				if (cached !== undefined) return cached === false ? undefined : cached;

				const declarations = aliasSymbol.declarations ?? [];
				for (const declaration of declarations) {
					if (!isTypeAliasDeclaration(declaration)) continue;
					const { typeParameters } = declaration;
					if (!typeParameters || typeParameters.length === 0) continue;
					const map = new Map<string, number>();
					for (const [index, param] of typeParameters.entries()) {
						map.set(param.name.text, index);
					}
				aliasTypeParameterCache.set(aliasSymbol, map);
				return map;
			}

			aliasTypeParameterCache.set(aliasSymbol, false);
			return undefined;
		}

		function resolveMappedTypeConstraint(
			aliasSymbol: TypeScriptSymbol,
			aliasTypeArguments: ReadonlyArray<Type> | undefined,
			constraint: TypeScriptNode,
		): Type | undefined {
			if (isTypeReferenceNode(constraint)) {
				const { typeName } = constraint;
				if (isIdentifier(typeName)) {
					const paramMap = getTypeParameterMap(aliasSymbol);
					const index = paramMap?.get(typeName.text);
					if (index !== undefined && aliasTypeArguments && aliasTypeArguments[index]) {
						return aliasTypeArguments[index];
					}
				}
			}
			return isTypeNode(constraint) ? checker.getTypeFromTypeNode(constraint) : undefined;
		}

		function getKeyTypeFromAlias(type: Type): Type | undefined {
			const { aliasSymbol, aliasTypeArguments } = type;
			if (!aliasSymbol) return undefined;

				const declarations = aliasSymbol.declarations ?? [];
				for (const declaration of declarations) {
					if (!isTypeAliasDeclaration(declaration)) continue;
					if (!isMappedTypeNode(declaration.type)) continue;
					const { constraint } = declaration.type.typeParameter;
					if (!constraint) continue;
					const resolved = resolveMappedTypeConstraint(aliasSymbol, aliasTypeArguments, constraint);
					if (resolved) return resolved;
				}

			return undefined;
		}

		function getObjectKeyType(type: Type): Type | undefined {
			const cached = objectKeyTypeCache.get(type);
			if (cached !== undefined) return cached === false ? undefined : cached;

			const visited = new WeakSet<Type>();
			const resolved = getObjectKeyTypeInternal(type, visited);
			objectKeyTypeCache.set(type, resolved ?? false);
			return resolved;
		}

		function getObjectKeyTypeInternal(type: Type, visited: WeakSet<Type>): Type | undefined {
			if (visited.has(type)) return undefined;
			visited.add(type);

			const unionTypes = getUnionTypes(type);
			if (unionTypes.length > 1) {
				let resolved: Type | undefined;
				for (const unionType of unionTypes) {
					const candidate = getObjectKeyTypeInternal(unionType, visited);
					if (!candidate) continue;
					if (!resolved) {
						resolved = candidate;
						continue;
					}
					if (!isEquivalentType(resolved, candidate)) return undefined;
				}
				return resolved;
			}

			const recordKeyType = getRecordKeyType(type);
			if (recordKeyType) return recordKeyType;

				const { aliasSymbol, aliasTypeArguments } = type;
				if (aliasSymbol && aliasTypeArguments && aliasTypeArguments.length === 1) {
					const aliasName = aliasSymbol.getName();
					if (SINGLE_ARG_OBJECT_WRAPPERS.has(aliasName)) {
						const [firstArg] = aliasTypeArguments;
						if (firstArg) {
						const unwrapped = getObjectKeyTypeInternal(firstArg, visited);
						if (unwrapped) return unwrapped;
					}
				}
			}

			const keyType = getKeyTypeFromAlias(type);
			if (keyType) return keyType;

			return undefined;
		}

		function getContextualType(node: TSESTree.Node): Type | undefined {
			const cached = contextualTypeCache.get(node);
			if (cached !== undefined) return cached === false ? undefined : cached;

			const tsNode = services.esTreeNodeToTSNodeMap.get(node);
			const expressionNode = tsNode && isExpression(tsNode) ? tsNode : undefined;
			const type = expressionNode ? checker.getContextualType(expressionNode) : undefined;
			contextualTypeCache.set(node, type ?? false);
			return type ?? undefined;
		}

			function getExpectedType(node: TSESTree.Node): Type | undefined {
				const { parent } = node;
				if (!parent) return undefined;

			if (parent.type === AST_NODE_TYPES.TSLiteralType) {
				getContextualType(parent);
				return undefined;
			}

			if (parent.type === AST_NODE_TYPES.VariableDeclarator && parent.init === node) {
				const annotation = parent.id.type === AST_NODE_TYPES.Identifier ? parent.id.typeAnnotation : undefined;
				if (annotation) {
					const tsNode = services.esTreeNodeToTSNodeMap.get(annotation.typeAnnotation);
					if (tsNode && isTypeNode(tsNode)) return checker.getTypeFromTypeNode(tsNode);
				}
			}

			if (parent.type === AST_NODE_TYPES.AssignmentExpression && parent.right === node) {
				const tsNode = services.esTreeNodeToTSNodeMap.get(parent.left);
				if (tsNode) return checker.getTypeAtLocation(tsNode);
			}

			const contextual = getContextualType(node);
			if (contextual) return contextual;

			return undefined;
		}

		function reportEnumLiteral(node: TSESTree.Literal, value: string | number): void {
			if (isPropertyKeyLiteral(node)) return;

			const expectedType = getExpectedType(node);
			if (!expectedType) return;

			const match = getEnumMemberMatch(expectedType, value);
			if (!match) return;

			const tsNode = services.esTreeNodeToTSNodeMap.get(node);
			if (!tsNode) return;

			const enumName = getEnumReferenceName(match.enumSymbol, tsNode);
			if (!enumName) return;

			const fixPath = `${enumName}.${match.memberName}`;
			const fixText = isJSXAttributeValue(node) ? `{${fixPath}}` : fixPath;

			context.report({
				data: {
					expected: fixPath,
					value: sourceCode.getText(node),
				},
				fix(fixer) {
					return fixer.replaceText(node, fixText);
				},
				messageId: "preferEnumMember",
				node,
			});
		}

		function reportEnumKey(node: TSESTree.Property, keyValue: PropertyKeyInfo): void {
			if (node.parent?.type !== AST_NODE_TYPES.ObjectExpression) return;

			const contextualType = getContextualType(node.parent);
			if (!contextualType) return;

			const keyType = getObjectKeyType(contextualType);
			if (!keyType) return;

			const match = getEnumMemberMatch(keyType, keyValue.value);
			if (!match) return;

			const tsObject = services.esTreeNodeToTSNodeMap.get(node.parent);
			if (!tsObject) return;

			const enumName = getEnumReferenceName(match.enumSymbol, tsObject);
			if (!enumName) return;

			const memberPath = `${enumName}.${match.memberName}`;
			const fixPath = `[${memberPath}]`;
			const keyNode = node.key;

			if (node.shorthand && keyNode.type === AST_NODE_TYPES.Identifier) {
				context.report({
					data: {
						expected: fixPath,
						value: sourceCode.getText(keyNode),
					},
					fix(fixer) {
						return fixer.replaceText(node, `${fixPath}: ${keyNode.name}`);
					},
					messageId: "preferEnumMember",
					node: keyNode,
				});
				return;
			}

			const replacement = keyValue.isComputed ? memberPath : fixPath;

			context.report({
				data: {
					expected: fixPath,
					value: sourceCode.getText(keyNode),
				},
				fix(fixer) {
					return fixer.replaceText(keyNode, replacement);
				},
				messageId: "preferEnumMember",
				node: keyNode,
			});
		}

		return {
			Literal(node): void {
				const { value } = node;
				if (typeof value !== "string" && typeof value !== "number") return;
				reportEnumLiteral(node, value);
			},
			Property(node): void {
				const keyValue = getPropertyKeyInfo(node);
				if (keyValue === undefined) return;
				reportEnumKey(node, keyValue);
			},
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description: "Enforce enum member references instead of raw enum values.",
		},
		fixable: "code",
		messages: {
			preferEnumMember: "Use `{{ expected }}` instead of `{{ value }}`.",
		},
		schema: [],
		type: "suggestion",
	},
	name: "prefer-enum-member",
});
