import { describe } from "bun:test";
import tsParser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import rule from "../../src/rules/prefer-pascal-case-enums";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser: tsParser,
		sourceType: "module",
	},
});

function errorWithName(name: string): { message: string } {
	return { message: `Enum '${name}' should use Pascal case.` };
}

describe("prefer-pascal-case-enums", () => {
	// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
	ruleTester.run("prefer-pascal-case-enums", rule, {
		invalid: [
			// All caps
			{ code: "enum SORTORDER {MostRecent, LeastRecent, Newest, Oldest}", errors: [errorWithName("SORTORDER")] },
			// All lowercase
			{ code: "enum sortorder {MostRecent, LeastRecent, Newest, Oldest}", errors: [errorWithName("sortorder")] },
			// Snake case
			{ code: "enum sort_order {MostRecent, LeastRecent, Newest, Oldest}", errors: [errorWithName("sort_order")] },
			// CamelCase
			{ code: "enum sortOrder {MostRecent, LeastRecent, Newest, Oldest}", errors: [errorWithName("sortOrder")] },
			// Both name and member invalid
			{
				code: "enum sortOrder {mostRecent, LeastRecent, Newest, Oldest}",
				errors: [errorWithName("sortOrder"), errorWithName("mostRecent")],
			},
			// Valid name, invalid members
			{
				code: "enum SortOrder {MOSTRECENT, least_recent, Newest, Oldest}",
				errors: [errorWithName("MOSTRECENT"), errorWithName("least_recent")],
			},
			// String literal member (not starting with digit)
			{
				code: "enum Example {'foo' = 'bar', '1024x1024' = '1024x1024', Oldest}",
				errors: [errorWithName("foo")],
			},
		],
		valid: [
			// Proper PascalCase
			{ code: "enum SortOrder {MostRecent, LeastRecent, Newest, Oldest}" },
		],
	});
});
