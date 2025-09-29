import { RuleTester } from "eslint";
import { describe, expect, it } from "bun:test";
import rule from "../../src/rules/no-print";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		sourceType: "module",
	},
});

describe("no-print", () => {
	it("should pass valid cases and fail invalid cases", () => {
		expect(() => {
			ruleTester.run("no-print", rule, {
				valid: [
					"Log.info('Hello');",
					"Log.debug(value);",
					"console.log('test');",
					"const print = 'string';",
					"obj.print();",
					"printer();",
					"printing = true;",
				],
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
			});
		}).not.toThrow();
	});
});