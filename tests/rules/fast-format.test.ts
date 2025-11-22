import { describe } from "bun:test";
import { RuleTester } from "eslint";
import rule from "../../src/rules/fast-format";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		sourceType: "module",
	},
});

describe("fast-format", () => {
	ruleTester.run("fast-format", rule, {
		invalid: [
			{
				code: "const x=1",
				errors: [{ messageId: "REPLACE" }],
				name: "missing semicolon and spacing",
				output: "const x = 1;\n",
			},
			{
				code: "const x = 1",
				errors: [{ messageId: "REPLACE" }],
				name: "missing semicolon only",
				output: "const x = 1;\n",
			},
			{
				code: "function foo() {\nreturn 42;\n}",
				errors: [{ messageId: "REPLACE" }],
				name: "wrong indentation (spaces instead of tabs)",
				output: "function foo() {\n\treturn 42;\n}\n",
			},
			{
				code: "const x=1;const y=2;",
				errors: [{ messageId: "REPLACE" }],
				name: "multiple formatting issues",
				output: "const x = 1;\nconst y = 2;\n",
			},
			{
				code: 'const str = "hello"',
				errors: [{ messageId: "REPLACE" }],
				name: "missing semicolon",
				output: 'const str = "hello";\n',
			},
		],
		valid: [
			{
				code: "const x = 1;\n",
				name: "already formatted code with semicolon",
			},
			{
				code: "function foo() {\n\treturn 42;\n}\n",
				name: "already formatted function with tabs",
			},
			{
				code: "",
				name: "empty file",
			},
			{
				code: "const obj = {\n\tfoo: 1,\n\tbar: 2,\n};\n",
				name: "object with trailing comma",
			},
		],
	});
});
