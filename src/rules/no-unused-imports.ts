import { createRule } from "$utilities/create-rule";
import { isModuleScope } from "$utilities/scope-utilities";
import { AST_TOKEN_TYPES } from "@typescript-eslint/utils";

import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

type MessageIds = "unusedImport";

export interface NoUnusedImportsOptions {
	readonly checkJSDoc?: boolean;
}

type Options = [NoUnusedImportsOptions?];

const JSDOC_IDENTIFIER_PATTERNS = [
	/@(?:link|linkcode|linkplain|see)\s+\{?(?<identifier>\w*)\}?/gu,
	/\{@(?:link|linkcode|linkplain|see)\s+(?<identifier>\w+)\}/gu,
	/[@{](?:type|typedef|param|returns?|template|augments|extends|implements)\s[^}]*\b(?<identifier>\w+)\b/gu,
];

type AnyImportSpecifier = TSESTree.ImportDeclaration["specifiers"][number];

function createFallbackToken(node: AnyImportSpecifier): TSESTree.Token {
	return {
		loc: node.loc,
		range: node.range,
		type: AST_TOKEN_TYPES.Punctuator,
		value: ",",
	};
}

function collectJSDocumentIdentifiers(sourceCode: TSESLint.SourceCode): Set<string> {
	const identifiers = new Set<string>();
	const comments = sourceCode.getAllComments();

	for (const comment of comments) {
		if (comment.type !== AST_TOKEN_TYPES.Block) continue;

		const { value } = comment;

		for (const pattern of JSDOC_IDENTIFIER_PATTERNS) {
			pattern.lastIndex = 0;
			for (const match of value.matchAll(pattern)) {
				const identifier = match.groups?.identifier;
				if (identifier !== undefined && identifier.length > 0) identifiers.add(identifier);
			}
		}
	}

	return identifiers;
}

const noUnusedImports = createRule<Options, MessageIds>({
	create(context) {
		// oxlint-disable-next-line small-rules/prevent-abbreviations -- lol
		const [{ checkJSDoc = true } = {}] = context.options;
		const { sourceCode } = context;
		const jsdocIdentifiers = checkJSDoc ? collectJSDocumentIdentifiers(sourceCode) : new Set<string>();

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

				const specifierIndex = parent.specifiers.indexOf(specifierNode);
				const nextSpecifier = parent.specifiers[specifierIndex + 1];
				if (nextSpecifier !== undefined) {
					const fallbackToken = createFallbackToken(specifierNode);
					const [tokenBeforeNextSpecifier = fallbackToken] = sourceCode.getTokensBefore(nextSpecifier, {
						count: 1,
					});
					const endOfRemoveRange =
						tokenBeforeNextSpecifier.value === ","
							? nextSpecifier.range[0]
							: tokenBeforeNextSpecifier.range[0];

					return fixer.removeRange([specifierNode.range[0], endOfRemoveRange]);
				}

				const fallbackToken = createFallbackToken(specifierNode);
				const [groupStartToken = fallbackToken, tokenBeforeSpecifier = fallbackToken] =
					sourceCode.getTokensBefore(specifierNode, { count: 2 });
				const [tokenAfterSpecifier = fallbackToken] = sourceCode.getTokensAfter(specifierNode, { count: 1 });
				const startsNamedImportGroup = tokenBeforeSpecifier.value === "{";
				const endsNamedImportGroup = tokenAfterSpecifier.value === "}";
				const removalStartToken = startsNamedImportGroup ? groupStartToken : tokenBeforeSpecifier;
				const [startOfRemoveRange] = removalStartToken.range;
				const endOfRemoveRange =
					startsNamedImportGroup && endsNamedImportGroup
						? tokenAfterSpecifier.range[1]
						: specifierNode.range[1];

				return fixer.removeRange([startOfRemoveRange, endOfRemoveRange]);
			};
		}

		return {
			ImportDeclaration(node): void {
				for (const specifier of node.specifiers) {
					imports.push({
						identifierName: specifier.local.name,
						parent: node,
						specifier,
					});
				}
			},

			"Program:exit"(): void {
				const programScope = sourceCode.getScope(sourceCode.ast);
				let moduleScope = programScope;

				for (const scope of [programScope, ...programScope.childScopes]) {
					if (!isModuleScope(scope)) continue;

					moduleScope = scope;
					break;
				}

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
	meta: {
		defaultOptions: [{ checkJSDoc: true }],
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

export default noUnusedImports;
