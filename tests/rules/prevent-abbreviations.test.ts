import { describe } from "vitest";
import rule from "$rules/prevent-abbreviations";
import parser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";

const TEST_IGNORE_PATTERN = /^test/u;
const MANY_REPLACEMENTS = Object.fromEntries(
	Array.from({ length: 103 }, (_, index) => [`name${String(index).padStart(3, "0")}`, true]),
);

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
			{
				code: "import err from './err'; err();",
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "variable", replacement: "error" },
						messageId: "replace",
					},
				],
				output: "import error from './err'; error();",
			},
			{
				code: "import * as utils from './utils'; utils.noop();",
				errors: [
					{
						data: { discouragedName: "utils", nameTypeText: "variable", replacement: "utilities" },
						messageId: "replace",
					},
				],
				output: "import * as utilities from './utils'; utilities.noop();",
			},
			{
				code: "import { err } from './errors'; err();",
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "variable", replacement: "error" },
						messageId: "replace",
					},
				],
				output: "import { err as error } from './errors'; error();",
			},
			{
				code: "import { default as err } from './errors'; err();",
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "variable", replacement: "error" },
						messageId: "replace",
					},
				],
				output: "import { default as error } from './errors'; error();",
			},
			{
				code: "import err = require('./errors'); err();",
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "variable", replacement: "error" },
						messageId: "replace",
					},
				],
				languageOptions: {
					sourceType: "script",
				},
				output: "import error = require('./errors'); error();",
			},
			{
				code: "import err from 'pkg'; err();",
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "variable", replacement: "error" },
						messageId: "replace",
					},
				],
				options: [{ checkDefaultAndNamespaceImports: true }],
				output: "import error from 'pkg'; error();",
			},
			{
				code: "import err from ''; err();",
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "variable", replacement: "error" },
						messageId: "replace",
					},
				],
				options: [{ checkDefaultAndNamespaceImports: true }],
				output: "import error from ''; error();",
			},
			{
				code: "const err: Error = new Error();",
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "variable", replacement: "error" },
						messageId: "replace",
					},
				],
				output: "const error: Error = new Error();",
			},
			{
				code: "function handle(err?: Error) { return err; }",
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "variable", replacement: "error" },
						messageId: "replace",
					},
				],
				output: "function handle(error?: Error) { return error; }",
			},
			{
				code: "const err = 1;",
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "variable", replacement: "𝒳𝒴" },
						messageId: "replace",
					},
				],
				options: [{ extendDefaultReplacements: false, replacements: { err: { 𝒳𝒴: true } } }],
				output: "const 𝒳𝒴 = 1;",
			},
			{
				code: "const err = new Error(); export { err };",
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "variable", replacement: "error" },
						messageId: "replace",
					},
				],
				output: "const error = new Error(); export { error as err };",
			},
			{
				code: "export { error as err };",
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "property", replacement: "error" },
						messageId: "replace",
					},
				],
				options: [{ checkProperties: true }],
			},
			{
				code: "const err = getError(); const payload = { err };",
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "variable", replacement: "error" },
						messageId: "replace",
					},
				],
				options: [{ checkProperties: true, checkShorthandProperties: true }],
				output: "const error = getError(); const payload = { err: error };",
			},
			{
				code: "const { err = fallback } = payload;",
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "variable", replacement: "error" },
						messageId: "replace",
					},
				],
				options: [{ checkShorthandProperties: true }],
				output: "const { err: error = fallback } = payload;",
			},
			{
				code: "const pkg = require('./pkg'); pkg.load();",
				errors: [
					{
						data: { discouragedName: "pkg", nameTypeText: "variable", replacement: "package_" },
						messageId: "replace",
					},
				],
				output: "const package_ = require('./pkg'); package_.load();",
			},
			{
				code: "const pkg = require('./pkg', './fallback');",
				errors: [
					{
						data: { discouragedName: "pkg", nameTypeText: "variable", replacement: "package_" },
						messageId: "replace",
					},
				],
				output: "const package_ = require('./pkg', './fallback');",
			},
			{
				code: "const source = './pkg'; const pkg = require(source); pkg.load();",
				errors: [
					{
						data: { discouragedName: "pkg", nameTypeText: "variable", replacement: "package_" },
						messageId: "replace",
					},
				],
				output: "const source = './pkg'; const package_ = require(source); package_.load();",
			},
			{
				code: "const err = new Error();",
				errors: [
					{
						messageId: "suggestion",
					},
				],
				options: [{ replacements: { err: { "#": true } } }],
			},
			{
				code: "const err = new Error();",
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "variable", replacement: "error-name" },
						messageId: "replace",
					},
				],
				options: [{ extendDefaultReplacements: false, replacements: { err: { "error-name": true } } }],
			},
			{
				code: "export const err = new Error();",
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "variable", replacement: "error" },
						messageId: "replace",
					},
				],
			},
			{
				code: "export function err() {}",
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "variable", replacement: "error" },
						messageId: "replace",
					},
				],
			},
			{
				code: "export class Err {}",
				errors: [
					{
						data: { discouragedName: "Err", nameTypeText: "variable", replacement: "Error_" },
						messageId: "replace",
					},
				],
			},
			{
				code: "const Widget = class Err {};",
				errors: [
					{
						data: { discouragedName: "Err", nameTypeText: "variable", replacement: "Error_" },
						messageId: "replace",
					},
				],
				output: "const Widget = class Error_ {};",
			},
			{
				code: "export type Err = Error;",
				errors: [
					{
						data: { discouragedName: "Err", nameTypeText: "variable", replacement: "Error_" },
						messageId: "replace",
					},
				],
			},
			{
				code: "const object = 1; const obj = 2;",
				errors: [
					{
						data: { discouragedName: "obj", nameTypeText: "variable", replacement: "object_" },
						messageId: "replace",
					},
				],
				options: [{ allowList: { obj: false } }],
				output: "const object = 1; const object_ = 2;",
			},
			{
				code: "const function_ = 1; const fn = 2;",
				errors: [
					{
						data: {
							discouragedName: "fn",
							nameTypeText: "variable",
							replacementsText: "`func`, `function__`",
						},
						messageId: "suggestion",
					},
				],
			},
			{
				code: "const function_ = 1; const func = 2; const fn = 3;",
				errors: [
					{
						messageId: "replace",
					},
					{
						messageId: "replace",
					},
				],
				output: "const function_ = 1; const function__ = 2; const function___ = 3;",
			},
			{
				code: "const xy = 1;",
				errors: [
					{
						data: {
							discouragedName: "xy",
							nameTypeText: "variable",
							replacementsText:
								"`xavierYankee`, `xylophoneYard`, `xylophoneYellow`, ... (1 more omitted)",
						},
						messageId: "suggestion",
					},
				],
				options: [
					{
						replacements: {
							xy: {
								xavierYankee: true,
								xylophoneYard: true,
								xylophoneYellow: true,
								xylophoneYodel: true,
							},
						},
					},
				],
			},
			{
				code: "const huge = 1;",
				errors: [
					{
						data: {
							discouragedName: "huge",
							nameTypeText: "variable",
							replacementsText: "`name000`, `name001`, `name002`, ... (99+ more omitted)",
						},
						messageId: "suggestion",
					},
				],
				options: [{ replacements: { huge: MANY_REPLACEMENTS } }],
			},
			{
				code: "const obj = { err() {}, value: 1 }; obj.err = () => {};",
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "property", replacement: "error" },
						messageId: "replace",
					},
					{
						data: { discouragedName: "err", nameTypeText: "property", replacement: "error" },
						messageId: "replace",
					},
				],
				options: [{ checkProperties: true }],
			},
			{
				code: "const obj = { err: 1 };",
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "property", replacement: "error" },
						messageId: "replace",
					},
				],
				options: [{ checkProperties: true }],
			},
			{
				code: "class Widget { err() {} prop = 1; }",
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "property", replacement: "error" },
						messageId: "replace",
					},
					{
						data: { discouragedName: "prop", nameTypeText: "property", replacement: "property" },
						messageId: "replace",
					},
				],
				options: [{ checkProperties: true }],
			},
			{
				code: "<Err />;",
				errors: [
					{
						data: { discouragedName: "Err", nameTypeText: "variable", replacement: "Error" },
						messageId: "replace",
					},
				],
				languageOptions: {
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			{
				code: "const Err = () => null; <Err />;",
				errors: [
					{
						messageId: "replace",
					},
					{
						messageId: "replace",
					},
				],
				languageOptions: {
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			{
				code: "",
				errors: [
					{
						data: {
							discouragedName: "empty",
							nameTypeText: "variable",
							replacementsText: "`empty`",
						},
						messageId: "suggestion",
					},
				],
			},
			{
				code: "const okay = true;",
				errors: [
					{
						data: {
							discouragedName: "err.ts",
							nameTypeText: "filename",
							replacement: "error.ts",
						},
						messageId: "replace",
					},
				],
				filename: "err.ts",
			},
			{
				code: "const err = new Error();",
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "variable", replacement: "mistake" },
						messageId: "replace",
					},
				],
				options: [{ extendDefaultReplacements: false, replacements: { err: { mistake: true } } }],
				output: "const mistake = new Error();",
			},
			{
				code: "const mistake = 1; const err = new Error();",
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "variable", replacement: "mistake_" },
						messageId: "replace",
					},
				],
				options: [
					{
						extendDefaultReplacements: false,
						replacements: {
							err: { mistake: true },
							mistake: { better: false },
						},
					},
				],
				output: "const mistake = 1; const mistake_ = new Error();",
			},
			{
				code: "const err = new Error(); error;",
				errors: [
					{
						data: { discouragedName: "err", nameTypeText: "variable", replacement: "error_" },
						messageId: "replace",
					},
				],
				output: "const error_ = new Error(); error;",
			},
			{
				code: "const myErrErr = new Error();",
				errors: [
					{
						data: { discouragedName: "myErrErr", nameTypeText: "variable", replacement: "myError" },
						messageId: "replace",
					},
				],
				output: "const myError = new Error();",
			},
			{
				code: "const defaultProps = {};",
				errors: [
					{
						data: {
							discouragedName: "defaultProps",
							nameTypeText: "variable",
							replacement: "defaultProperties",
						},
						messageId: "replace",
					},
				],
				options: [{ extendDefaultAllowList: false }],
				output: "const defaultProperties = {};",
			},
			{
				code: "let pkg;",
				errors: [
					{
						data: { discouragedName: "pkg", nameTypeText: "variable", replacement: "package_" },
						messageId: "replace",
					},
				],
				output: "let package_;",
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
				code: 'enum Values { "err" = "err" }',
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
			{
				code: "const err = new Error();",
				options: [{ replacements: { err: false } }],
			},
			{
				code: "const err = new Error();",
				options: [{ extendDefaultReplacements: false, replacements: { err: false } }],
			},
			{
				code: "const { err } = payload;",
			},
			{
				code: "import err from 'pkg'; err();",
			},
			{
				code: "import err from ''; err();",
			},
			{
				code: "import { err } from 'pkg'; err();",
			},
			{
				code: "import err from 'pkg'; err();",
				options: [{ checkDefaultAndNamespaceImports: false }],
			},
			{
				code: "import { err } from 'pkg'; err();",
				options: [{ checkShorthandImports: false }],
			},
			{
				code: "const pkg = require('node_modules/pkg'); pkg.load();",
			},
			{
				code: "const __proto__ = {};",
				options: [{ checkProperties: true }],
			},
			{
				code: "<err />;",
				languageOptions: {
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			{
				code: "<Namespace.Err />;",
				languageOptions: {
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			{
				code: "<Err />;",
				languageOptions: {
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
				options: [{ checkVariables: false }],
			},
			{
				code: "<Component />;",
				languageOptions: {
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			{
				code: "const okay = true;",
				filename: "okay.ts",
			},
		],
	});
});
