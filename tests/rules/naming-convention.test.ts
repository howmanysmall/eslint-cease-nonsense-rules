import { describe } from "bun:test";
import parser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import rule from "../../src/rules/naming-convention";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser,
		sourceType: "module",
	},
});

describe("naming-convention", () => {
	// @ts-expect-error -- this thing is dumb.
	ruleTester.run("naming-convention", rule, {
		invalid: [
			// Interface with "I" prefix (when configured to reject)
			{
				code: "interface IUser { name: string; }",
				errors: [{ data: { name: "IUser", selector: "interface" }, messageId: "namingConvention" }],
				options: [{ custom: { match: false, regex: "^I[A-Z]" } }],
			},
			// Interface not matching PascalCase format
			{
				code: "interface user { name: string; }",
				errors: [{ data: { name: "user", selector: "interface" }, messageId: "namingConvention" }],
				options: [{ format: ["PascalCase"] }],
			},
			// Interface not matching custom regex pattern
			{
				code: "interface User { name: string; }",
				errors: [{ data: { name: "User", selector: "interface" }, messageId: "namingConvention" }],
				options: [{ custom: { match: true, regex: "^I[A-Z]" } }],
			},
		],
		valid: [
			// Interface without "I" prefix (valid)
			{
				code: "interface User { name: string; }",
			},
			// Interface with PascalCase format (valid)
			{
				code: "interface UserName { name: string; }",
				options: [{ format: ["PascalCase"] }],
			},
			// Interface matching custom regex pattern
			{
				code: "interface IUser { name: string; }",
				options: [{ custom: { match: true, regex: "^I[A-Z]" } }],
			},
			// Interface not matching custom regex when match: false
			{
				code: "interface User { name: string; }",
				options: [{ custom: { match: false, regex: "^I[A-Z]" } }],
			},
			// Default options (PascalCase, interface selector)
			{
				code: "interface ValidInterface { name: string; }",
			},
			// Different selector (should not check)
			{
				code: "interface IUser { name: string; }",
				options: [{ selector: "type" }],
			},
		],
	});
});
