import { describe } from "bun:test";
import { RuleTester } from "eslint";
import rule from "../../src/rules/prefer-early-return";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		sourceType: "module",
	},
});

const error = {
	message: "Prefer an early return to a conditionally-wrapped function body",
	type: "BlockStatement",
};

describe("prefer-early-return", () => {
	ruleTester.run("prefer-early-return", rule, {
		invalid: [
			// Default maximumStatements = 1, so 2+ statements triggers
			{
				code: "function foo() { if (something) { doSomething(); doSomethingElse(); } }",
				errors: [error],
			},
			// MaximumStatements = 0 means even 1 statement triggers
			{
				code: "function foo() { if (something) doSomething(); }",
				errors: [error],
				options: [{ maximumStatements: 0 }],
			},
			{
				code: "function foo() { if (something) { doSomething(); } }",
				errors: [error],
				options: [{ maximumStatements: 0 }],
			},
			// Function expressions
			{
				code: "var foo = function() { if (something) { doSomething(); doSomethingElse(); } }",
				errors: [error],
			},
			// Arrow functions
			{
				code: "var foo = () => { if (something) { doSomething(); doSomethingElse(); } }",
				errors: [error],
			},
			// Callback functions
			{
				code: "callback(function() { if (something) { doSomething(); doSomethingElse(); } })",
				errors: [error],
			},
		],
		valid: [
			// Already using early return pattern
			{ code: "function foo() { if (!something) { return; } doSomething(); doSomethingElse(); }" },
			// Only 1 statement (default max is 1)
			{ code: "function foo() { if (something) { doSomething(); } }" },
			// Expression statement without block
			{ code: "function foo() { if (something) doSomething(); }" },
			// 2 statements but max is 2
			{
				code: "function foo() { if (something) { doSomething(); doSomethingElse(); } }",
				options: [{ maximumStatements: 2 }],
			},
			// Has other statements after the if
			{ code: "function foo() { if (something) { doSomething(); doSomethingElse(); } someOtherThing(); }" },
			// Has else clause
			{
				code: "function foo() { if (something) { doSomething(); doSomethingElse(); } else { doAnotherThing(); } }",
			},
			// Function expressions
			{ code: "var foo = function() { if (something) { doSomething(); } }" },
			// Arrow functions
			{ code: "var foo = () => { if (something) { doSomething(); } }" },
			// Arrow function with expression body
			{ code: "var foo = () => 'bar'" },
		],
	});
});
