import { RuleTester } from "eslint";
import { describe, expect, it } from "bun:test";
import rule from "../../src/rules/no-color3-constructor";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		sourceType: "module",
	},
});

describe("no-color3-constructor", () => {
	it("should pass valid cases and fail invalid cases", () => {
		expect(() => {
			ruleTester.run("no-color3-constructor", rule, {
				valid: [
					"new Color3();",
					"new Color3(0, 0, 0);",
					"Color3.fromRGB(255, 128, 64);",
					"Color3.fromRGB(0, 0, 0);",
					"const color = Color3.fromRGB(255, 255, 255);",
					"new Color();",
					"new Color2(1, 2);",
					"const c = someOtherConstructor(1, 2, 3);",
				],
				invalid: [
					{
						code: "new Color3(255);",
						errors: [{ messageId: "useFromRGB" }],
					},
					{
						code: "new Color3(0.5);",
						errors: [{ messageId: "useFromRGB" }],
					},
					{
						code: "new Color3(1, 0);",
						errors: [{ messageId: "useFromRGB" }],
					},
					{
						code: "new Color3(255, 128);",
						errors: [{ messageId: "useFromRGB" }],
					},
					{
						code: "new Color3(255, 128, 64);",
						errors: [{ messageId: "onlyZeroArgs" }],
					},
					{
						code: "new Color3(1, 1, 1);",
						errors: [{ messageId: "onlyZeroArgs" }],
					},
					{
						code: "new Color3(0, 0, 1);",
						errors: [{ messageId: "onlyZeroArgs" }],
					},
					{
						code: "new Color3(0, 1, 0);",
						errors: [{ messageId: "onlyZeroArgs" }],
					},
					{
						code: "new Color3(1, 0, 0);",
						errors: [{ messageId: "onlyZeroArgs" }],
					},
					{
						code: "const c = new Color3(0.5, 0.5, 0.5);",
						errors: [{ messageId: "onlyZeroArgs" }],
					},
				],
			});
		}).not.toThrow();
	});
});