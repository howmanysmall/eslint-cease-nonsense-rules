import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES, ESLintUtils } from "@typescript-eslint/utils";
import { isUnionType, unionConstituents } from "ts-api-utils";
import type { Program, Type, TypeChecker, Node as TypeScriptNode, Symbol as TypeScriptSymbol } from "typescript";
import {
	forEachChild,
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

interface EnumCandidate {
	readonly enumSymbol: TypeScriptSymbol;
	readonly lookup: EnumMemberLookup;
}

const IDENTIFIER_PATH = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/u;
const SINGLE_ARGUMENT_OBJECT_WRAPPERS = new Set(["Readonly"]);
const RECORD_ALIAS_NAME = "Record";

interface EnumValueIndex {
	readonly stringSet: Set<string>;
	readonly numberSet: Set<number>;
	readonly isComplete: boolean;
}

const enumValueIndexCache = new WeakMap<Program, EnumValueIndex | false>();

function resolveAliasSymbol(checker: TypeChecker, symbol: TypeScriptSymbol): TypeScriptSymbol {
	if ((symbol.flags & SymbolFlags.Alias) !== 0) return checker.getAliasedSymbol(symbol);
	return symbol;
}

function isPropertyKeyLiteral(node: TSESTree.Literal): boolean {
	const { parent } = node;
	if (!parent || parent.type !== AST_NODE_TYPES.Property) return false;
	return parent.key === node;
}

function isModuleSpecifierLiteral(node: TSESTree.Literal): boolean {
	const { parent } = node;
	if (!parent) return false;
	switch (parent.type) {
		case AST_NODE_TYPES.ImportDeclaration:
		case AST_NODE_TYPES.ExportNamedDeclaration:
		case AST_NODE_TYPES.ExportAllDeclaration:
			return parent.source === node;
		case AST_NODE_TYPES.ImportExpression:
			return parent.source === node;
		default:
			return false;
	}
}

function isDirectiveLiteral(node: TSESTree.Literal): boolean {
	const { parent } = node;
	if (!parent || parent.type !== AST_NODE_TYPES.ExpressionStatement) return false;
	if (parent.expression !== node) return false;
	return typeof parent.directive === "string";
}

function buildEnumValueIndex(program: Program, checker: TypeChecker): EnumValueIndex {
	const stringSet = new Set<string>();
	const numberSet = new Set<number>();
	let hasEnumDeclaration = false;
	let isComplete = true;

	function visit(node: TypeScriptNode): void {
		if (isEnumDeclaration(node)) {
			hasEnumDeclaration = true;
			for (const member of node.members) {
				const constantValue = checker.getConstantValue(member);
				if (typeof constantValue === "string") stringSet.add(constantValue);
				else if (typeof constantValue === "number") numberSet.add(constantValue);
				else isComplete = false;
			}
		}
		forEachChild(node, visit);
	}

	for (const sourceFile of program.getSourceFiles()) visit(sourceFile);

	if (!hasEnumDeclaration) isComplete = false;
	return { isComplete, numberSet, stringSet };
}

function getEnumValueIndex(program: Program, checker: TypeChecker): EnumValueIndex {
	const cached = enumValueIndexCache.get(program);
	if (cached !== undefined && cached !== false) return cached;
	const built = buildEnumValueIndex(program, checker);
	enumValueIndexCache.set(program, built);
	return built;
}

function isJSXAttributeValue(node: TSESTree.Literal): boolean {
	const { parent } = node;
	return parent !== undefined && parent.type === AST_NODE_TYPES.JSXAttribute && parent.value === node;
}

function getRecordKeyType(type: Type): Type | undefined {
	const { aliasSymbol } = type;
	if (!aliasSymbol || aliasSymbol.getName() !== RECORD_ALIAS_NAME) return undefined;
	return type.aliasTypeArguments?.[0] ?? undefined;
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
		const enumCandidateCache = new WeakMap<Type, ReadonlyArray<EnumCandidate> | false>();
		const enumSymbolCache = new WeakMap<Type, TypeScriptSymbol | false>();
		const objectKeyTypeCache = new WeakMap<Type, Type | false>();
		const aliasTargetCache = new WeakMap<TypeScriptSymbol, Type | false>();
		const aliasTypeParameterCache = new WeakMap<TypeScriptSymbol, Map<string, number> | false>();
		const unionTypesCache = new WeakMap<Type, ReadonlyArray<Type>>();
		const contextualTypeCache = new WeakMap<TSESTree.Node, Type | false>();
		const enumValueIndex = getEnumValueIndex(services.program, checker);
		const lintedSourceFile = services.program.getSourceFile(context.filename);
		const shouldUseEnumIndex = enumValueIndex.isComplete && lintedSourceFile !== undefined;

		function getUnionTypesCached(type: Type): ReadonlyArray<Type> {
			const cached = unionTypesCache.get(type);
			if (cached !== undefined) return cached;
			const resolved = isUnionType(type) ? unionConstituents(type) : [type];
			unionTypesCache.set(type, resolved);
			return resolved;
		}

		function isEquivalentType(left: Type, right: Type): boolean {
			if (left === right) return true;
			return checker.isTypeAssignableTo(left, right) && checker.isTypeAssignableTo(right, left);
		}

		function getEnumSymbolFromType(type: Type): TypeScriptSymbol | undefined {
			const cached = enumSymbolCache.get(type);
			if (cached !== undefined) return cached === false ? undefined : cached;

			const symbol = type.aliasSymbol ?? type.getSymbol();
			if (symbol === undefined) {
				enumSymbolCache.set(type, false);
				return undefined;
			}

			const resolved = resolveAliasSymbol(checker, symbol);

			if ((resolved.flags & (SymbolFlags.Enum | SymbolFlags.ConstEnum)) !== 0) {
				enumSymbolCache.set(type, resolved);
				return resolved;
			}

			if ((resolved.flags & SymbolFlags.EnumMember) !== 0) {
				const declarations = resolved.declarations ?? [];
				for (const declaration of declarations) {
					if (!isEnumMember(declaration)) continue;
					const { parent } = declaration;
					if (!isEnumDeclaration(parent)) continue;
					const parentSymbol = checker.getSymbolAtLocation(parent.name);
					if (parentSymbol) {
						enumSymbolCache.set(type, parentSymbol);
						return parentSymbol;
					}
				}
			}

			enumSymbolCache.set(type, false);
			return undefined;
		}

		function getEnumMemberValue(memberSymbol: TypeScriptSymbol): string | number | undefined {
			const { valueDeclaration } = memberSymbol;
			if (!valueDeclaration) return undefined;
			const memberType = checker.getTypeOfSymbolAtLocation(memberSymbol, valueDeclaration);
			return memberType.isStringLiteral() || memberType.isNumberLiteral() ? memberType.value : undefined;
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

		function getEnumCandidates(contextualType: Type): ReadonlyArray<EnumCandidate> | undefined {
			const cached = enumCandidateCache.get(contextualType);
			if (cached !== undefined) return cached === false ? undefined : cached;

			const unionTypes = getUnionTypesCached(contextualType);
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

			if (candidates.length === 0) {
				enumCandidateCache.set(contextualType, false);
				return undefined;
			}

			enumCandidateCache.set(contextualType, candidates);
			return candidates;
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
				if (!memberName) continue;
				if (resolvedSymbol && resolvedSymbol !== candidate.enumSymbol) return undefined;
				resolvedSymbol = candidate.enumSymbol;
				resolvedMember = memberName;
			}

			if (!(resolvedSymbol && resolvedMember)) return undefined;
			return { enumSymbol: resolvedSymbol, memberName: resolvedMember };
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
				let index = 0;
				for (const param of typeParameters) map.set(param.name.text, index++);
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
					const parameterMap = getTypeParameterMap(aliasSymbol);
					const index = parameterMap?.get(typeName.text);
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
				if (!(isTypeAliasDeclaration(declaration) && isMappedTypeNode(declaration.type))) continue;
				const { constraint } = declaration.type.typeParameter;
				if (!constraint) continue;

				const resolved = resolveMappedTypeConstraint(aliasSymbol, aliasTypeArguments, constraint);
				if (resolved) return resolved;
			}

			return undefined;
		}

		function getAliasTargetType(type: Type): Type | undefined {
			const { aliasSymbol } = type;
			if (!aliasSymbol) return undefined;

			const cached = aliasTargetCache.get(aliasSymbol);
			if (cached !== undefined) return cached === false ? undefined : cached;

			const declarations = aliasSymbol.declarations ?? [];
			for (const declaration of declarations) {
				if (!isTypeAliasDeclaration(declaration)) continue;
				const { typeParameters } = declaration;
				if (typeParameters && typeParameters.length > 0) {
					aliasTargetCache.set(aliasSymbol, false);
					return undefined;
				}
				const resolved = checker.getTypeFromTypeNode(declaration.type);
				aliasTargetCache.set(aliasSymbol, resolved);
				return resolved;
			}

			aliasTargetCache.set(aliasSymbol, false);
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

			const aliasTarget = getAliasTargetType(type);
			if (aliasTarget && aliasTarget !== type) {
				const resolvedAlias = getObjectKeyTypeInternal(aliasTarget, visited);
				if (resolvedAlias) return resolvedAlias;
			}

			const unionTypes = getUnionTypesCached(type);
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
			if (aliasSymbol && aliasTypeArguments?.length === 1) {
				const aliasName = aliasSymbol.getName();
				if (SINGLE_ARGUMENT_OBJECT_WRAPPERS.has(aliasName)) {
					const [firstArgument] = aliasTypeArguments;
					if (firstArgument) {
						const unwrapped = getObjectKeyTypeInternal(firstArgument, visited);
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
			if (!parent || parent.type === AST_NODE_TYPES.TSLiteralType) return undefined;

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

		function shouldSkipLiteral(node: TSESTree.Literal): boolean {
			if (isPropertyKeyLiteral(node)) return true;
			if (node.parent?.type === AST_NODE_TYPES.TSLiteralType) return true;
			if (node.parent?.type === AST_NODE_TYPES.TSImportType) return true;
			if (isModuleSpecifierLiteral(node)) return true;
			if (isDirectiveLiteral(node)) return true;
			return false;
		}

		function shouldCheckEnumValue(value: string | number): boolean {
			if (!shouldUseEnumIndex) return true;
			return typeof value === "string"
				? enumValueIndex.stringSet.has(value)
				: enumValueIndex.numberSet.has(value);
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
			if (!shouldCheckEnumValue(keyValue.value)) return;

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
				if (shouldSkipLiteral(node)) return;
				if (!shouldCheckEnumValue(value)) return;
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
