import { describe } from "bun:test";
import tsParser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";

import rule from "../../src/rules/no-pascal-case-type-keys";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser: tsParser,
		sourceType: "module",
	},
});

describe("no-pascal-case-type-keys", () => {
	// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
	ruleTester.run("no-pascal-case-type-keys", rule, {
		invalid: [
			{
				code: "interface User { UserName: string }",
				errors: [
					{
						messageId: "pascalCaseKey",
						suggestions: [
							{
								desc: "Convert 'UserName' to camelCase ('userName').",
								output: "interface User { userName: string }",
							},
						],
					},
				],
			},
			{
				code: "type Config = { ApiKey: string }",
				errors: [
					{
						messageId: "pascalCaseKey",
						suggestions: [
							{
								desc: "Convert 'ApiKey' to camelCase ('apiKey').",
								output: "type Config = { apiKey: string }",
							},
						],
					},
				],
			},
			{
				code: "interface User { UserName?: string }",
				errors: [
					{
						messageId: "pascalCaseKey",
						suggestions: [
							{
								desc: "Convert 'UserName' to camelCase ('userName').",
								output: "interface User { userName?: string }",
							},
						],
					},
				],
			},
			{
				code: "interface User { readonly UserName: string }",
				errors: [
					{
						messageId: "pascalCaseKey",
						suggestions: [
							{
								desc: "Convert 'UserName' to camelCase ('userName').",
								output: "interface User { readonly userName: string }",
							},
						],
					},
				],
			},
			{
				code: "interface User { GetDisplayName(): string }",
				errors: [
					{
						messageId: "pascalCaseKey",
						suggestions: [
							{
								desc: "Convert 'GetDisplayName' to camelCase ('getDisplayName').",
								output: "interface User { getDisplayName(): string }",
							},
						],
					},
				],
			},
			{
				code: "type Point = { X: number; Y: number; CoordinateZ: number }",
				errors: [
					{
						messageId: "pascalCaseKey",
						suggestions: [
							{
								desc: "Convert 'CoordinateZ' to camelCase ('coordinateZ').",
								output: "type Point = { X: number; Y: number; coordinateZ: number }",
							},
						],
					},
				],
			},
			{
				code: "interface Nested { OuterKey: { InnerKey: string } }",
				errors: [
					{
						messageId: "pascalCaseKey",
						suggestions: [
							{
								desc: "Convert 'OuterKey' to camelCase ('outerKey').",
								output: "interface Nested { outerKey: { InnerKey: string } }",
							},
						],
					},
					{
						messageId: "pascalCaseKey",
						suggestions: [
							{
								desc: "Convert 'InnerKey' to camelCase ('innerKey').",
								output: "interface Nested { OuterKey: { innerKey: string } }",
							},
						],
					},
				],
			},
			{
				code: "type Deep = { LevelOne: { LevelTwo: { LevelThree: string } } }",
				errors: [
					{
						messageId: "pascalCaseKey",
						suggestions: [
							{
								desc: "Convert 'LevelOne' to camelCase ('levelOne').",
								output: "type Deep = { levelOne: { LevelTwo: { LevelThree: string } } }",
							},
						],
					},
					{
						messageId: "pascalCaseKey",
						suggestions: [
							{
								desc: "Convert 'LevelTwo' to camelCase ('levelTwo').",
								output: "type Deep = { LevelOne: { levelTwo: { LevelThree: string } } }",
							},
						],
					},
					{
						messageId: "pascalCaseKey",
						suggestions: [
							{
								desc: "Convert 'LevelThree' to camelCase ('levelThree').",
								output: "type Deep = { LevelOne: { LevelTwo: { levelThree: string } } }",
							},
						],
					},
				],
			},
			{
				code: "interface Mixed { ValidKey: string; anotherValid: number; InvalidKey: boolean }",
				errors: [
					{
						messageId: "pascalCaseKey",
						suggestions: [
							{
								desc: "Convert 'ValidKey' to camelCase ('validKey').",
								output: "interface Mixed { validKey: string; anotherValid: number; InvalidKey: boolean }",
							},
						],
					},
					{
						messageId: "pascalCaseKey",
						suggestions: [
							{
								desc: "Convert 'InvalidKey' to camelCase ('invalidKey').",
								output: "interface Mixed { ValidKey: string; anotherValid: number; invalidKey: boolean }",
							},
						],
					},
				],
			},
		],
		valid: [
			{ code: "interface User { userName: string }" },
			{ code: "type Config = { apiKey: string }" },
			{ code: "interface Point { x: number; y: number }" },
			{ code: "interface Coordinates { X: number; Y: number; Z: number }" },
			{ code: "type SingleLetter = { X: number; Y: number }" },
			{ code: "interface Constants { MAX_VALUE: number }" },
			{ code: "type Snake = { snake_case: string }" },
			{ code: "interface Computed { [key: string]: unknown }" },
			{ code: "interface EnumKey { [Color.Red]: string }" },
			{ code: "interface Optional { userName?: string }" },
			{ code: "interface Readonly { readonly userName: string }" },
			{ code: "interface Method { getDisplayName(): string }" },
			{ code: "interface Empty { }" },
			{ code: 'type StringLiteral = { "json-key": string }' },
			{ code: "interface Numeric { 0: string; 1: number }" },
			{ code: "type Mixed = { camelCase: string; snake_case: number; UPPER_CASE: boolean }" },
		],
	});
});
