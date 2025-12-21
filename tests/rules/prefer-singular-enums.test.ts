import { describe } from "bun:test";
import tsParser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import rule from "../../src/rules/prefer-singular-enums";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser: tsParser,
		sourceType: "module",
	},
});

function errorWithName(name: string): { message: string; type: string } {
	return { message: `Enum '${name}' should be singular.`, type: "TSEnumDeclaration" };
}

describe("prefer-singular-enums", () => {
	// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
	ruleTester.run("prefer-singular-enums", rule, {
		invalid: [
			// Regular plural -s
			{ code: "enum SortOrders {MostRecent, LeastRecent, Newest, Oldest}", errors: [errorWithName("SortOrders")] },
			{ code: "enum Commands {Up, Down}", errors: [errorWithName("Commands")] },
			{ code: "enum Pages {Products, Orders}", errors: [errorWithName("Pages")] },

			// Irregular plurals
			{ code: "enum Feet {Left, Right}", errors: [errorWithName("Feet")] },
			{ code: "enum People {}", errors: [errorWithName("People")] },
			{ code: "enum Children {}", errors: [errorWithName("Children")] },
		],
		valid: [
			// Singular forms
			{ code: "enum SortOrder {MostRecent, LeastRecent, Newest, Oldest}" },
			{ code: "enum Command {Up, Down}" },
			{ code: "enum Page {Products, Orders}" },
		],
	});
});
