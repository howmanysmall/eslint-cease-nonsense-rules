import { extname } from "node:path";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";

import { createRule } from "../utilities/create-rule";
import { discoverLocalComponent, inspectLocalComponentFile } from "../utilities/local-component-discovery";
import { resolveRelativeImport } from "../utilities/resolve-import";

import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

type MessageIds = "preferContextStack";
type Options = [];

const CONTEXT_STACK_COMPONENT = {
	componentName: "ContextStack",
	fileNames: ["context-stack"],
	markers: ["providers"],
} as const;
const JSX_EXTENSIONS = new Set([".jsx", ".tsx"]);

function getImportedName(specifier: TSESTree.ImportSpecifier): string | undefined {
	if (specifier.imported.type === AST_NODE_TYPES.Identifier) return specifier.imported.name;
	if (typeof specifier.imported.value === "string") return specifier.imported.value;
	return undefined;
}

function isProviderElement(node: TSESTree.JSXElement): boolean {
	return (
		node.openingElement.name.type === AST_NODE_TYPES.JSXMemberExpression &&
		node.openingElement.name.property.name === "Provider"
	);
}

function getMeaningfulChildren(node: TSESTree.JSXElement): ReadonlyArray<TSESTree.JSXChild> {
	return node.children.filter((child) => {
		if (child.type === AST_NODE_TYPES.JSXText) return child.value.trim() !== "";
		if (child.type === AST_NODE_TYPES.JSXExpressionContainer) {
			return child.expression.type !== AST_NODE_TYPES.JSXEmptyExpression;
		}

		return true;
	});
}

function isNestedProviderInChain(node: TSESTree.JSXElement): boolean {
	const { parent } = node;
	if (parent?.type !== AST_NODE_TYPES.JSXElement) return false;
	if (!isProviderElement(parent)) return false;

	const meaningfulChildren = getMeaningfulChildren(parent);
	return meaningfulChildren.length === 1 && meaningfulChildren[0] === node;
}

function collectProviderChain(node: TSESTree.JSXElement): ReadonlyArray<TSESTree.JSXElement> | undefined {
	if (!isProviderElement(node)) return undefined;

	const chain = [node];
	let current = node;

	while (true) {
		const meaningfulChildren = getMeaningfulChildren(current);
		if (meaningfulChildren.length !== 1) break;

		const [child] = meaningfulChildren;
		if (child?.type !== AST_NODE_TYPES.JSXElement) break;
		if (!isProviderElement(child)) break;

		chain.push(child);
		current = child;
	}

	return chain.length > 1 ? chain : undefined;
}

function hasOnlySafeWrapperChildren(node: TSESTree.JSXElement, nextProvider: TSESTree.JSXElement): boolean {
	let sawNextProvider = false;

	for (const child of node.children) {
		if (child === nextProvider) {
			sawNextProvider = true;
			continue;
		}

		if (child.type === AST_NODE_TYPES.JSXText && child.value.trim() === "") continue;
		return false;
	}

	return sawNextProvider;
}

function isSafelyFixableProviderChain(chain: ReadonlyArray<TSESTree.JSXElement>): boolean {
	for (const [index, provider] of chain.entries()) {
		const nextProvider = chain[index + 1];
		if (nextProvider === undefined) continue;
		if (!hasOnlySafeWrapperChildren(provider, nextProvider)) return false;
	}

	return true;
}

function getSelfClosingProviderText(element: TSESTree.JSXElement, sourceCode: TSESLint.SourceCode): string | undefined {
	const openingText = sourceCode.getText(element.openingElement);
	if (element.openingElement.selfClosing) return openingText;
	if (!openingText.endsWith(">")) return undefined;
	return `${openingText.slice(0, -1)} />`;
}

function getContextStackReplacement(
	componentName: string,
	chain: ReadonlyArray<TSESTree.JSXElement>,
	sourceCode: TSESLint.SourceCode,
): string | undefined {
	const providers = new Array<string>();
	let size = 0;
	for (const provider of chain) {
		const providerText = getSelfClosingProviderText(provider, sourceCode);
		if (providerText === undefined) return undefined;
		providers[size++] = providerText;
	}

	const innermostProvider = chain.at(-1);
	if (innermostProvider === undefined || innermostProvider.closingElement === null) return undefined;

	const children = sourceCode.text.slice(
		innermostProvider.openingElement.range[1],
		innermostProvider.closingElement.range[0],
	);
	return `<${componentName} providers={[${providers.join(", ")}]}>${children}</${componentName}>`;
}

const preferContextStack = createRule<Options, MessageIds>({
	create(context) {
		const filename = context.filename ?? "";
		const discoveredContextStack =
			filename === "" ? { found: false as const } : discoverLocalComponent(filename, CONTEXT_STACK_COMPONENT);
		const contextStackIdentifiers = new Set<string>();

		return {
			ImportDeclaration(node): void {
				const importSource = node.source.value;
				if (typeof importSource !== "string" || !importSource.startsWith(".") || filename === "") return;

				const resolved = resolveRelativeImport(importSource, filename);
				if (!resolved.found) return;

				const inspection = inspectLocalComponentFile(resolved.path, CONTEXT_STACK_COMPONENT);
				if (!inspection.matches) return;

				for (const specifier of node.specifiers) {
					if (specifier.type === AST_NODE_TYPES.ImportDefaultSpecifier) {
						contextStackIdentifiers.add(specifier.local.name);
						continue;
					}

					if (specifier.type !== AST_NODE_TYPES.ImportSpecifier) continue;
					if (getImportedName(specifier) !== "ContextStack") continue;

					contextStackIdentifiers.add(specifier.local.name);
				}
			},

			JSXElement(node): void {
				if (isNestedProviderInChain(node)) return;

				const providerChain = collectProviderChain(node);
				if (providerChain === undefined) return;
				if (contextStackIdentifiers.size === 0 && !discoveredContextStack.found) return;

				const canFix =
					JSX_EXTENSIONS.has(extname(filename)) &&
					contextStackIdentifiers.size === 1 &&
					isSafelyFixableProviderChain(providerChain);
				const [contextStackIdentifier] = [...contextStackIdentifiers];
				const replacement =
					canFix && contextStackIdentifier !== undefined
						? getContextStackReplacement(contextStackIdentifier, providerChain, context.sourceCode)
						: undefined;

				if (replacement !== undefined) {
					context.report({
						fix: (fixer) => fixer.replaceText(node, replacement),
						messageId: "preferContextStack",
						node,
					});
					return;
				}

				context.report({
					messageId: "preferContextStack",
					node,
				});
			},
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description: "Prefer a local ContextStack component over directly nesting multiple context providers.",
		},
		fixable: "code",
		messages: {
			preferContextStack:
				"Use the local `ContextStack` component instead of nesting multiple context providers directly.",
		},
		schema: [],
		type: "suggestion",
	},
	name: "prefer-context-stack",
});

export default preferContextStack;
