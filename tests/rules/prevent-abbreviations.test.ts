import { describe } from "bun:test";
import parser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import rule from "../../src/rules/prevent-abbreviations";

const TEST_IGNORE_PATTERN = /^test/;

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser,
		sourceType: "module",
	},
});

describe("prevent-abbreviations", () => {
	// @ts-expect-error -- this thing is dumb.
	ruleTester.run("prevent-abbreviations", rule, {
		invalid: [
			// Variable declaration with abbreviation (const)
			{
				code: "const err = new Error();",
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "variable", replacement: "error" },
						messageId: "replace",
					},
				],
				output: "const error = new Error();",
			},
			// Variable declaration with abbreviation (let)
			{
				code: "let args = [1, 2, 3];",
				errors: [
					{
						data: { discouragedName: "args", nameTypeText: "variable", replacement: "arguments" },
						messageId: "replace",
					},
				],
				output: "let arguments = [1, 2, 3];",
			},
			// Variable declaration with abbreviation (var)
			{
				code: "var dist = 10;",
				errors: [
					{
						data: { discouragedName: "dist", nameTypeText: "variable", replacement: "distance" },
						messageId: "replace",
					},
				],
				output: "var distance = 10;",
			},
			// Function parameter with abbreviation
			{
				code: "function foo(err) { return err; }",
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "variable", replacement: "error" },
						messageId: "replace",
					},
				],
				output: "function foo(error) { return error; }",
			},
			// Property name with abbreviation (when checkProperties: true)
			{
				code: "const obj = { err: 'value' };",
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "property", replacement: "error" },
						messageId: "replace",
					},
				],
				options: [{ checkProperties: true }],
				output: "const obj = { error: 'value' };",
			},
			// Multiple replacement suggestions (no auto-fix)
			{
				code: "const fn = () => {};",
				errors: [
					{
						data: {
							discouragedName: "fn",
							nameTypeText: "variable",
							replacementsText: "`func`, `function`",
						},
						messageId: "suggestion",
					},
				],
			},
			// Custom replacements
			{
				code: "const custom = 'test';",
				errors: [
					{
						data: { discouragedName: "custom", nameTypeText: "variable", replacement: "customReplacement" },
						messageId: "replace",
					},
				],
				options: [{ replacements: { custom: { customReplacement: true } } }],
				output: "const customReplacement = 'test';",
			},
			// CamelCase word splitting
			{
				code: "const myErr = new Error();",
				errors: [
					{
						data: { discouragedName: "myErr", nameTypeText: "variable", replacement: "myError" },
						messageId: "replace",
					},
				],
				output: "const myError = new Error();",
			},
		],
		valid: [
			// CONSTANTS (all caps) should be ignored
			{
				code: "const ERR = 'error';",
			},
			// AllowList entries bypass detection
			{
				code: "const err = new Error();",
				options: [{ allowList: { err: true } }],
			},
			// Ignore patterns (regex)
			{
				code: "const testErr = new Error();",
				options: [{ ignore: [TEST_IGNORE_PATTERN] }],
			},
			// Ignore patterns (string)
			{
				code: "const testErr = new Error();",
				options: [{ ignore: ["testErr"] }],
			},
			// Property names not checked by default
			{
				code: "const obj = { err: 'value' };",
			},
			// Variables not checked when checkVariables: false
			{
				code: "const err = new Error();",
				options: [{ checkVariables: false }],
			},
			// Properties not checked when checkProperties: false (default)
			{
				code: "const obj = { err: 'value' };",
				options: [{ checkProperties: false }],
			},
			// Valid full names
			{
				code: "const error = new Error();",
			},
			{
				code: "const arguments = [1, 2, 3];",
			},
			{
				code: "const distance = 10;",
			},
			// Function with valid parameter name
			{
				code: "function foo(error) { return error; }",
			},
			// Property with valid name when checkProperties: true
			{
				code: "const obj = { error: 'value' };",
				options: [{ checkProperties: true }],
			},
		],
	});
});
