import { createRule } from "$utilities/create-rule";
import { AST_NODE_TYPES, ESLintUtils } from "@typescript-eslint/utils";
import {
	isFunctionTypeNode,
	isInterfaceDeclaration,
	isMethodSignature,
	isModuleDeclaration,
	isPropertyAccessExpression,
	isPropertySignature,
	isStringLiteral,
	isTypeNode,
	isTypeAliasDeclaration,
	isTypeLiteralNode,
	isTypeReferenceNode,
	SymbolFlags,
} from "typescript";

import type { TSESTree } from "@typescript-eslint/utils";
import type { Node as TypeScriptNode, Symbol as TypeScriptSymbol, TypeChecker, TypeNode } from "typescript";

/** Configuration options for the no-network-fast-result rule. */
export interface NoNetworkFastResultOptions {
	/** Check FastResult occurrences in RPC parameters as well as response types. @default false */
	readonly checkParameters?: boolean;
}

type Options = [NoNetworkFastResultOptions?];
type MessageIds = "noNetworkFastResult";

const DEFAULT_OPTIONS: Required<NoNetworkFastResultOptions> = {
	checkParameters: false,
};

const NETWORKING_PACKAGE_PATH = "/@flamework/networking/";
const NETWORKING_PACKAGE_NAME = "@flamework/networking";

function getResolvedSymbol(checker: TypeChecker, node: TypeScriptNode): TypeScriptSymbol | undefined {
	const symbol = checker.getSymbolAtLocation(node);
	if (symbol === undefined) return undefined;

	return symbol.flags === SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
}

function isFastResultReference(node: TypeNode, checker: TypeChecker): boolean {
	if (!isTypeReferenceNode(node)) return false;

	return getResolvedSymbol(checker, node.typeName)?.getName() === "FastResult";
}

function findFastResultInTypeArguments(
	typeArguments: ReadonlyArray<TypeNode> | undefined,
	checker: TypeChecker,
	seenSymbols: Set<TypeScriptSymbol>,
): TypeNode | undefined {
	if (typeArguments === undefined) return undefined;

	for (const typeArgument of typeArguments) {
		const fastResult = findFastResult(typeArgument, checker, seenSymbols);
		if (fastResult !== undefined) return fastResult;
	}

	return undefined;
}

function findFastResult(
	node: TypeNode,
	checker: TypeChecker,
	seenSymbols: Set<TypeScriptSymbol> = new Set<TypeScriptSymbol>(),
): TypeNode | undefined {
	if (isFastResultReference(node, checker)) return node;
	if (!isTypeReferenceNode(node)) return findFastResultInChildren(node, checker, seenSymbols);

	const typeArgumentFastResult = findFastResultInTypeArguments(node.typeArguments, checker, seenSymbols);
	if (typeArgumentFastResult !== undefined) return typeArgumentFastResult;

	const aliasFastResult = findFastResultInAlias(getResolvedSymbol(checker, node.typeName), checker, seenSymbols);
	return aliasFastResult ?? findFastResultInChildren(node, checker, seenSymbols);
}

function findFastResultInAlias(
	symbol: TypeScriptSymbol | undefined,
	checker: TypeChecker,
	seenSymbols: Set<TypeScriptSymbol>,
): TypeNode | undefined {
	if (symbol === undefined || seenSymbols.has(symbol)) return undefined;

	seenSymbols.add(symbol);
	for (const declaration of symbol.declarations ?? []) {
		if (!isTypeAliasDeclaration(declaration)) continue;

		const fastResult = findFastResult(declaration.type, checker, seenSymbols);
		if (fastResult !== undefined) return fastResult;
	}

	return undefined;
}

function findFastResultInChildren(
	node: TypeScriptNode,
	checker: TypeChecker,
	seenSymbols: Set<TypeScriptSymbol>,
): TypeNode | undefined {
	let fastResult: TypeNode | undefined;
	node.forEachChild((child) => {
		if (fastResult !== undefined) return;
		fastResult = isTypeNode(child)
			? findFastResult(child, checker, seenSymbols)
			: findFastResultInChildren(child, checker, seenSymbols);
	});
	return fastResult;
}

function findFastResultInFunctionType(
	node: TypeScriptNode,
	checker: TypeChecker,
	checkParameters: boolean,
): TypeNode | undefined {
	if (!(isFunctionTypeNode(node) || isMethodSignature(node))) return undefined;

	if (node.type !== undefined) {
		const responseFastResult = findFastResult(node.type, checker);
		if (responseFastResult !== undefined) return responseFastResult;
	}

	if (!checkParameters) return undefined;

	for (const parameter of node.parameters) {
		if (parameter.type === undefined) continue;

		const parameterFastResult = findFastResult(parameter.type, checker);
		if (parameterFastResult !== undefined) return parameterFastResult;
	}

	return undefined;
}

function findFastResultInContract(
	node: TypeScriptNode,
	checker: TypeChecker,
	checkParameters: boolean,
	seenSymbols: Set<TypeScriptSymbol> = new Set<TypeScriptSymbol>(),
): TypeNode | undefined {
	const functionFastResult = findFastResultInFunctionType(node, checker, checkParameters);
	if (functionFastResult !== undefined) return functionFastResult;

	const referenceFastResult = findFastResultInContractReference(node, checker, checkParameters, seenSymbols);
	if (referenceFastResult !== undefined) return referenceFastResult;

	const memberFastResult = findFastResultInContractMembers(node, checker, checkParameters, seenSymbols);
	if (memberFastResult !== undefined) return memberFastResult;

	return findFastResultInContractChildren(node, checker, checkParameters, seenSymbols);
}

