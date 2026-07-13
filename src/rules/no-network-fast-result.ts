import { createRule } from "$utilities/create-rule";
import { AST_NODE_TYPES, ESLintUtils } from "@typescript-eslint/utils";
import {
	isFunctionTypeNode,
	isInterfaceDeclaration,
	isMethodSignature,
	isPropertyAccessExpression,
	isPropertySignature,
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

const NETWORKING_PACKAGE_NAME = "@flamework/networking";

interface FastResultCollectionState {
	readonly checker: TypeChecker;
	readonly results: Array<TypeNode>;
	readonly seenNodes: Set<TypeNode>;
	readonly seenSymbols: Set<TypeScriptSymbol>;
}

function getResolvedSymbol(checker: TypeChecker, node: TypeScriptNode): TypeScriptSymbol | undefined {
	const symbol = checker.getSymbolAtLocation(node);
	if (symbol === undefined) return undefined;

	return symbol.flags === SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
}

function isFastResultReference(node: TypeNode, checker: TypeChecker): boolean {
	if (!isTypeReferenceNode(node)) return false;

	return getResolvedSymbol(checker, node.typeName)?.getName() === "FastResult";
}

function addFastResult(node: TypeNode, state: FastResultCollectionState): void {
	if (state.seenNodes.has(node)) return;

	state.seenNodes.add(node);
	state.results.push(node);
}

function collectFastResultsInTypeArguments(
	typeArguments: ReadonlyArray<TypeNode> | undefined,
	state: FastResultCollectionState,
): void {
	if (typeArguments === undefined) return;

	for (const typeArgument of typeArguments) {
		collectFastResults(typeArgument, state);
	}
}

function collectFastResults(node: TypeNode, state: FastResultCollectionState): void {
	if (isFastResultReference(node, state.checker)) {
		addFastResult(node, state);
		return;
	}

	if (!isTypeReferenceNode(node)) {
		collectFastResultsInChildren(node, state);
		return;
	}

	collectFastResultsInTypeArguments(node.typeArguments, state);
	collectFastResultsInAlias(getResolvedSymbol(state.checker, node.typeName), state);
	collectFastResultsInChildren(node, state);
}

function collectFastResultsInAlias(symbol: TypeScriptSymbol | undefined, state: FastResultCollectionState): void {
	if (symbol === undefined || state.seenSymbols.has(symbol)) return;

	state.seenSymbols.add(symbol);
	for (const declaration of symbol.declarations ?? []) {
		if (!isTypeAliasDeclaration(declaration)) continue;

		collectFastResults(declaration.type, state);
	}
}

function collectFastResultsInChildren(node: TypeScriptNode, state: FastResultCollectionState): void {
	node.forEachChild((child) => {
		if (isTypeNode(child)) {
			collectFastResults(child, state);
		} else {
			collectFastResultsInChildren(child, state);
		}
	});
}

function collectFastResultsInFunctionType(
	node: TypeScriptNode,
	checkParameters: boolean,
	state: FastResultCollectionState,
): void {
	if (!(isFunctionTypeNode(node) || isMethodSignature(node))) return;

	if (node.type !== undefined) {
		collectFastResults(node.type, {
			...state,
			seenSymbols: new Set<TypeScriptSymbol>(),
		});
	}

	if (!checkParameters) return;

	for (const parameter of node.parameters) {
		if (parameter.type === undefined) continue;

		collectFastResults(parameter.type, {
			...state,
			seenSymbols: new Set<TypeScriptSymbol>(),
		});
	}
}

function collectFastResultsInContract(
	node: TypeScriptNode,
	state: FastResultCollectionState,
	checkParameters: boolean,
): void {
	if (isFunctionTypeNode(node) || isMethodSignature(node)) {
		collectFastResultsInFunctionType(node, checkParameters, state);
		return;
	}

	if (isTypeReferenceNode(node)) {
		collectFastResultsInContractReference(node, state, checkParameters);
		return;
	}

	if (isInterfaceDeclaration(node) || isTypeLiteralNode(node)) {
		collectFastResultsInContractMembers(node, state, checkParameters);
		return;
	}

	collectFastResultsInContractChildren(node, state, checkParameters);
}

function collectFastResultsInContractReference(
	node: TypeScriptNode,
	state: FastResultCollectionState,
	checkParameters: boolean,
): void {
	if (!isTypeReferenceNode(node)) return;

	const symbol = getResolvedSymbol(state.checker, node.typeName);
	if (symbol === undefined || state.seenSymbols.has(symbol)) return;

	state.seenSymbols.add(symbol);
	for (const declaration of symbol.declarations ?? []) {
		collectFastResultsInContract(declaration, state, checkParameters);
	}
}

function collectFastResultsInContractMembers(
	node: TypeScriptNode,
	state: FastResultCollectionState,
	checkParameters: boolean,
): void {
	if (!(isInterfaceDeclaration(node) || isTypeLiteralNode(node))) return;

	for (const member of node.members) {
		collectFastResultsInFunctionType(member, checkParameters, state);
		if (!isPropertySignature(member) || member.type === undefined) continue;

		collectFastResultsInContract(member.type, state, checkParameters);
	}
}

function collectFastResultsInContractChildren(
	node: TypeScriptNode,
	state: FastResultCollectionState,
	checkParameters: boolean,
): void {
	node.forEachChild((child) => {
		collectFastResultsInContract(child, state, checkParameters);
	});
}

function collectAllFastResultsInContract(
	node: TypeScriptNode,
	checker: TypeChecker,
	checkParameters: boolean,
): Array<TypeNode> {
	const state: FastResultCollectionState = {
		checker,
		results: [],
		seenNodes: new Set<TypeNode>(),
		seenSymbols: new Set<TypeScriptSymbol>(),
	};

	collectFastResultsInContract(node, state, checkParameters);
	return state.results;
}

function isNetworkingCreateFunction(
	node: TSESTree.CallExpression,
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

	return networkingIdentifiers.has(node.callee.object.name);
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
					!isNetworkingCreateFunction(node, services, networkingIdentifiers) ||
					node.typeArguments === undefined
				) {
					return;
				}

				for (const typeArgument of node.typeArguments.params) {
					const tsTypeArgument = services.esTreeNodeToTSNodeMap.get(typeArgument);
					const fastResults = collectAllFastResultsInContract(
						tsTypeArgument,
						checker,
						options.checkParameters,
					);

					for (const fastResult of fastResults) {
						context.report({
							messageId: "noNetworkFastResult",
							node: services.tsNodeToESTreeNodeMap.get(fastResult) ?? typeArgument,
						});
					}
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
						(specifier.imported.name === "Networking" || specifier.imported.name === "createNetworking")
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
