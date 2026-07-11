import { createRule } from "$utilities/create-rule";
import { getDefinedValue } from "$utilities/defined-utilities";
import {
	getContextualTypeForExpressionNode,
	getRequiredEnumMemberDeclaration,
	getTypeNodeResult,
} from "$utilities/typescript-node-utilities";
import { AST_NODE_TYPES, ESLintUtils } from "@typescript-eslint/utils";
import { isUnionType, unionConstituents } from "ts-api-utils";
import {
	isIdentifier,
	isMappedTypeNode,
	isParenthesizedTypeNode,
	isTypeAliasDeclaration,
	isTypeReferenceNode,
	isUnionTypeNode,
	SymbolFlags,
} from "typescript";

import type { EnumValueLookup } from "$utilities/enum-utilities";
import type { TSESTree } from "@typescript-eslint/utils";
import type {
	Type,
	TypeAliasDeclaration,
	TypeNode,
	TypeReferenceNode,
	Node as TypeScriptNode,
	Symbol as TypeScriptSymbol,
} from "typescript";

type MessageIds = "preferEnumMember";

type Options = [];

interface EnumMemberMatch {
	readonly enumSymbol: TypeScriptSymbol;
	readonly memberName: string;
}

interface EnumCandidate {
	readonly enumSymbol: TypeScriptSymbol;
	readonly lookup: EnumValueLookup;
}

const IDENTIFIER_PATH = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/u;
const SINGLE_ARGUMENT_OBJECT_WRAPPERS = new Set(["Readonly"]);
const RECORD_ALIAS_NAME = "Record";

function getReferenceRoot(name: string): string {
	const separatorIndex = name.indexOf(".");
	return separatorIndex === -1 ? name : name.slice(0, separatorIndex);
}

function hasSingleTypeArgument(types?: ReadonlyArray<Type>): types is readonly [Type] {
	return types?.length === 1;
}

type LiteralParent = NonNullable<TSESTree.Literal["parent"]>;

function isPropertyKeyLiteral(node: TSESTree.Literal, parent: LiteralParent): boolean {
	if (parent.type !== AST_NODE_TYPES.Property) return false;
	return parent.key === node;
}

function isModuleSpecifierLiteral(node: TSESTree.Literal, parent: LiteralParent): boolean {
	switch (parent.type) {
		case AST_NODE_TYPES.ImportDeclaration:
		case AST_NODE_TYPES.ExportNamedDeclaration:
		case AST_NODE_TYPES.ExportAllDeclaration:
		case AST_NODE_TYPES.ImportExpression:
			return parent.source === node;

		default:
			return false;
	}
}

function isDirectiveLiteral(node: TSESTree.Literal, parent: LiteralParent): boolean {
	if (parent.type !== AST_NODE_TYPES.ExpressionStatement || parent.expression !== node) return false;
	return typeof parent.directive === "string";
}

function isJSXAttributeValue(node: TSESTree.Literal): boolean {
	const { parent } = node;
	return parent !== undefined && parent.type === AST_NODE_TYPES.JSXAttribute && parent.value === node;
}

function getRecordKeyType(type: Type): Type | undefined {
	const { aliasSymbol } = type;
	if (!aliasSymbol || aliasSymbol.getName() !== RECORD_ALIAS_NAME) return undefined;
	return type.aliasTypeArguments?.[0];
}

