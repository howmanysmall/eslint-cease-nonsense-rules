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
	return {
		message: `Enum '${name}' uses plural naming. Enums define a type of which only ONE value is selected at a time, so singular naming is semantically correct. Use 'Status' not 'Statuses', 'Color' not 'Colors'. Rename the enum to its singular form.`,
		type: "TSEnumDeclaration",
	};
}

describe("prefer-singular-enums", () => {
	// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
	ruleTester.run("prefer-singular-enums", rule, {
		invalid: [
			// Regular plural -s
			{
				code: "enum SortOrders {MostRecent, LeastRecent, Newest, Oldest}",
				errors: [errorWithName("SortOrders")],
			},
			{ code: "enum Commands {Up, Down}", errors: [errorWithName("Commands")] },
			{ code: "enum Pages {Products, Orders}", errors: [errorWithName("Pages")] },

			// Programming-centric plurals
			{ code: "enum UserStatuses {}", errors: [errorWithName("UserStatuses")] },
			{ code: "enum Properties {}", errors: [errorWithName("Properties")] },
			{ code: "enum Categories {}", errors: [errorWithName("Categories")] },
			{ code: "enum Hooks {}", errors: [errorWithName("Hooks")] },
			{ code: "enum UserProps {}", errors: [errorWithName("UserProps")] },
			{ code: "enum Params {}", errors: [errorWithName("Params")] },
			{ code: "enum Options {}", errors: [errorWithName("Options")] },
			{ code: "enum Entries {}", errors: [errorWithName("Entries")] },
			{ code: "enum Keys {}", errors: [errorWithName("Keys")] },

			// Acronym plurals
			{ code: "enum IDs {}", errors: [errorWithName("IDs")] },
			{ code: "enum URLs {}", errors: [errorWithName("URLs")] },
			{ code: "enum APIs {}", errors: [errorWithName("APIs")] },
			{ code: "enum DTOs {}", errors: [errorWithName("DTOs")] },

			// Irregular plurals
			{ code: "enum Feet {Left, Right}", errors: [errorWithName("Feet")] },
			{ code: "enum People {}", errors: [errorWithName("People")] },
			{ code: "enum Children {}", errors: [errorWithName("Children")] },
			{ code: "enum Indices {}", errors: [errorWithName("Indices")] },
			{ code: "enum Matrices {}", errors: [errorWithName("Matrices")] },
			{ code: "enum Vertices {}", errors: [errorWithName("Vertices")] },
			{ code: "enum Axes {}", errors: [errorWithName("Axes")] },

			// Snake case / screaming snake case
			{ code: "enum USER_STATUSES {}", errors: [errorWithName("USER_STATUSES")] },
		],
		valid: [
			// Singular forms
			{ code: "enum SortOrder {MostRecent, LeastRecent, Newest, Oldest}" },
			{ code: "enum Command {Up, Down}" },
			{ code: "enum Page {Products, Orders}" },
			{ code: "enum Status {}" },
			{ code: "enum UserStatus {}" },
			{ code: "enum ID {}" },
			{ code: "enum URL {}" },
			{ code: "enum API {}" },
			{ code: "enum Alias {}" },
			{ code: "enum Analysis {}" },
			{ code: "enum Class {}" },
			{ code: "enum Series {}" },
			{ code: "enum Species {}" },
		],
	});
});
