import { describe, it, expect } from "bun:test";
import { RuleTester } from "eslint";
import parser from "@typescript-eslint/parser";
import rule from "../../src/rules/enforce-ianitor-check-type";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		sourceType: "module",
		parser,
		parserOptions: {
			ecmaFeatures: {
				jsx: true,
			},
		},
	},
});

describe("enforce-ianitor-check-type", () => {
	it("should pass valid cases", () => {
		expect(() => {
			ruleTester.run("enforce-ianitor-check-type", rule, {
				valid: [
					// Simple types (score < 10)
					{
						code: "type Simple = string;",
						languageOptions: {
							parser,
						},
					},
					{
						code: "type BasicObject = { id: string; name: string };",
						languageOptions: {
							parser,
						},
					},
					{
						code: "const isSimple = Ianitor.string;",
						languageOptions: {
							parser,
						},
					},
					// Has annotation
					{
						code: "const isTyped: Ianitor.Check<SomeType> = Ianitor.interface({ name: Ianitor.string });",
						languageOptions: {
							parser,
						},
					},
					// Simple validator that should pass
					{
						code: "const validator = Ianitor.strictInterface({ name: Ianitor.string });",
						options: [{ baseThreshold: 20 }], // Increase threshold to make this pass
						languageOptions: {
							parser,
						},
					},
					// Ianitor.Static<typeof ...> pattern
					{
						code: `
							const isSpinOptions = Ianitor.strictInterface({
								maxAttempts: Ianitor.optional(Ianitor.intersection(Ianitor.integer, Ianitor.numberPositive)),
								random: Ianitor.optional(Ianitor.Random),
								soFar: Ianitor.set(Ianitor.any),
							});
							export type SpinOptions = Ianitor.Static<typeof isSpinOptions>;
						`,
						languageOptions: {
							parser,
						},
					},
					// Readonly<Ianitor.Static<typeof ...>> pattern
					{
						code: `
							const isSpinOptions = Ianitor.strictInterface({
								maxAttempts: Ianitor.optional(Ianitor.intersection(Ianitor.integer, Ianitor.numberPositive)),
								random: Ianitor.optional(Ianitor.Random),
								soFar: Ianitor.set(Ianitor.any),
							});
							export type SpinOptions = Readonly<Ianitor.Static<typeof isSpinOptions>>;
						`,
						languageOptions: {
							parser,
						},
					},
					// Various Ianitor validator methods
					{
						code: "const validator = Ianitor.optional(Ianitor.string);",
						options: [{ baseThreshold: 20 }],
						languageOptions: {
							parser,
						},
					},
					{
						code: "const validator = Ianitor.array(Ianitor.number);",
						options: [{ baseThreshold: 20 }],
						languageOptions: {
							parser,
						},
					},
					{
						code: "const validator = Ianitor.record(Ianitor.string, Ianitor.number);",
						options: [{ baseThreshold: 20 }],
						languageOptions: {
							parser,
						},
					},
					{
						code: "const validator = Ianitor.map(Ianitor.string, Ianitor.number);",
						options: [{ baseThreshold: 20 }],
						languageOptions: {
							parser,
						},
					},
					{
						code: "const validator = Ianitor.union(Ianitor.string, Ianitor.number);",
						options: [{ baseThreshold: 20 }],
						languageOptions: {
							parser,
						},
					},
					{
						code: "const validator = Ianitor.intersection(Ianitor.string, Ianitor.number);",
						options: [{ baseThreshold: 20 }],
						languageOptions: {
							parser,
						},
					},
					{
						code: "const validator = Ianitor.instanceIsA(SomeClass);",
						options: [{ baseThreshold: 20 }],
						languageOptions: {
							parser,
						},
					},
					{
						code: "const validator = Ianitor.instanceOf(SomeClass);",
						options: [{ baseThreshold: 20 }],
						languageOptions: {
							parser,
						},
					},
					{
						code: "const validator = Ianitor.boolean;",
						options: [{ baseThreshold: 20 }],
						languageOptions: {
							parser,
						},
					},
					// Type aliases with various complexity levels
					{
						code: "type SimpleUnion = string | number;",
						languageOptions: {
							parser,
						},
					},
					{
						code: "type SimpleIntersection = { a: string } & { b: number };",
						languageOptions: {
							parser,
						},
					},
					{
						code: "type SimpleArray = Array<string>;",
						languageOptions: {
							parser,
						},
					},
					{
						code: "type SimpleTuple = [string, number];",
						languageOptions: {
							parser,
						},
					},
					{
						code: "type SimpleConditional<T> = T extends string ? string : number;",
						languageOptions: {
							parser,
						},
					},
					{
						code: "type SimpleMapped<T> = { [K in keyof T]: T[K] };",
						languageOptions: {
							parser,
						},
					},
					{
						code: "type SimpleFunction = (a: string) => number;",
						languageOptions: {
							parser,
						},
					},
					{
						code: "type SimpleGeneric<T> = { data: T };",
						languageOptions: {
							parser,
						},
					},
					// Interface declarations
					{
						code: "interface SimpleInterface { id: string; name: string; }",
						languageOptions: {
							parser,
						},
					},
					// Function declarations with return types
					{
						code: "function foo(): string { return 'x'; }",
						languageOptions: {
							parser,
						},
					},
					{
						code: "const bar = function(): number { return 42; };",
						languageOptions: {
							parser,
						},
					},
					// Types with primitive keywords
					{
						code: "type PrimitiveUnion = string | number | boolean | null | undefined | void | symbol | bigint;",
						languageOptions: {
							parser,
						},
					},
					// Nested arrays
					{
						code: "type NestedArray = Array<Array<string>>;",
						languageOptions: {
							parser,
						},
					},
					// Non-Ianitor type aliases
					{
						code: "type RegularType = { data: string };",
						languageOptions: {
							parser,
						},
					},
					// Ianitor primitive validators (low complexity, should pass)
					{
						code: "const validator = Ianitor.string();",
						options: [{ baseThreshold: 20 }],
						languageOptions: {
							parser,
						},
					},
					{
						code: "const validator = Ianitor.number();",
						options: [{ baseThreshold: 20 }],
						languageOptions: {
							parser,
						},
					},
					// Complex arrays
					{
						code: "type DeepArray = string[][][];",
						languageOptions: {
							parser,
						},
					},
					{
						code: "type ComplexArrayType = Array<Array<{ id: string }>>;",
						languageOptions: {
							parser,
						},
					},
					// Special TypeScript keywords
					{
						code: "type NeverType = never;",
						languageOptions: {
							parser,
						},
					},
					{
						code: "type UnknownType = unknown;",
						languageOptions: {
							parser,
						},
					},
					{
						code: "type AnyType = any;",
						languageOptions: {
							parser,
						},
					},
					// Non-Ianitor call expressions (to hit isIanitorValidator false path)
					{
						code: "const result = someFunction();",
						languageOptions: {
							parser,
						},
					},
					{
						code: "const data = OtherLib.method();",
						languageOptions: {
							parser,
						},
					},
				],
				invalid: [
					// Complex Ianitor validator without type annotation
					{
						code: `
							const isUser = Ianitor.strictInterface({
								name: Ianitor.string,
								age: Ianitor.number,
								profile: Ianitor.interface({
									email: Ianitor.string,
									settings: Ianitor.record(Ianitor.string, Ianitor.unknown)
								})
							});
						`,
						languageOptions: {
							parser,
						},
						errors: 1,
					},
				],
			});
		}).not.toThrow();
	});
});
