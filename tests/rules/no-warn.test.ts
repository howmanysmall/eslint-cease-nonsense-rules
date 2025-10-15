import { describe } from "bun:test";
import { RuleTester } from "eslint";
import rule from "../../src/rules/no-warn";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		sourceType: "module",
	},
});

describe("no-warn", () => {
	ruleTester.run("no-warn", rule, {
		invalid: [
			{
				code: "warn('Warning');",
				errors: [{ messageId: "useLog" }],
			},
			{
				code: "warn(error);",
				errors: [{ messageId: "useLog" }],
			},
			{
				code: "warn();",
				errors: [{ messageId: "useLog" }],
			},
			{
				code: "warn('test', 'multiple');",
				errors: [{ messageId: "useLog" }],
			},
			{
				code: "const x = warn('error');",
				errors: [{ messageId: "useLog" }],
			},
		],
		valid: [
			"Log.warn('Warning');",
			"Log.error(error);",
			"console.warn('test');",
			"const warn = 'string';",
			"obj.warn();",
			"warning();",
			"warned = true;",
		],
	});
});
