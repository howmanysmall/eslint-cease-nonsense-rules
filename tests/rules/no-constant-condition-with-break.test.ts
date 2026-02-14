import { describe } from "bun:test";
import { RuleTester } from "eslint";
import rule from "../../src/rules/no-constant-condition-with-break";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		sourceType: "module",
	},
});

describe("no-constant-condition-with-break", () => {
	// @ts-expect-error - RuleTester doesn't support the new format of rules
	ruleTester.run("no-constant-condition-with-break", rule, {
		invalid: [
			{
				code: "if (true) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "while (true) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "for (; 1;) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "while (true) { switch (value) { case 1: break; default: doThing(); } }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "while (false) { break; }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "do { doThing(); } while (0);",
				errors: [{ messageId: "unexpected" }],
			},
		],
		valid: [
			"if (condition) { doThing(); }",
			"while (true) { if (done) break; doThing(); }",
			"for (; true;) { if (done) break; doThing(); }",
			"outer: while (true) { if (done) break outer; doThing(); }",
			"while (value) { doThing(); }",
		],
	});
});
