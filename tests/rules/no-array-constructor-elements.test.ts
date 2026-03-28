import { describe } from "bun:test";
import parser from "@typescript-eslint/parser";
import { RuleTester } from "@typescript-eslint/rule-tester";

import rule from "../../src/rules/no-array-constructor-elements";

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

describe("no-array-constructor-elements", () => {
	ruleTester.run("no-array-constructor-elements", rule, {
		invalid: [
			{
				code: 'const values = new Array("a", "b");',
				errors: [{ messageId: "avoidConstructorEnumeration" }],
				output: 'const values = ["a", "b"];',
			},
			{
				code: 'const values = new Array<string>("a", "b");',
				errors: [{ messageId: "avoidConstructorEnumeration" }],
				output: 'const values = ["a", "b"];',
			},
			{
				code: 'const value = new Array("a");',
				errors: [{ messageId: "avoidSingleArgumentConstructor" }],
				output: 'const value = ["a"];',
			},
			{
				code: "const value = new Array(size);",
				errors: [
					{
						messageId: "avoidLengthConstructorInStandard",
						suggestions: [
							{
								messageId: "suggestArrayFromLength",
								output: "const value = Array.from({ length: size });",
							},
						],
					},
				],
				options: [{ environment: "standard" }],
				output: undefined,
			},
			{
				code: "const value = new Array(3);",
				errors: [
					{
						messageId: "avoidLengthConstructorInStandard",
						suggestions: [
							{
								messageId: "suggestArrayFromLength",
								output: "const value = Array.from({ length: 3 });",
							},
						],
					},
				],
				options: [{ environment: "standard" }],
				output: undefined,
			},
			{
				code: "const value = new Array(256, -1);",
				errors: [
					{
						messageId: "avoidConstructorEnumeration",
					},
				],
				options: [{ environment: "standard" }],
				output: "const value = [256, -1];",
			},
			{
				code: "const value = new Array();",
				errors: [{ messageId: "requireExplicitGenericOnNewArray" }],
				output: undefined,
			},
			{
				code: `
const array = new Array<string>();
array.push("a");
array.push("b");
array.push("c", "d", "e", "f");
`,
				errors: [{ messageId: "collapseArrayPushInitialization" }],
				output: `
const array = ["a", "b", "c", "d", "e", "f"];
`,
			},
			{
				code: `
const array = new Array<string>();
array.push(getValue());
array.push("b");
`,
				errors: [
					{
						messageId: "collapseArrayPushInitialization",
						suggestions: [
							{
								messageId: "suggestCollapseArrayPushInitialization",
								output: `
const array = [getValue(), "b"];
`,
							},
						],
					},
				],
				output: undefined,
			},
		],
		valid: [
			"const value = new Array<string>();",
			"const value: Array<string> = new Array();",
			"const sized = new Array(10);",
			{
				code: "const sized = new Array(10);",
				options: [{ environment: "roblox-ts" }],
			},
			`
type ColorSequenceKeypoint = { time: number };
declare const length: number;
const keypoints = new Array<ColorSequenceKeypoint>(length);
`,
			`
type ColorSequenceKeypoint = { time: number };
const keypoints = new Array<ColorSequenceKeypoint>(256, -1);
`,
			`
function multiplyByTwo(array: ReadonlyArray<number>): ReadonlyArray<number> {
    const newArray = new Array<number>(array.size());
    let size = 0;

    for (const value of array) newArray[size++] = value * 2;
    return newArray;
}
`,
			{
				code: "const value = new Array();",
				options: [{ requireExplicitGenericOnNewArray: false }],
			},
			`
class Array<TValue> {
    constructor(..._arguments: Array<TValue>) {}
}
const value = new Array("a");
`,
			`
const array = new Array<string>();
array.push("a");
doSomething(array);
array.push("b");
`,
		],
	});
});
