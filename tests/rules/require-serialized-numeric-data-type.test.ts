import { describe } from "bun:test";
import parser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import rule from "../../src/rules/require-serialized-numeric-data-type";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser,
		sourceType: "module",
	},
});

describe("require-serialized-numeric-data-type", () => {
	// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
	ruleTester.run("require-serialized-numeric-data-type", rule, {
		invalid: [
			// Basic number type argument
			{
				code: `export const CurrentDay = registerComponent<number>({ replicated: true });`,
				errors: [{ messageId: "requireSerializedNumericDataType" }],
			},
			// Multiple type arguments
			{
				code: `export const CurrentDay = registerComponent<number, string>({ replicated: true });`,
				errors: [{ messageId: "requireSerializedNumericDataType" }],
			},
			// Object type with number property
			{
				code: `export const CurrentDay = registerComponent<{ foo: number }>({ replicated: true });`,
				errors: [{ messageId: "requireSerializedNumericDataType" }],
			},
			// Nested object type with number
			{
				code: `export const CurrentDay = registerComponent<{ foo: { bar: number } }>({ replicated: true });`,
				errors: [{ messageId: "requireSerializedNumericDataType" }],
			},
			// Union type with number
			{
				code: `export const CurrentDay = registerComponent<number | string>({ replicated: true });`,
				errors: [{ messageId: "requireSerializedNumericDataType" }],
			},
			// Intersection type with number
			{
				code: `export const CurrentDay = registerComponent<number & { _brand: never }>({ replicated: true });`,
				errors: [{ messageId: "requireSerializedNumericDataType" }],
			},
			// Array of numbers
			{
				code: `export const CurrentDay = registerComponent<number[]>({ replicated: true });`,
				errors: [{ messageId: "requireSerializedNumericDataType" }],
			},
			// Tuple with number
			{
				code: `export const CurrentDay = registerComponent<[number, string]>({ replicated: true });`,
				errors: [{ messageId: "requireSerializedNumericDataType" }],
			},
			// Custom function name
			{
				code: `registerCustom<number>({});`,
				errors: [{ messageId: "requireSerializedNumericDataType" }],
				options: [{ functionNames: ["registerCustom"] }],
			},
			// Multiple custom function names
			{
				code: `otherFunc<number>({});`,
				errors: [{ messageId: "requireSerializedNumericDataType" }],
				options: [{ functionNames: ["registerComponent", "otherFunc"] }],
			},
			// Mode: all - variable declaration
			{
				code: `const x: number = 5;`,
				errors: [{ messageId: "requireSerializedNumericDataType" }],
				options: [{ mode: "all" }],
			},
			// Mode: all - function parameter
			{
				code: `function foo(x: number) {}`,
				errors: [{ messageId: "requireSerializedNumericDataType" }],
				options: [{ mode: "all" }],
			},
			// Mode: all - function return type
			{
				code: `function foo(): number { return 1; }`,
				errors: [{ messageId: "requireSerializedNumericDataType" }],
				options: [{ mode: "all" }],
			},
			// Mode: all - arrow function parameter
			{
				code: `const fn = (x: number) => x;`,
				errors: [{ messageId: "requireSerializedNumericDataType" }],
				options: [{ mode: "all" }],
			},
			// Mode: all - arrow function return type
			{
				code: `const fn = (): number => 1;`,
				errors: [{ messageId: "requireSerializedNumericDataType" }],
				options: [{ mode: "all" }],
			},
			// Mode: all - interface property
			{
				code: `interface Props { count: number }`,
				errors: [{ messageId: "requireSerializedNumericDataType" }],
				options: [{ mode: "all" }],
			},
			// Mode: all - type alias
			{
				code: `type MyNumber = number;`,
				errors: [{ messageId: "requireSerializedNumericDataType" }],
				options: [{ mode: "all" }],
			},
			// Mode: all - class property
			{
				code: `class Foo { value: number = 0; }`,
				errors: [{ messageId: "requireSerializedNumericDataType" }],
				options: [{ mode: "all" }],
			},
			// Mode: all - method parameter
			{
				code: `class Foo { method(x: number) {} }`,
				errors: [{ messageId: "requireSerializedNumericDataType" }],
				options: [{ mode: "all" }],
			},
			// Mode: all - function type
			{
				code: `type Callback = (x: number) => number;`,
				errors: [
					{ messageId: "requireSerializedNumericDataType" },
					{ messageId: "requireSerializedNumericDataType" },
				],
				options: [{ mode: "all" }],
			},
			// Mode: all - type argument in function call
			{
				code: `const result = doSomething<number>();`,
				errors: [{ messageId: "requireSerializedNumericDataType" }],
				options: [{ mode: "all" }],
			},
			// Generic type with number argument - Array<number>
			{
				code: `export const Timer = registerComponent<Array<number>>({ replicated: true });`,
				errors: [{ messageId: "requireSerializedNumericDataType" }],
			},
			// Generic type with number argument - Promise<number>
			{
				code: `export const Timer = registerComponent<Promise<number>>({ replicated: true });`,
				errors: [{ messageId: "requireSerializedNumericDataType" }],
			},
			// Generic type with number argument - Map<string, number>
			{
				code: `export const Timer = registerComponent<Map<string, number>>({ replicated: true });`,
				errors: [{ messageId: "requireSerializedNumericDataType" }],
			},
			// Nested generic with number
			{
				code: `export const Timer = registerComponent<Wrapper<number>>({ replicated: true });`,
				errors: [{ messageId: "requireSerializedNumericDataType" }],
			},
		],
		valid: [
			// DataType.u8 - allowed
			{
				code: `export const CurrentDay = registerComponent<DataType.u8>({ replicated: true });`,
			},
			// DataType.f32 - allowed
			{
				code: `export const Timer = registerComponent<DataType.f32>({ replicated: true });`,
			},
			// DataType.u32 - allowed
			{
				code: `export const Money = registerComponent<DataType.u32>({ replicated: true });`,
			},
			// All DataType variants
			{
				code: `
					registerComponent<DataType.i8>({});
					registerComponent<DataType.i16>({});
					registerComponent<DataType.i32>({});
					registerComponent<DataType.u16>({});
					registerComponent<DataType.f64>({});
				`,
			},
			// Object type with DataType properties - allowed
			{
				code: `export const CurrentDay = registerComponent<{ foo: DataType.u8 }>({ replicated: true });`,
			},
			// Nested object with DataType - allowed
			{
				code: `export const CurrentDay = registerComponent<{ foo: { bar: DataType.f32 } }>({ replicated: true });`,
			},
			// Union of DataTypes - allowed
			{
				code: `export const CurrentDay = registerComponent<DataType.u8 | DataType.u32>({ replicated: true });`,
			},
			// Array of DataType - allowed
			{
				code: `export const CurrentDay = registerComponent<DataType.u8[]>({ replicated: true });`,
			},
			// Tuple of DataTypes - allowed
			{
				code: `export const CurrentDay = registerComponent<[DataType.u8, DataType.f32]>({ replicated: true });`,
			},
			// String type - allowed
			{
				code: `export const CurrentDay = registerComponent<string>({ replicated: true });`,
			},
			// Boolean type - allowed
			{
				code: `export const CurrentDay = registerComponent<boolean>({ replicated: true });`,
			},
			// Object without numbers - allowed
			{
				code: `export const CurrentDay = registerComponent<{ foo: string; bar: boolean }>({ replicated: true });`,
			},
			// Non-registered component function - allowed
			{
				code: `otherFunction<number>({});`,
			},
			// Mode: all - DataType variable - allowed
			{
				code: `const x: DataType.u8 = 5;`,
				options: [{ mode: "all" }],
			},
			// Mode: all - string variable - allowed
			{
				code: `const x: string = "hello";`,
				options: [{ mode: "all" }],
			},
			// Mode: all - boolean variable - allowed
			{
				code: `const x: boolean = true;`,
				options: [{ mode: "all" }],
			},
			// Mode: all - function with DataType parameter - allowed
			{
				code: `function foo(x: DataType.u32) {}`,
				options: [{ mode: "all" }],
			},
			// Mode: all - interface with DataType property - allowed
			{
				code: `interface Props { count: DataType.u32 }`,
				options: [{ mode: "all" }],
			},
			// Mode: all - type alias with DataType - allowed
			{
				code: `type MyNumber = DataType.f32;`,
				options: [{ mode: "all" }],
			},
			// No type argument - allowed
			{
				code: `registerComponent({ replicated: true });`,
			},
			// Generic type parameter not number - allowed
			{
				code: `registerComponent<T>({ replicated: true });`,
			},
			// Type reference to non-number type - allowed (in non-strict mode)
			{
				code: `
					type MyType = string;
					registerComponent<MyType>({ replicated: true });
				`,
			},
			// Type reference with DataType alias - allowed (in non-strict mode)
			{
				code: `
					type MyNumber = DataType.u8;
					registerComponent<MyNumber>({ replicated: true });
				`,
			},
			// Generic type with DataType argument - Array<DataType.f32>
			{
				code: `export const Timer = registerComponent<Array<DataType.f32>>({ replicated: true });`,
			},
			// Generic type with DataType argument - Promise<DataType.u8>
			{
				code: `export const Timer = registerComponent<Promise<DataType.u8>>({ replicated: true });`,
			},
			// Generic type with DataType arguments - Map<string, DataType.i32>
			{
				code: `export const Timer = registerComponent<Map<string, DataType.i32>>({ replicated: true });`,
			},
			// Nested generic with DataType
			{
				code: `export const Timer = registerComponent<Wrapper<DataType.u32>>({ replicated: true });`,
			},
		],
	});
});
