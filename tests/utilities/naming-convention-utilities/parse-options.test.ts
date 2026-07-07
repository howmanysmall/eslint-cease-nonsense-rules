import { describe } from "vitest";
import { createRule } from "$utilities/create-rule";
import { parseOptions } from "$utilities/naming-convention-utilities/parse-options";
import parser from "@typescript-eslint/parser";
import { RuleTester } from "@typescript-eslint/rule-tester";

import type { MessageIds, Options } from "$rules/naming-convention";
import type { TSESTree } from "@typescript-eslint/utils";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser,
		sourceType: "module",
	},
});

const parseOptionsProbeRule = createRule<Options, MessageIds>({
	create(context) {
		const validators = parseOptions(context, [
			{
				custom: { match: true, regex: "^foo$" },
				filter: { match: true, regex: "^ok" },
				format: ["camelCase"],
				prefix: ["ok"],
				selector: ["method", "property", "typeLike"],
				suffix: ["Done"],
				types: ["string", { name: "LooseThing" }, { from: "strict-source", name: "StrictThing" }],
			},
			{
				selector: "variable",
			},
		]);

		return {
			"PropertyDefinition[computed=false] > Identifier.key"(node: TSESTree.Identifier): void {
				validators.classProperty(node);
			},
		};
	},
	meta: {
		defaultOptions: [],
		docs: { description: "parse options probe rule" },
		messages: {
			doesNotMatchFormat: "{{name}} should match one of the following formats: {{formats}}",
			doesNotMatchFormatTrimmed:
				"{{name}} trimmed as {{processedName}} should match one of the following formats: {{formats}}",
			missingAffix: "{{name}} should have {{position}} {{affixes}}",
			missingUnderscore: "{{name}} should have {{count}} {{position}} underscore",
			satisfyCustom: "{{name}} should {{regexMatch}} {{regex}}",
			unexpectedUnderscore: "{{name}} should not have {{count}} {{position}} underscore",
		},
		schema: [],
		type: "problem",
	},
	name: "parse-options-probe",
});

describe("parseOptions", () => {
	ruleTester.run("parse-options-probe", parseOptionsProbeRule, {
		invalid: [
			{
				code: "class Example { okFooDone = 1; }",
				errors: [{ messageId: "satisfyCustom" }],
			},
		],
		valid: ["class Example { okfooDone = 1; }"],
	});
});
