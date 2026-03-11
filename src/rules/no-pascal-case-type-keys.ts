import { AST_NODE_TYPES } from "@typescript-eslint/utils";

import { createRule } from "../utilities/create-rule";

import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

type MessageIds = "pascalCaseKey" | "convertToCamelCase";

const LOWERCASE_PATTERN = /[a-z]/;

function isPascalCase(name: string): boolean {
	if (name.length === 0) return false;
	const [first = ""] = name;
	const isFirstUpper = first === first.toUpperCase() && first !== first.toLowerCase();
	if (!isFirstUpper) return false;
	if (name.includes("_")) return false;
	if (name.length === 1) return false;
	const rest = name.slice(1);
	return LOWERCASE_PATTERN.test(rest);
}

function toCamelCase(value: string): string {
	return value.charAt(0).toLowerCase() + value.slice(1);
}

function getKeyText(node: TSESTree.Identifier | TSESTree.Literal): string | undefined {
	if (node.type === AST_NODE_TYPES.Identifier) return node.name;
	if (node.type === AST_NODE_TYPES.Literal && typeof node.value === "string") return node.value;
	return undefined;
}

const noPascalCaseTypeKeys = createRule<[], MessageIds>({
	create(context) {
		function checkPropertySignature(node: TSESTree.TSPropertySignatureNonComputedName): void {
			if (node.computed) return;

			const keyText = getKeyText(node.key);
			if (keyText === undefined) return;

			if (isPascalCase(keyText)) {
				const camelCaseName = toCamelCase(keyText);
				context.report({
					data: {
						camelCaseName,
						name: keyText,
					},
					messageId: "pascalCaseKey",
					node: node.key,
					suggest: [
						{
							data: {
								camelCaseName,
								name: keyText,
							},
							fix(fixer): TSESLint.RuleFix {
								return fixer.replaceText(node.key, camelCaseName);
							},
							messageId: "convertToCamelCase",
						},
					],
				});
			}
		}

		function checkMethodSignature(node: TSESTree.TSMethodSignatureNonComputedName): void {
			if (node.computed) return;

			const keyText = getKeyText(node.key);
			if (keyText === undefined) return;

			if (isPascalCase(keyText)) {
				const camelCaseName = toCamelCase(keyText);
				context.report({
					data: {
						camelCaseName,
						name: keyText,
					},
					messageId: "pascalCaseKey",
					node: node.key,
					suggest: [
						{
							data: {
								camelCaseName,
								name: keyText,
							},
							fix(fixer): TSESLint.RuleFix {
								return fixer.replaceText(node.key, camelCaseName);
							},
							messageId: "convertToCamelCase",
						},
					],
				});
			}
		}

		return {
			"TSMethodSignature[computed=false]": checkMethodSignature,
			"TSPropertySignature[computed=false]": checkPropertySignature,
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description: "Disallow PascalCase property keys in TypeScript interfaces and type literals",
		},
		hasSuggestions: true,
		messages: {
			convertToCamelCase: "Convert '{{name}}' to camelCase ('{{camelCaseName}}').",
			pascalCaseKey:
				"Property key '{{name}}' should use camelCase. PascalCase keys are typically used for types and classes, not for object properties. Rename to '{{camelCaseName}}'.",
		},
		schema: [],
		type: "suggestion",
	},
	name: "no-pascal-case-type-keys",
});

export default noPascalCaseTypeKeys;
