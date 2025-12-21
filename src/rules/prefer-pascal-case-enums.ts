import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";

type MessageIds = "notPascalCase";

// PascalCase pattern: starts with uppercase, followed by one or more lowercase/digits,
// Then optionally more words each starting with uppercase followed by one or more lowercase/digits
const PASCAL_CASE = /^[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+)*$/;

// Pattern to check if a string starts with a digit
const STARTS_WITH_DIGIT = /^\d/;

/**
 * Checks if an identifier is in PascalCase.
 * @param identifier - The identifier to check
 * @returns True if the identifier is in PascalCase
 */
function isPascalCase(identifier: string): boolean {
	return PASCAL_CASE.test(identifier);
}

/**
 * Gets the identifier name from an enum member or declaration.
 * Returns undefined for string literals starting with digits (which are allowed).
 * @param node - The enum member or identifier node
 * @returns The identifier name, or undefined if it's a disallowed literal
 */
function getIdentifierName(node: TSESTree.TSEnumMember["id"] | TSESTree.Identifier): string | undefined {
	if (node.type === AST_NODE_TYPES.Identifier) {
		return node.name;
	}

	if (node.type === AST_NODE_TYPES.Literal && typeof node.value === "string") {
		// String literals starting with digits are allowed (e.g., '1024x1024')
		if (STARTS_WITH_DIGIT.test(node.value)) {
			return undefined;
		}
		return node.value;
	}

	return undefined;
}

const preferPascalCaseEnums: TSESLint.RuleModuleWithMetaDocs<MessageIds> = {
	create(context) {
		function report(node: TSESTree.Node, identifier: string): void {
			context.report({
				data: { identifier },
				message: `Enum '{{ identifier }}' should use Pascal case.`,
				node,
			});
		}

		return {
			TSEnumDeclaration(node) {
				const { name } = node.id;
				if (!isPascalCase(name)) {
					report(node.id, name);
				}
			},
			TSEnumMember(node) {
				const name = getIdentifierName(node.id);
				if (name !== undefined && !isPascalCase(name)) {
					report(node.id, name);
				}
			},
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description: "Enforce Pascal case when naming enums.",
		},
		messages: {
			notPascalCase: "Enum '{{ identifier }}' should use Pascal case.",
		},
		schema: [],
		type: "suggestion",
	},
};

export default preferPascalCaseEnums;
