import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { regex } from "arkregex";

type MessageIds = "notPascalCase";

const PASCAL_CASE = regex("^[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+)*$");

// oxlint-disable-next-line prefer-string-raw
const STARTS_WITH_DIGIT = regex("^\\d");

function isPascalCase(identifier: string): boolean {
	return PASCAL_CASE.test(identifier);
}

function getIdentifierName(node: TSESTree.TSEnumMember["id"] | TSESTree.Identifier): string | undefined {
	if (node.type === AST_NODE_TYPES.Identifier) return node.name;

	if (node.type === AST_NODE_TYPES.Literal && typeof node.value === "string") {
		if (STARTS_WITH_DIGIT.test(node.value)) return undefined;
		return node.value;
	}

	return undefined;
}

const preferPascalCaseEnums: TSESLint.RuleModuleWithMetaDocs<MessageIds> = {
	create(context) {
		function report(node: TSESTree.Node, identifier: string): void {
			context.report({
				data: { identifier },
				messageId: "notPascalCase",
				node,
			});
		}

		return {
			TSEnumDeclaration(node) {
				const { name } = node.id;
				if (isPascalCase(name)) return;
				report(node.id, name);
			},
			TSEnumMember(node) {
				const name = getIdentifierName(node.id);
				if (name === undefined || isPascalCase(name)) return;
				report(node.id, name);
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
