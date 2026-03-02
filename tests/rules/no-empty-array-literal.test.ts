import { describe } from "bun:test";
import { dirname } from "node:path";
import parser from "@typescript-eslint/parser";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { fileURLToPath } from "bun";

import rule from "../../src/rules/no-empty-array-literal";

const __dirname = dirname(fileURLToPath(import.meta.url));

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser,
		parserOptions: {
			ecmaFeatures: {
				jsx: true,
			},
		},
		sourceType: "module",
	},
});

const typeAwareRuleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser,
		parserOptions: {
			ecmaFeatures: {
				jsx: true,
			},
			projectService: {
				allowDefaultProject: ["*.ts", "*.tsx"],
				maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 64,
			},
			tsconfigRootDir: __dirname,
		},
		sourceType: "module",
	},
});

describe("no-empty-array-literal", () => {
	ruleTester.run("no-empty-array-literal", rule, {
		invalid: [
			{
				code: "const x: Array<string> = [];",
				errors: [{ messageId: "noEmptyArrayLiteral" }],
				output: "const x: Array<string> = new Array<string>();",
			},
			{
				code: "function f(x: Array<number> = []) { return x; }",
				errors: [{ messageId: "noEmptyArrayLiteral" }],
				output: "function f(x: Array<number> = new Array<number>()) { return x; }",
			},
			{
				code: "interface Foo { id: string }\nclass C { xs: ReadonlyArray<Foo> = []; }",
				errors: [{ messageId: "noEmptyArrayLiteral" }],
				output: "interface Foo { id: string }\nclass C { xs: ReadonlyArray<Foo> = new Array<Foo>(); }",
			},
			{
				code: "const x = [];",
				errors: [
					{
						messageId: "noEmptyArrayLiteral",
						suggestions: [
							{
								messageId: "suggestUseNewArray",
								output: "const x = new Array();",
							},
						],
					},
				],
				output: undefined,
			},
		],
		valid: [
			"const xs = [1, 2, 3];",
			"const pairs = [[1, 'one'], [2, 'two']];",
			{
				code: "const xs = [1, 2, 3];",
				options: [{ ignoreInferredNonEmptyLiterals: false }],
			},
			"const empty = new Array<string>();",
		],
	});
});

describe("no-empty-array-literal (type-aware inference)", () => {
	typeAwareRuleTester.run("no-empty-array-literal-type-aware", rule, {
		invalid: [
			{
				code: "function create(): Array<number> { return []; }",
				errors: [{ messageId: "noEmptyArrayLiteral" }],
				options: [{ inferTypeForEmptyArrayFix: true }],
				output: "function create(): Array<number> { return new Array<number>(); }",
			},
			{
				code: "function create(): Array<number> { return []; }",
				errors: [{ messageId: "noEmptyArrayLiteral" }],
				options: [{ inferTypeForEmptyArrayFix: true, requireExplicitGenericOnNewArray: false }],
				output: "function create(): Array<number> { return new Array(); }",
			},
		],
		valid: [
			{
				code: "function create(): Array<number> { return [1, 2, 3]; }",
				options: [{ inferTypeForEmptyArrayFix: true }],
			},
		],
	});
});
