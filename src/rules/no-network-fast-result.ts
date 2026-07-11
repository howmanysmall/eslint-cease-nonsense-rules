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

function typeArgumentsContainFastResult(
	typeArguments: ReadonlyArray<TypeNode> | undefined,
	checker: TypeChecker,
	seenSymbols: Set<TypeScriptSymbol>,
): boolean {
	return typeArguments?.some((typeArgument) => containsFastResult(typeArgument, checker, seenSymbols)) === true;
}

function containsFastResult(
	node: TypeNode,
	checker: TypeChecker,
	seenSymbols: Set<TypeScriptSymbol> = new Set<TypeScriptSymbol>(),
): boolean {
	if (isFastResultReference(node, checker)) return true;

	if (isTypeReferenceNode(node)) {
		const { typeArguments } = node;
		if (typeArgumentsContainFastResult(typeArguments, checker, seenSymbols)) {
			return true;
		}

		const symbol = getResolvedSymbol(checker, node.typeName);
		if (symbol !== undefined && !seenSymbols.has(symbol)) {
			seenSymbols.add(symbol);
			for (const declaration of symbol.declarations ?? []) {
				if (isTypeAliasDeclaration(declaration) && containsFastResult(declaration.type, checker, seenSymbols)) {
					return true;
				}
			}
		}
	}

	return containsFastResultInChildren(node, checker, seenSymbols);
}

function containsFastResultInChildren(
	node: TypeScriptNode,
	checker: TypeChecker,
	seenSymbols: Set<TypeScriptSymbol>,
): boolean {
	let contains = false;
	node.forEachChild((child) => {
		if (contains) return;
		contains = isTypeNode(child)
			? containsFastResult(child, checker, seenSymbols)
			: containsFastResultInChildren(child, checker, seenSymbols);
	});
	return contains;
}

function functionTypeContainsFastResult(node: TypeScriptNode, checker: TypeChecker, checkParameters: boolean): boolean {
	if (isFunctionTypeNode(node) || isMethodSignature(node)) {
		if (node.type !== undefined && containsFastResult(node.type, checker)) return true;
		return (
			checkParameters &&
			node.parameters.some(
				(parameter) => parameter.type !== undefined && containsFastResult(parameter.type, checker),
			)
		);
	}

	return false;
}

function contractContainsFastResult(
	node: TypeScriptNode,
	checker: TypeChecker,
	checkParameters: boolean,
	seenSymbols: Set<TypeScriptSymbol> = new Set<TypeScriptSymbol>(),
): boolean {
	if (functionTypeContainsFastResult(node, checker, checkParameters)) return true;

	if (isTypeReferenceNode(node)) {
		const symbol = getResolvedSymbol(checker, node.typeName);
		if (symbol !== undefined && !seenSymbols.has(symbol)) {
			seenSymbols.add(symbol);
			for (const declaration of symbol.declarations ?? []) {
				if (contractContainsFastResult(declaration, checker, checkParameters, seenSymbols)) return true;
			}
		}
	}

	if (isInterfaceDeclaration(node) || isTypeLiteralNode(node)) {
		return node.members.some((member) => {
			if (functionTypeContainsFastResult(member, checker, checkParameters)) return true;
			return isPropertySignature(member) && member.type !== undefined
				? contractContainsFastResult(member.type, checker, checkParameters, seenSymbols)
				: false;
		});
	}

	let contains = false;
	node.forEachChild((child) => {
		if (contains) return;
		contains = contractContainsFastResult(child, checker, checkParameters, seenSymbols);
	});
	return contains;
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
					if (!contractContainsFastResult(tsTypeArgument, checker, options.checkParameters)) continue;

					context.report({
						messageId: "noNetworkFastResult",
						node: typeArgument,
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
				"Disallow FastResult in Flamework RPC contracts because LuaTuples cannot cross the network boundary.",
		},
		messages: {
			noNetworkFastResult:
				"FastResult is a LuaTuple and cannot cross a Flamework network boundary. Return a serializable response instead.",
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
