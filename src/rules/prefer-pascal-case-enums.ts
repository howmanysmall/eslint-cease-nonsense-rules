import { toPascalCase } from "$utilities/casing-utilities";
import { createRule } from "$utilities/create-rule";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { regex } from "arktype";

import type { TSESTree } from "@typescript-eslint/utils";

// oxlint-disable-next-line prefer-string-raw -- Regex strings are easier to scan with escaped source fragments.
const STARTS_WITH_DIGIT = regex("^\\d", "u");

function getIdentifierName(node: TSESTree.TSEnumMember["id"] | TSESTree.Identifier): string | undefined {
	if (node.type === AST_NODE_TYPES.Identifier) return node.name;
	return typeof node.value === "string" && !STARTS_WITH_DIGIT.test(node.value) ? node.value : undefined;
}

const preferPascalCaseEnums = createRule({
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
	meta: {
		defaultOptions: [],
		docs: {
			description: "Enforce Pascal case when naming enums.",
		},
		messages: {
			notPascalCase:
				"Enum '{{ identifier }}' uses non-standard casing. TypeScript convention requires PascalCase for enum names and members to distinguish them from variables (camelCase) and constants (UPPER_CASE). Rename to PascalCase: capitalize first letter of each word, no underscores.",
		},
		schema: [],
		type: "suggestion",
	},
	name: "prefer-pascal-case-enums",
});

export default preferPascalCaseEnums;