interface PropertyKeyInfo {
	readonly isComputed: boolean;
	readonly value: string | number;
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

function getUnionTypes(type: Type): ReadonlyArray<Type> {
	const constituents = isUnionType(type) ? unionConstituents(type) : undefined;
	return constituents !== undefined && constituents.length > 0 ? constituents : [type];
}

function getTypeParameterMap(aliasSymbol: TypeScriptSymbol): Map<string, number> | undefined {
	const declaration = getFirstTypeAliasDeclaration(aliasSymbol);
	const typeParameters = declaration?.typeParameters;
	if (typeParameters === undefined || typeParameters.length === 0) return undefined;

	const map = new Map<string, number>();
	let index = 0;
	for (const { name } of typeParameters) map.set(name.text, index++);
	return map;
}

function getFirstTypeAliasDeclaration(symbol: TypeScriptSymbol): TypeAliasDeclaration | undefined {
	for (const declaration of symbol.declarations ?? []) {
		if (isTypeAliasDeclaration(declaration)) return declaration;
	}

	return undefined;
}

const preferEnumMember = createRule<Options, MessageIds>({
	create(context) {
		const services = ESLintUtils.getParserServices(context);
		const checker = services.program.getTypeChecker();
		const { sourceCode } = context;
		const enumMembersCache = new WeakMap<TypeScriptSymbol, EnumValueLookup | false>();
		const enumSymbolFromTypeCache = new WeakMap<Type, TypeScriptSymbol | false>();
		const objectKeyTypeCache = new WeakMap<Type, Type | false>();
		const runtimeBindingCache = new Map<string, boolean>();

		for (const statement of sourceCode.ast.body) {
			if (statement.type !== AST_NODE_TYPES.ImportDeclaration) continue;
			for (const specifier of statement.specifiers) {
				const isTypeOnly =
					statement.importKind === "type" ||
					(specifier.type === AST_NODE_TYPES.ImportSpecifier && specifier.importKind === "type");
				const previous = runtimeBindingCache.get(specifier.local.name);
				runtimeBindingCache.set(specifier.local.name, previous === true || !isTypeOnly);
			}
		}

		function isEquivalentType(left: Type, right: Type): boolean {
			if (left === right) {
				return true;
			}

			return checker.isTypeAssignableTo(left, right) && checker.isTypeAssignableTo(right, left);
		}

		function getEnumSymbolFromType(type: Type): TypeScriptSymbol | undefined {
			const cached = enumSymbolFromTypeCache.get(type);
			if (cached !== undefined) return cached === false ? undefined : cached;

			const symbol = type.aliasSymbol ?? type.getSymbol();
			if (symbol === undefined) {
				enumSymbolFromTypeCache.set(type, false);
				return undefined;
			}

			if ((symbol.flags & (SymbolFlags.Enum | SymbolFlags.ConstEnum)) !== 0) {
				enumSymbolFromTypeCache.set(type, symbol);
				return symbol;
			}
			if ((symbol.flags & SymbolFlags.EnumMember) === 0) {
				enumSymbolFromTypeCache.set(type, false);
				return undefined;
			}

			const declaration = getRequiredEnumMemberDeclaration(symbol.valueDeclaration);
			const enumSymbol = checker.getSymbolAtLocation(declaration.parent.name);
			enumSymbolFromTypeCache.set(type, getDefinedValue(enumSymbol));
			return enumSymbol;
		}

		function getSharedEnumSymbol(left: Type, right: Type): TypeScriptSymbol | undefined {
			const leftEnumSymbol = getSingleEnumSymbolFromType(left);
			if (leftEnumSymbol === undefined) return undefined;
			return getSingleEnumSymbolFromType(right) === leftEnumSymbol ? leftEnumSymbol : undefined;
		}

		function getSingleEnumSymbolFromType(type: Type): TypeScriptSymbol | undefined {
			const directEnumSymbol = getEnumSymbolFromType(type);
			if (directEnumSymbol !== undefined) return directEnumSymbol;

			let resolvedSymbol: TypeScriptSymbol | undefined;
			for (const memberType of getUnionTypes(type)) {
				const memberEnumSymbol = getEnumSymbolFromType(memberType);
				if (memberEnumSymbol === undefined) return undefined;
				if (resolvedSymbol !== undefined && resolvedSymbol !== memberEnumSymbol) return undefined;
				resolvedSymbol = memberEnumSymbol;
			}

			return resolvedSymbol;
		}

		function mergeCompatibleKeyTypes(resolved: Type, candidate: Type): Type | undefined {
			if (isEquivalentType(resolved, candidate)) return resolved;
			if (checker.isTypeAssignableTo(resolved, candidate)) return candidate;
			if (checker.isTypeAssignableTo(candidate, resolved)) return resolved;
			const sharedEnumSymbol = getSharedEnumSymbol(resolved, candidate);
			if (sharedEnumSymbol !== undefined) return checker.getTypeOfSymbol(sharedEnumSymbol);
			return undefined;
		}

		function mergeKeyTypeCandidate(current: Type | undefined, candidate: Type | undefined): Type | undefined {
			if (candidate === undefined) return current;
			if (current === undefined) return candidate;
			return mergeCompatibleKeyTypes(current, candidate);
		}

		function getEnumMemberValue(memberSymbol: TypeScriptSymbol): string | number | undefined {
			const memberType = checker.getTypeOfSymbol(memberSymbol);
			return memberType.isStringLiteral() || memberType.isNumberLiteral() ? memberType.value : undefined;
		}

		function getEnumMembers(enumSymbol: TypeScriptSymbol): EnumValueLookup | undefined {
			const cached = enumMembersCache.get(enumSymbol);
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
				enumMembersCache.set(enumSymbol, false);
				return undefined;
			}

			const lookup = { numberMap, stringMap };
			enumMembersCache.set(enumSymbol, lookup);
			return lookup;
		}

		function getEnumCandidates(contextualType: Type): ReadonlyArray<EnumCandidate> | undefined {
			const unionTypes = getUnionTypes(contextualType);
			const candidates = new Array<EnumCandidate>();
			const seen = new Set<TypeScriptSymbol>();

			for (const memberType of unionTypes) {
				const enumSymbol = getEnumSymbolFromType(memberType);
				if (!enumSymbol) continue;
				if (seen.has(enumSymbol)) continue;

				const lookup = getEnumMembers(enumSymbol);
				if (!lookup) continue;

				seen.add(enumSymbol);
				candidates.push({ enumSymbol, lookup });
			}

			return candidates.length === 0 ? undefined : candidates;
		}

		function getEnumMemberMatch(contextualType: Type, value: string | number): EnumMemberMatch | undefined {
			const candidates = getEnumCandidates(contextualType);
			if (!candidates) return undefined;

			let resolvedSymbol: TypeScriptSymbol | undefined;
			let resolvedMember: string | undefined;

			for (const candidate of candidates) {
				const memberName =
					typeof value === "string"
						? candidate.lookup.stringMap.get(value)
						: candidate.lookup.numberMap.get(value);
				if (memberName === undefined) continue;
				if (resolvedSymbol !== undefined && resolvedSymbol !== candidate.enumSymbol) return undefined;
				resolvedSymbol = candidate.enumSymbol;
				resolvedMember = memberName;
			}

			if (resolvedSymbol === undefined || resolvedMember === undefined) return undefined;
			return { enumSymbol: resolvedSymbol, memberName: resolvedMember };
		}

		function hasRuntimeBinding(name: string): boolean {
			return runtimeBindingCache.get(getReferenceRoot(name)) ?? true;
		}

		function getEnumReferenceName(enumSymbol: TypeScriptSymbol, location: TypeScriptNode): string | undefined {
			const name = checker.symbolToString(enumSymbol, location);
			return IDENTIFIER_PATH.test(name) && hasRuntimeBinding(name) ? name : undefined;
		}

		function resolveMappedTypeConstraint(
			aliasSymbol: TypeScriptSymbol,
			aliasTypeArguments: ReadonlyArray<Type> | undefined,
			constraint: TypeNode,
		): Type {
			if (isParenthesizedTypeNode(constraint)) {
				return resolveMappedTypeConstraint(aliasSymbol, aliasTypeArguments, constraint.type);
			}

			if (isTypeReferenceNode(constraint)) {
				let resolvedReferenceKeyType: Type | undefined;
				let shouldReturnResolvedReference = false;
				const { typeName } = constraint;
				if (isIdentifier(typeName)) {
					const parameterMap = getTypeParameterMap(aliasSymbol);
					const index = parameterMap?.get(typeName.text);
					shouldReturnResolvedReference = index !== undefined;
					resolvedReferenceKeyType = index === undefined ? undefined : aliasTypeArguments?.[index];
				}

				if (!shouldReturnResolvedReference) {
					resolvedReferenceKeyType = getObjectKeyTypeFromTypeReferenceNode(
						constraint,
						new WeakSet<Type>(),
						aliasSymbol,
						aliasTypeArguments,
					);
					shouldReturnResolvedReference = resolvedReferenceKeyType !== undefined;
				}

				if (shouldReturnResolvedReference) {
					return getDefinedValue(resolvedReferenceKeyType);
				}
			}
			return checker.getTypeFromTypeNode(constraint);
		}

		function getKeyTypeFromAlias(type: Type): Type | undefined {
			const { aliasSymbol, aliasTypeArguments } = type;
			if (!aliasSymbol) return undefined;

			const declaration = getFirstTypeAliasDeclaration(aliasSymbol);
			if (declaration === undefined || !isMappedTypeNode(declaration.type)) return undefined;

			const constraint = getDefinedValue(
				declaration.type.typeParameter.constraint,
				"Expected mapped type parameter to have a constraint.",
			);
			return resolveMappedTypeConstraint(aliasSymbol, aliasTypeArguments, constraint);
		}

		function getRecordKeyTypeFromAlias(type: Type): Type | undefined {
			const { aliasSymbol, aliasTypeArguments } = type;
			if (!aliasSymbol) return undefined;

			const declaration = getFirstTypeAliasDeclaration(aliasSymbol);
			if (declaration === undefined || !isTypeReferenceNode(declaration.type)) return undefined;

			const targetSymbol = checker.getSymbolAtLocation(declaration.type.typeName);
			if (targetSymbol === undefined || targetSymbol.getName() !== RECORD_ALIAS_NAME) return undefined;

			const keyNode = getDefinedValue(
				declaration.type.typeArguments?.at(0),
				"Expected Record alias to include a key type.",
			);
			return resolveMappedTypeConstraint(aliasSymbol, aliasTypeArguments, keyNode);
		}

		function getResolvedAliasTypeParameter(
			typeName: string,
			aliasSymbol: TypeScriptSymbol,
			aliasTypeArguments: ReadonlyArray<Type> | undefined,
		): Type | undefined {
			const parameterMap = getTypeParameterMap(aliasSymbol);
			const parameterIndex = parameterMap?.get(typeName);
			if (parameterIndex === undefined) return undefined;
			return aliasTypeArguments?.[parameterIndex];
		}

		function getRecordKeyTypeFromTypeReferenceNode(
			typeNode: TypeReferenceNode,
			aliasSymbol: TypeScriptSymbol,
			aliasTypeArguments: ReadonlyArray<Type> | undefined,
		): Type | undefined {
			const keyTypeNode = getDefinedValue(
				typeNode.typeArguments?.at(0),
				"Expected Record reference to include a key type.",
			);
			return resolveMappedTypeConstraint(aliasSymbol, aliasTypeArguments, keyTypeNode);
		}

		function getResolvedTypeArgumentsFromTypeReferenceNode(
			typeNode: TypeReferenceNode,
			aliasSymbol: TypeScriptSymbol,
			aliasTypeArguments: ReadonlyArray<Type> | undefined,
		): Array<Type> | undefined {
			const { typeArguments } = typeNode;
			if (typeArguments === undefined || typeArguments.length === 0) return undefined;

			const resolvedTypeArguments = new Array<Type>();
			for (const typeArgument of typeArguments) {
				const resolvedTypeArgument = resolveMappedTypeConstraint(aliasSymbol, aliasTypeArguments, typeArgument);
				resolvedTypeArguments.push(resolvedTypeArgument);
			}
			return resolvedTypeArguments;
		}

		function getAliasDeclarationFromTypeReferenceNode(
			typeNode: TypeReferenceNode,
		): TypeAliasDeclaration | undefined {
			const targetSymbol = getDefinedValue(
				checker.getSymbolAtLocation(typeNode.typeName),
				"Expected type reference to resolve to a symbol.",
			);
			return getFirstTypeAliasDeclaration(targetSymbol);
		}

		function getAliasedObjectKeyTypeFromTypeReferenceNode(
			typeNode: TypeReferenceNode,
			visited: WeakSet<Type>,
			aliasSymbol: TypeScriptSymbol,
			aliasTypeArguments: ReadonlyArray<Type> | undefined,
		): Type | undefined {
			const aliasDeclaration = getAliasDeclarationFromTypeReferenceNode(typeNode);
			if (aliasDeclaration === undefined) return undefined;

			const aliasTypeArgumentsForReference = getResolvedTypeArgumentsFromTypeReferenceNode(
				typeNode,
				aliasSymbol,
				aliasTypeArguments,
			);
			const aliasDeclarationSymbol = checker.getSymbolAtLocation(aliasDeclaration.name);

			return getObjectKeyTypeFromTypeNode(
				aliasDeclaration.type,
				visited,
				aliasDeclarationSymbol,
				aliasTypeArgumentsForReference,
			);
		}

		function getObjectKeyTypeFromTypeReferenceNode(
			typeNode: TypeReferenceNode,
			visited: WeakSet<Type>,
			aliasSymbol: TypeScriptSymbol,
			aliasTypeArguments?: ReadonlyArray<Type>,
		): Type | undefined {
			const { typeName } = typeNode;
			if (!isIdentifier(typeName)) return undefined;

			const resolvedAliasTypeParameter = getResolvedAliasTypeParameter(
				typeName.text,
				aliasSymbol,
				aliasTypeArguments,
			);
			if (resolvedAliasTypeParameter !== undefined) return resolvedAliasTypeParameter;

			if (typeName.text === RECORD_ALIAS_NAME) {
				return getRecordKeyTypeFromTypeReferenceNode(typeNode, aliasSymbol, aliasTypeArguments);
			}

			if (SINGLE_ARGUMENT_OBJECT_WRAPPERS.has(typeName.text)) {
				const firstTypeNode = getDefinedValue(
					typeNode.typeArguments?.at(0),
					"Expected object wrapper reference to include a type argument.",
				);
				return getObjectKeyTypeFromTypeNode(firstTypeNode, visited, aliasSymbol, aliasTypeArguments);
			}

			const aliasedObjectKeyType = getAliasedObjectKeyTypeFromTypeReferenceNode(
				typeNode,
				visited,
				aliasSymbol,
				aliasTypeArguments,
			);
			if (aliasedObjectKeyType !== undefined) return aliasedObjectKeyType;

			return undefined;
		}

		function getMergedObjectKeyTypeFromTypeNodes(
			typeNodes: ReadonlyArray<TypeNode>,
			visited: WeakSet<Type>,
			aliasSymbol: TypeScriptSymbol | undefined,
			aliasTypeArguments: ReadonlyArray<Type> | undefined,
		): Type | undefined {
			let resolved: Type | undefined;
			for (const memberTypeNode of typeNodes) {
				const candidate = getObjectKeyTypeFromTypeNode(
					memberTypeNode,
					visited,
					aliasSymbol,
					aliasTypeArguments,
				);
				const merged = mergeKeyTypeCandidate(resolved, candidate);
				if (candidate !== undefined && merged === undefined) return undefined;
				resolved = merged;
			}
			return resolved;
		}

		function getObjectKeyTypeFromTypeNode(
			typeNode: TypeNode,
			visited: WeakSet<Type>,
			aliasSymbol?: TypeScriptSymbol,
			aliasTypeArguments?: ReadonlyArray<Type>,
		): Type | undefined {
			if (isParenthesizedTypeNode(typeNode)) {
				return getObjectKeyTypeFromTypeNode(typeNode.type, visited, aliasSymbol, aliasTypeArguments);
			}

			if (isMappedTypeNode(typeNode)) {
				const constraint = getDefinedValue(
					typeNode.typeParameter.constraint,
					"Expected mapped type parameter to have a constraint.",
				);
				if (aliasSymbol === undefined) return checker.getTypeFromTypeNode(constraint);
				return resolveMappedTypeConstraint(aliasSymbol, aliasTypeArguments, constraint);
			}

			if (isUnionTypeNode(typeNode)) {
				return getMergedObjectKeyTypeFromTypeNodes(typeNode.types, visited, aliasSymbol, aliasTypeArguments);
			}

			if (isTypeReferenceNode(typeNode) && aliasSymbol !== undefined) {
				const resolvedTypeReferenceKeyType = getObjectKeyTypeFromTypeReferenceNode(
					typeNode,
					visited,
					aliasSymbol,
					aliasTypeArguments,
				);
				return resolvedTypeReferenceKeyType;
			}

			const resolvedType = checker.getTypeFromTypeNode(typeNode);
			return getObjectKeyTypeInternal(resolvedType, visited);
		}

		function getObjectKeyTypeFromAliasDeclaration(type: Type, visited: WeakSet<Type>): Type | undefined {
			const { aliasSymbol, aliasTypeArguments } = type;
			if (aliasSymbol === undefined) return undefined;

			const declaration = getFirstTypeAliasDeclaration(aliasSymbol);
			return declaration === undefined
				? undefined
				: getObjectKeyTypeFromTypeNode(declaration.type, visited, aliasSymbol, aliasTypeArguments);
		}

		function getObjectKeyType(type: Type): Type | undefined {
			const cached = objectKeyTypeCache.get(type);
			if (cached !== undefined) return cached === false ? undefined : cached;

			const visited = new WeakSet<Type>();
			const result = getObjectKeyTypeInternal(type, visited);
			objectKeyTypeCache.set(type, result ?? false);
			return result;
		}

		function getMergedObjectKeyTypeFromTypes(types: ReadonlyArray<Type>, visited: WeakSet<Type>): Type | undefined {
			let resolved: Type | undefined;
			for (const unionType of types) {
				const candidate = getObjectKeyTypeInternal(unionType, visited);
				const merged = mergeKeyTypeCandidate(resolved, candidate);
				if (candidate !== undefined && merged === undefined) return undefined;
				resolved = merged;
			}
			return resolved;
		}

		function getUnionObjectKeyType(type: Type, visited: WeakSet<Type>): Type | undefined {
			const unionTypes = getUnionTypes(type);
			return unionTypes.length > 1 ? getMergedObjectKeyTypeFromTypes(unionTypes, visited) : undefined;
		}

		function getWrappedAliasObjectKeyType(type: Type, visited: WeakSet<Type>): Type | undefined {
			const { aliasSymbol, aliasTypeArguments } = type;
			if (aliasSymbol === undefined || !hasSingleTypeArgument(aliasTypeArguments)) return undefined;
			const aliasName = aliasSymbol.getName();
			if (!SINGLE_ARGUMENT_OBJECT_WRAPPERS.has(aliasName)) return undefined;

			const [firstArgument] = aliasTypeArguments;
			return getObjectKeyTypeInternal(firstArgument, visited);
		}

		function getObjectKeyTypeInternal(type: Type, visited: WeakSet<Type>): Type | undefined {
			if (visited.has(type)) return undefined;
			visited.add(type);

			const unionKeyType = getUnionObjectKeyType(type, visited);
			if (unionKeyType !== undefined) return unionKeyType;

			const recordKeyType = getRecordKeyType(type);
			if (recordKeyType !== undefined) return recordKeyType;

			const recordKeyTypeFromAlias = getRecordKeyTypeFromAlias(type);
			if (recordKeyTypeFromAlias !== undefined) return recordKeyTypeFromAlias;

			const wrappedAliasObjectKeyType = getWrappedAliasObjectKeyType(type, visited);
			if (wrappedAliasObjectKeyType !== undefined) return wrappedAliasObjectKeyType;

			const keyType = getKeyTypeFromAlias(type);
			if (keyType !== undefined) return keyType;

			const keyTypeFromAliasDeclaration = getObjectKeyTypeFromAliasDeclaration(type, visited);
			if (keyTypeFromAliasDeclaration !== undefined) return keyTypeFromAliasDeclaration;

			return undefined;
		}

		function getContextualType(node: TSESTree.Node): Type | undefined {
			const tsNode = services.esTreeNodeToTSNodeMap.get(node);
			return getContextualTypeForExpressionNode(checker, tsNode);
		}

		function getVariableDeclaratorType(parent: TSESTree.VariableDeclarator): Type | undefined {
			const annotation = parent.id.type === AST_NODE_TYPES.Identifier ? parent.id.typeAnnotation : undefined;
			if (annotation !== undefined) {
				const tsNode = services.esTreeNodeToTSNodeMap.get(annotation.typeAnnotation);
				return checker.getTypeAtLocation(tsNode);
			}

			const tsIdNode = services.esTreeNodeToTSNodeMap.get(parent.id);
			return checker.getTypeAtLocation(tsIdNode);
		}

		function getAssignmentType(parent: TSESTree.AssignmentExpression): Type | undefined {
			const tsNode = services.esTreeNodeToTSNodeMap.get(parent.left);
			return checker.getTypeAtLocation(tsNode);
		}

		function getSatisfiesType(parent: TSESTree.TSSatisfiesExpression): Type | undefined {
			const tsNode = services.esTreeNodeToTSNodeMap.get(parent.typeAnnotation);
			return checker.getTypeAtLocation(tsNode);
		}

		function getVariableDeclaratorObjectKeyType(parent: TSESTree.VariableDeclarator): Type | undefined {
			if (parent.id.type !== AST_NODE_TYPES.Identifier) return undefined;
			const annotation = parent.id.typeAnnotation;
			if (annotation === undefined) return undefined;

			const tsNode = services.esTreeNodeToTSNodeMap.get(annotation.typeAnnotation);
			return getTypeNodeResult(tsNode, (typeNode) => getObjectKeyTypeFromTypeNode(typeNode, new WeakSet<Type>()));
		}

		function getDeclaredObjectKeyTypeFromParent(node: TSESTree.Node): Type | undefined {
			const { parent } = node;
			if (parent?.type !== AST_NODE_TYPES.VariableDeclarator) return undefined;
			return getVariableDeclaratorObjectKeyType(parent);
		}

		function getDeclaredParentType(node: TSESTree.Node): Type | undefined {
			const { parent } = node;
			switch (parent?.type) {
				case AST_NODE_TYPES.VariableDeclarator:
					return getVariableDeclaratorType(parent);
				case AST_NODE_TYPES.AssignmentExpression:
					return getAssignmentType(parent);
				case AST_NODE_TYPES.TSSatisfiesExpression:
					return getSatisfiesType(parent);
				default:
					return undefined;
			}
		}

		function getDeclaredTypeFromParent(node: TSESTree.Node): Type | undefined {
			return getDeclaredParentType(node);
		}

		function getExpectedType(node: TSESTree.Node): Type | undefined {
			const declared = getDeclaredTypeFromParent(node);
			if (declared) return declared;

			const contextual = getContextualType(node);
			if (contextual) return contextual;

			return undefined;
		}

		function shouldSkipLiteral(node: TSESTree.Literal): boolean {
			const { parent } = node;
			if (isPropertyKeyLiteral(node, parent)) return true;
			if (parent.type === AST_NODE_TYPES.TSLiteralType) return true;
			if (parent.type === AST_NODE_TYPES.TSImportType) return true;
			if (isModuleSpecifierLiteral(node, parent)) return true;
			if (isDirectiveLiteral(node, parent)) return true;
			return false;
		}

		function reportEnumLiteral(node: TSESTree.Literal, value: string | number): void {
			const expectedType = getExpectedType(node);
			if (expectedType === undefined) return;

			const match = getEnumMemberMatch(expectedType, value);
			if (match === undefined) return;

			const tsNode = services.esTreeNodeToTSNodeMap.get(node);

			const enumName = getEnumReferenceName(match.enumSymbol, tsNode);
			if (enumName === undefined) return;

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

		function getObjectExpressionKeyType(node: TSESTree.ObjectExpression): Type | undefined {
			const declaredObjectKeyType = getDeclaredObjectKeyTypeFromParent(node);
			const declaredType = declaredObjectKeyType === undefined ? getDeclaredTypeFromParent(node) : undefined;
			const declaredKeyType =
				declaredObjectKeyType ?? (declaredType === undefined ? undefined : getObjectKeyType(declaredType));
			const contextualType = declaredKeyType === undefined ? getContextualType(node) : undefined;
			const contextualKeyType = contextualType === undefined ? undefined : getObjectKeyType(contextualType);

			if (declaredKeyType !== undefined || contextualKeyType !== undefined) {
				return declaredKeyType ?? contextualKeyType;
			}

			const tsObjectExpression = services.esTreeNodeToTSNodeMap.get(node);

			const locationType = checker.getTypeAtLocation(tsObjectExpression);
			return getObjectKeyType(locationType);
		}

		function reportEnumKey(node: TSESTree.Property, keyValue: PropertyKeyInfo): void {
			if (node.parent?.type !== AST_NODE_TYPES.ObjectExpression) {
				return;
			}

			const keyType = getObjectExpressionKeyType(node.parent);
			if (keyType === undefined) return;

			const match = getEnumMemberMatch(keyType, keyValue.value);
			if (match === undefined) return;

			const tsObject = services.esTreeNodeToTSNodeMap.get(node.parent);

			const enumName = getEnumReferenceName(match.enumSymbol, tsObject);
			if (enumName === undefined) return;

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
				if (shouldSkipLiteral(node)) return;
				reportEnumLiteral(node, value);
			},
			Property(node): void {
				const keyValue = getPropertyKeyInfo(node);
				if (keyValue === undefined) return;
				reportEnumKey(node, keyValue);
			},
		};
	},
	meta: {
		defaultOptions: [],
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

export default preferEnumMember;
