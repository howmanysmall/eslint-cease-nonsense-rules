import { describe } from "bun:test";
import rule from "@rules/no-print";
import { RuleTester } from "eslint";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		sourceType: "module",
	},
});

describe("no-print", () => {
	ruleTester.run("no-print", rule, {
		invalid: [
			{
				code: "print('Hello');",
				errors: [{ messageId: "useLog" }],
			},
			{
				code: "print(value);",
				errors: [{ messageId: "useLog" }],
			},
			{
				code: "print();",
				errors: [{ messageId: "useLog" }],
			},
			{
				code: "print('test', 'multiple', 'args');",
				errors: [{ messageId: "useLog" }],
			},
			{
				code: "const x = print(123);",
				errors: [{ messageId: "useLog" }],
			},
		],
		valid: [
			"Log.info('Hello');",
			"Log.debug(value);",
			"console.log('test');",
			"const print = 'string';",
			"obj.print();",
			"printer();",
			"printing = true;",
		],
	});
});
