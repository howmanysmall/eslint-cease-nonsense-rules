import { describe } from "bun:test";
import parser from "@typescript-eslint/parser";
import { RuleTester } from "@typescript-eslint/rule-tester";

import rule from "../../src/rules/array-type-generic";

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

describe("array-type-generic", () => {
	ruleTester.run("array-type-generic", rule, {
		invalid: [
			{
				code: "type A = string[];",
				errors: [{ messageId: "useGenericArrayType" }],
				output: "type A = Array<string>;",
			},
			{
				code: "type B = readonly number[];",
				errors: [{ messageId: "useGenericArrayType" }],
				output: "type B = ReadonlyArray<number>;",
			},
			{
				code: "type C = [number, string][];",
				errors: [{ messageId: "useGenericArrayType" }],
				output: "type C = Array<[number, string]>;",
			},
			{
				code: "type D = string[][];",
				errors: [{ messageId: "useGenericArrayType" }],
				output: "type D = Array<Array<string>>;",
			},
			{
				code: "const values: string[] = [];",
				errors: [{ messageId: "useGenericArrayType" }],
				output: "const values: Array<string> = [];",
			},
		],
		valid: [
			"type Point = [x: number, y: number];",
			"type Values = Array<string>;",
			"type Values = ReadonlyArray<string>;",
			"const pairs: Array<[number, string]> = [[1, 'one'], [2, 'two']];",
			"const xs = [1, 2, 3];",
			"const element = <div />;",
		],
	});
});
