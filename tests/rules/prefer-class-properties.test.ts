import { describe } from "bun:test";
import { RuleTester } from "eslint";
import rule from "../../src/rules/prefer-class-properties";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		sourceType: "module",
	},
});

const classPropErrors = [{ message: "Unexpected class property.", type: "PropertyDefinition" }];
const assignErrors = [{ message: "Unexpected assignment of literal instance member.", type: "AssignmentExpression" }];

describe("prefer-class-properties", () => {
	// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
	ruleTester.run("prefer-class-properties", rule, {
		invalid: [
			// 'never' mode - class properties are not allowed
			{ code: 'class Foo { foo = "bar"; }', errors: classPropErrors, options: ["never"] },
			{ code: "class Foo { foo = bar(); }", errors: classPropErrors, options: ["never"] },
			{ code: "class Foo { foo = 123; }", errors: classPropErrors, options: ["never"] },

			// 'always' mode - constructor assignments of literals are not allowed
			{ code: "class Foo { constructor() { this.foo = 123; } }", errors: assignErrors, options: ["always"] },
			{
				code: "const Foo = class { constructor() { this.foo = 123; } };",
				errors: assignErrors,
				options: ["always"],
			},
			{ code: "class Foo { constructor() { this.foo = false; } }", errors: assignErrors, options: ["always"] },
			{
				code: "class Foo { constructor() { this.foo = /something/; } }",
				errors: assignErrors,
				options: ["always"],
			},
			{ code: "class Foo { constructor() { this.foo = '123'; } }", errors: assignErrors, options: ["always"] },
			{
				code: "class Foo { constructor() { this.foo = '123'.toUpperCase(); } }",
				errors: assignErrors,
				options: ["always"],
			},
			// MemberExpression on literal (covers line 29)
			{
				code: "class Foo { constructor() { this.foo = 'bar'.length; } }",
				errors: assignErrors,
				options: ["always"],
			},
			{ code: "class Foo { constructor() { this.foo = []; } }", errors: assignErrors, options: ["always"] },
			{ code: "class Foo { constructor() { this.foo = {}; } }", errors: assignErrors, options: ["always"] },
			{
				code: "class Foo { constructor() { this.foo = [123, 456, 789]; } }",
				errors: assignErrors,
				options: ["always"],
			},
			{
				code: "class Foo { constructor() { this.foo = [123, [456, 789]]; } }",
				errors: assignErrors,
				options: ["always"],
			},
			{
				code: "class Foo { constructor() { this.foo = {foo: 123, bar: {baz: '456'}}; } }",
				errors: assignErrors,
				options: ["always"],
			},
			{ code: "class Foo { constructor() { this['foo'] = 123; } }", errors: assignErrors, options: ["always"] },
		],
		valid: [
			// 'always' mode - class properties are fine
			{ code: 'class Foo { foo = "bar"; }', options: ["always"] },
			{ code: "class Foo { foo = bar(); }", options: ["always"] },
			{ code: "class Foo { foo = 123; }", options: ["always"] },

			// 'never' mode - static properties are still allowed
			{ code: 'class Foo { static foo = "bar"; }', options: ["never"] },

			// 'always' mode - static properties are fine
			{ code: 'class Foo { static foo = "bar"; }', options: ["always"] },

			// 'never' mode - constructor assignments are fine
			{ code: "class Foo { constructor() { this.foo = 123; } }", options: ["never"] },
			{ code: "class Foo { constructor() { this.foo = '123'; } }", options: ["never"] },

			// 'always' mode - computed properties are fine (can't be class properties)
			{ code: "class Foo { constructor() { this[foo] = 123; } }", options: ["always"] },

			// 'always' mode - nested member expressions are fine
			{ code: "class Foo { constructor() { this.foo[bar].baz = 123; } }", options: ["always"] },

			// 'always' mode - non-literal assignments are fine
			{ code: "class Foo { constructor() { this.foo = foo(); } }", options: ["always"] },

			// 'always' mode - conditional assignments are fine (not top-level in constructor)
			{ code: "class Foo { constructor() { if (something) { this.foo = 123; } } }", options: ["always"] },

			// 'always' mode - assignments in other methods are fine
			{ code: "class Foo { somethingElse() { this.foo = 123; } }", options: ["always"] },

			// 'always' mode - arrays/objects with non-literals are fine
			{ code: "class Foo { constructor() { this.foo = [123, bar, 456]; } }", options: ["always"] },
			{ code: "class Foo { constructor() { this.foo = {foo: 123, bar: baz}; } }", options: ["always"] },
			{ code: "class Foo { constructor() { this.foo = {[foo]: 123}; } }", options: ["always"] },
		],
	});
});
