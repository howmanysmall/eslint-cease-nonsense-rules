import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { regex } from "arkregex";
import { toPascalCase } from "../utilities/casing-utilities";
import { createRule } from "../utilities/create-rule";

// oxlint-disable-next-line prefer-string-raw
const STARTS_WITH_DIGIT = regex("^\\d");

function getIdentifierName(node: TSESTree.TSEnumMember["id"] | TSESTree.Identifier): string | undefined {
	if (node.type === AST_NODE_TYPES.Identifier) return node.name;
	if (node.type !== AST_NODE_TYPES.Literal || typeof node.value !== "string") return undefined;
	return STARTS_WITH_DIGIT.test(node.value) ? undefined : node.value;
}

export default createRule({
	create(context) {
		function report(node: TSESTree.Node, identifier: string): void {
			context.report({
				data: { identifier },
				messageId: "notPascalCase",
				node,
			});
		}

		return {
			TSEnumDeclaration(node): void {
				const { name } = node.id;
				if (toPascalCase(name) === name) return;
				report(node.id, name);
			},
			TSEnumMember(node): void {
				const name = getIdentifierName(node.id);
				if (name === undefined || toPascalCase(name) === name) return;
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
	name: "prefer-pascal-case-enums",
});