function findFastResultInContractReference(
	node: TypeScriptNode,
	checker: TypeChecker,
	checkParameters: boolean,
	seenSymbols: Set<TypeScriptSymbol>,
): TypeNode | undefined {
	if (!isTypeReferenceNode(node)) return undefined;

	const symbol = getResolvedSymbol(checker, node.typeName);
	if (symbol === undefined || seenSymbols.has(symbol)) return undefined;

	seenSymbols.add(symbol);
	for (const declaration of symbol.declarations ?? []) {
		const fastResult = findFastResultInContract(declaration, checker, checkParameters, seenSymbols);
		if (fastResult !== undefined) return fastResult;
	}

	return undefined;
}

function findFastResultInContractMembers(
	node: TypeScriptNode,
	checker: TypeChecker,
	checkParameters: boolean,
	seenSymbols: Set<TypeScriptSymbol>,
): TypeNode | undefined {
	if (!(isInterfaceDeclaration(node) || isTypeLiteralNode(node))) return undefined;

	for (const member of node.members) {
		const functionFastResult = findFastResultInFunctionType(member, checker, checkParameters);
		if (functionFastResult !== undefined) return functionFastResult;
		if (!isPropertySignature(member) || member.type === undefined) continue;

		const propertyFastResult = findFastResultInContract(member.type, checker, checkParameters, seenSymbols);
		if (propertyFastResult !== undefined) return propertyFastResult;
	}

	return undefined;
}

function findFastResultInContractChildren(
	node: TypeScriptNode,
	checker: TypeChecker,
	checkParameters: boolean,
	seenSymbols: Set<TypeScriptSymbol>,
): TypeNode | undefined {
	let fastResult: TypeNode | undefined;
	node.forEachChild((child) => {
		if (fastResult !== undefined) return;
		fastResult = findFastResultInContract(child, checker, checkParameters, seenSymbols);
	});
	return fastResult;
}

function isNetworkingCreateFunction(
	node: TSESTree.CallExpression,
	checker: TypeChecker,
	services: ReturnType<typeof ESLintUtils.getParserServices>,
	networkingIdentifiers: ReadonlySet<string>,
): boolean {
	if (
		node.callee.type !== AST_NODE_TYPES.MemberExpression ||
		node.callee.computed ||
		node.callee.object.type !== AST_NODE_TYPES.Identifier ||
		node.callee.property.type !== AST_NODE_TYPES.Identifier ||
		node.callee.property.name !== "createFunction"
	) {
		return false;
	}

	const callee = services.esTreeNodeToTSNodeMap.get(node.callee);
	if (!isPropertyAccessExpression(callee) || callee.name.text !== "createFunction") return false;

	if (networkingIdentifiers.has(node.callee.object.name)) return true;

	const symbol = getResolvedSymbol(checker, callee.name);
	return (symbol?.declarations ?? []).some(isNetworkingPackageDeclaration);
}

function isNetworkingPackageDeclaration(declaration: TypeScriptNode): boolean {
	if (declaration.getSourceFile().fileName.replaceAll("\\", "/").includes(NETWORKING_PACKAGE_PATH)) return true;

	let { parent } = declaration;
	while (parent !== undefined) {
		if (
			isModuleDeclaration(parent) &&
			isStringLiteral(parent.name) &&
			parent.name.text === NETWORKING_PACKAGE_NAME
		) {
			return true;
		}

		const { parent: nextParent } = parent;
		parent = nextParent;
	}

	return false;
}

const noNetworkFastResult = createRule<Options, MessageIds>({
	create(context) {
		const options = { ...DEFAULT_OPTIONS, ...context.options[0] };
		const services = ESLintUtils.getParserServices(context);
		const checker = services.program.getTypeChecker();
		const networkingIdentifiers = new Set<string>();

		return {
			CallExpression(node): void {
				if (
					!isNetworkingCreateFunction(node, checker, services, networkingIdentifiers) ||
					node.typeArguments === undefined
				) {
					return;
				}

				for (const typeArgument of node.typeArguments.params) {
					const tsTypeArgument = services.esTreeNodeToTSNodeMap.get(typeArgument);
					const fastResult = findFastResultInContract(tsTypeArgument, checker, options.checkParameters);
					if (fastResult === undefined) continue;

					context.report({
						messageId: "noNetworkFastResult",
						node: services.tsNodeToESTreeNodeMap.get(fastResult) ?? typeArgument,
					});
				}
			},
			ImportDeclaration(node): void {
				if (node.source.value !== NETWORKING_PACKAGE_NAME) return;

				for (const specifier of node.specifiers) {
					if (specifier.type === AST_NODE_TYPES.ImportNamespaceSpecifier) {
						networkingIdentifiers.add(specifier.local.name);
						continue;
					}

					if (
						specifier.type === AST_NODE_TYPES.ImportSpecifier &&
						specifier.imported.type === AST_NODE_TYPES.Identifier &&
						specifier.imported.name === "Networking"
					) {
						networkingIdentifiers.add(specifier.local.name);
					}
				}
			},
		};
	},
	meta: {
		defaultOptions: [DEFAULT_OPTIONS],
		docs: {
			description:
				"Disallow FastResult in Flamework RPC contracts because LuaTuples should not cross the network boundary.",
		},
		messages: {
			noNetworkFastResult:
				"FastResult is a LuaTuple and should not cross a Flamework network boundary. Return a serializable response instead.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					checkParameters: {
						description: "Also disallow FastResult in RPC parameter types.",
						type: "boolean",
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
	name: "no-network-fast-result",
});

export default noNetworkFastResult;
