import { ScopeType } from "@typescript-eslint/scope-manager";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES, AST_TOKEN_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utilities/create-rule";

type MessageIds = "unusedImport";

export interface NoUnusedImportsOptions {
	readonly checkJSDoc?: boolean;
}

type Options = [NoUnusedImportsOptions?];

const JSDOC_PATTERN = new RegExp(
	`(?:@(?:link|linkcode|linkplain|see)\\s+\\{?\\w+\\b\\}?)|` +
		`(?:\\{@(?:link|linkcode|linkplain|see)\\s+\\w+\\b\\})|` +
		`(?:[@{](?:type|typedef|param|returns?|template|augments|extends|implements)\\s+[^}]*\\b\\w+\\b)`,
	"u",
);

const JSDOC_IDENTIFIER_PATTERN = new RegExp(
	`(?:@(?:link|linkcode|linkplain|see)\\s+\\{?(\\w+)\\b\\}?)|` +
		`(?:\\{@(?:link|linkcode|linkplain|see)\\s+(\\w+)\\b\\})|` +
		`(?:[@{](?:type|typedef|param|returns?|template|augments|extends|implements)\\s+[^}]*\\b(\\w+)\\b)`,
	"gu",
);

type AnyImportSpecifier =
	| TSESTree.ImportDefaultSpecifier
	| TSESTree.ImportNamespaceSpecifier
	| TSESTree.ImportSpecifier;

function isImportSpecifier(node: TSESTree.Node): node is AnyImportSpecifier {
	return (
		node.type === AST_NODE_TYPES.ImportDefaultSpecifier ||
		node.type === AST_NODE_TYPES.ImportNamespaceSpecifier ||
		node.type === AST_NODE_TYPES.ImportSpecifier
	);
}

function getImportIdentifierName(specifier: AnyImportSpecifier): string | undefined {
	if (specifier.type === AST_NODE_TYPES.ImportSpecifier) return specifier.local.name;
	return specifier.local.name;
}

function collectJSDocIdentifiers(sourceCode: TSESLint.SourceCode): Set<string> {
	const identifiers = new Set<string>();
	const comments = sourceCode.getAllComments();

	for (const comment of comments) {
		if (comment.type !== AST_TOKEN_TYPES.Block) continue;

		const { value } = comment;
		if (!JSDOC_PATTERN.test(value)) continue;

		JSDOC_IDENTIFIER_PATTERN.lastIndex = 0;
		for (const match of value.matchAll(JSDOC_IDENTIFIER_PATTERN)) {
			const identifier = match[1] ?? match[2] ?? match[3];
			if (identifier) {
				identifiers.add(identifier);
			}
		}
	}

	return identifiers;
}

export default createRule<Options, MessageIds>({
	create(context) {
		const [{ checkJSDoc = true } = {}] = context.options;
		const { sourceCode } = context;
		const jsdocIdentifiers = checkJSDoc ? collectJSDocIdentifiers(sourceCode) : new Set<string>();

		const imports = new Array<{
			identifierName: string;
			parent: TSESTree.ImportDeclaration;
			specifier: TSESTree.ImportDefaultSpecifier | TSESTree.ImportNamespaceSpecifier | TSESTree.ImportSpecifier;
		}>();

		function createFix(
			parent: TSESTree.ImportDeclaration,
			specifierNode: AnyImportSpecifier,
		): (fixer: TSESLint.RuleFixer) => TSESLint.RuleFix | ReadonlyArray<TSESLint.RuleFix> {
			return (fixer: TSESLint.RuleFixer): TSESLint.RuleFix | ReadonlyArray<TSESLint.RuleFix> => {
				if (parent.specifiers.length === 1) {
					const nextToken = sourceCode.getTokenAfter(parent, {
						includeComments: true,
					});
					const newLinesBetween = nextToken ? nextToken.loc.start.line - parent.loc.start.line : 0;
					const endOfReplaceRange = nextToken ? nextToken.range[0] : parent.range[1];
					const count = Math.max(0, newLinesBetween - 1);

					return [
						fixer.remove(parent),
						fixer.replaceTextRange([parent.range[1], endOfReplaceRange], "\n".repeat(count)),
					] as ReadonlyArray<TSESLint.RuleFix>;
				}

				if (specifierNode !== parent.specifiers.at(-1)) {
					const comma = sourceCode.getTokenAfter(specifierNode, {
						filter: (token) => token.value === ",",
					});
					const prevNode = sourceCode.getTokenBefore(specifierNode);

					if (comma && prevNode) {
						return [
							fixer.removeRange([prevNode.range[1], specifierNode.range[0]]),
							fixer.remove(specifierNode),
							fixer.remove(comma),
						];
					}
				}

				const prevToken = sourceCode.getTokenBefore(specifierNode, {
					filter: (token) => token.value === ",",
				});

				if (prevToken) return fixer.removeRange([prevToken.range[0], specifierNode.range[1]]);
				return fixer.remove(specifierNode);
			};
		}

		return {
			ImportDeclaration(node): void {
				for (const specifier of node.specifiers) {
					if (!isImportSpecifier(specifier)) continue;

					const identifierName = getImportIdentifierName(specifier);
					if (identifierName === undefined) continue;

					imports.push({
						identifierName,
						parent: node,
						specifier,
					});
				}
			},

			"Program:exit"(): void {
				const programScope = sourceCode.getScope(sourceCode.ast);
				const moduleScope =
					programScope.type === ScopeType.module
						? programScope
						: (programScope.childScopes.find((scope) => scope.type === ScopeType.module) ?? programScope);

				for (const { identifierName, parent, specifier: specifierNode } of imports) {
					const variable = moduleScope.set.get(identifierName);
					if (variable && variable.references.length > 0) continue;

					if (checkJSDoc && jsdocIdentifiers.has(identifierName)) continue;

					context.report({
						data: { identifierName },
						fix: createFix(parent, specifierNode),
						messageId: "unusedImport",
						node: specifierNode,
					});
				}
			},
		};
	},
	defaultOptions: [{ checkJSDoc: true }],
	meta: {
		docs: {
			description: "Disallow unused imports",
		},
		fixable: "code",
		messages: {
			unusedImport: "Import '{{identifierName}}' is defined but never used.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					checkJSDoc: {
						default: true,
						description: "Check if imports are referenced in JSDoc comments",
						type: "boolean",
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
	name: "no-unused-imports",
});
