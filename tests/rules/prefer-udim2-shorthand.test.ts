import { describe } from "bun:test";
import { RuleTester } from "eslint";
import rule from "../../src/rules/prefer-udim2-shorthand";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		sourceType: "module",
	},
});

describe("prefer-udim2-shorthand", () => {
	ruleTester.run("prefer-udim2-shorthand", rule, {
		invalid: [
			// fromScale pattern tests
			{
				code: "new UDim2(1, 0, 1, 0);",
				errors: [{ messageId: "preferFromScale" }],
				output: "UDim2.fromScale(1, 1);",
			},
			{
				code: "new UDim2(0.5, 0, 0.75, 0);",
				errors: [{ messageId: "preferFromScale" }],
				output: "UDim2.fromScale(0.5, 0.75);",
			},
			{
				code: "const size = new UDim2(100, 0, 200, 0);",
				errors: [{ messageId: "preferFromScale" }],
				output: "const size = UDim2.fromScale(100, 200);",
			},
			{
				code: "func(new UDim2(1, 0, 2, 0));",
				errors: [{ messageId: "preferFromScale" }],
				output: "func(UDim2.fromScale(1, 2));",
			},

			// fromOffset pattern tests
			{
				code: "new UDim2(0, 1, 0, 1);",
				errors: [{ messageId: "preferFromOffset" }],
				output: "UDim2.fromOffset(1, 1);",
			},
			{
				code: "new UDim2(0, 100, 0, 50);",
				errors: [{ messageId: "preferFromOffset" }],
				output: "UDim2.fromOffset(100, 50);",
			},
			{
				code: "const padding = new UDim2(0, 5, 0, 10);",
				errors: [{ messageId: "preferFromOffset" }],
				output: "const padding = UDim2.fromOffset(5, 10);",
			},
			{
				code: "method(new UDim2(0, 20, 0, 30));",
				errors: [{ messageId: "preferFromOffset" }],
				output: "method(UDim2.fromOffset(20, 30));",
			},
		],
		valid: [
			// Mixed values - not simplifiable
			"new UDim2(1, 2, 3, 4);",
			"new UDim2(1, 0, 2, 3);",
			"new UDim2(1, 2, 0, 0);",

			// All zeros - explicitly allowed
			"new UDim2(0, 0, 0, 0);",

			// Already using shorthands
			"UDim2.fromScale(1, 1);",
			"UDim2.fromOffset(5, 10);",
			"const x = UDim2.fromScale(0.5, 0.75);",
			"const y = UDim2.fromOffset(100, 50);",

			// Different constructors
			"new UDim(0);",
			"new Vector2(1, 2);",
			"new Color3(1, 1, 1);",

			// Variables as arguments - can't verify literals
			"new UDim2(x, 0, y, 0);",
			"new UDim2(0, offset, 0, offset);",

			// Expressions as arguments
			"new UDim2(1 + 1, 0, 2 + 2, 0);",

			// Wrong argument counts
			"new UDim2();",
			"new UDim2(1);",
			"new UDim2(1, 2);",
			"new UDim2(1, 2, 3);",
			"new UDim2(1, 2, 3, 4, 5);",

			// Other constructors
			"const c = someOtherConstructor(0, 0, 0, 0);",
		],
	});
});
