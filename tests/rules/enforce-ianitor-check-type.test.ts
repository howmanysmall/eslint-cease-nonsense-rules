import { describe } from "vitest";
import rule from "$rules/enforce-ianitor-check-type";
import parser from "@typescript-eslint/parser";
import { RuleTester } from "@typescript-eslint/rule-tester";

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

describe("enforce-ianitor-check-type", () => {
	ruleTester.run("enforce-ianitor-check-type", rule, {
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
				errors: [{ messageId: "missingIanitorCheckType" }],
			},
			{
				code: "const isCustom = Ianitor.custom();",
				errors: [{ messageId: "missingIanitorCheckType" }],
				options: [{ baseThreshold: 1 }],
			},
			{
				code: `
const _ianitor = Ianitor.string;
type ComplexTuple = [{ a: string; b: number }, { c: boolean; d: string }];
`,
				errors: [{ messageId: "missingIanitorCheckType" }],
				options: [{ baseThreshold: 1, performanceMode: false }],
			},
			{
				code: `
const _ianitor = Ianitor.string;
type ComplexAlias = {
    id: string;
    values: number[];
};
`,
				errors: [{ messageId: "missingIanitorCheckType" }],
				options: [{ baseThreshold: 1, interfacePenalty: 1 }],
			},
			{
				code: `
const _ianitor = Ianitor.string;
interface ComplexService extends Base {
    config: {
        mode: string;
    };
}
`,
				errors: [{ messageId: "complexInterfaceNeedsCheck" }],
				options: [{ baseThreshold: 1, interfacePenalty: 1 }],
			},
			{
				code: `
const isUser = Ianitor.strictInterface({
    name: Ianitor.string,
});
export type User = Ianitor.Static<typeof Validators.isUser>;
`,
				errors: [{ messageId: "missingIanitorCheckType" }],
			},
		],
		valid: [
			// Simple types (score < 10)
			{
				code: "type Simple = string;",
			},
			{
				code: "type BasicObject = { id: string; name: string };",
			},
			{
				code: "const isSimple = Ianitor.string;",
			},
			// Has annotation
			{
				code: "const isTyped: Ianitor.Check<SomeType> = Ianitor.interface({ name: Ianitor.string });",
			},
			// Destructuring does not declare an Ianitor validator variable.
			{
				code: `
const { isUser } = Ianitor.strictInterface({
    name: Ianitor.string,
    age: Ianitor.number,
});
`,
			},
			// Simple validator that should pass
			{
				code: "const validator = Ianitor.strictInterface({ name: Ianitor.string });",
				options: [{ baseThreshold: 20 }],
			},
			// Computed member call (covers calculateIanitorComplexity early-return)
			{
				code: "const validator = Ianitor['string']();",
				options: [{ baseThreshold: 20 }],
			},
			// Interface() without object expression argument (covers interface case fallback)
			{
				code: "const validator = Ianitor.interface();",
				options: [{ baseThreshold: 20 }],
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
			},
			// Various Ianitor validator methods
			{
				code: "const validator = Ianitor.optional(Ianitor.string);",
				options: [{ baseThreshold: 20 }],
			},
			{
				code: "const validator = Ianitor.array(Ianitor.number);",
				options: [{ baseThreshold: 20 }],
			},
			{
				code: "const validator = Ianitor.record(Ianitor.string, Ianitor.number);",
				options: [{ baseThreshold: 20 }],
			},
			{
				code: "const validator = Ianitor.map(Ianitor.string, Ianitor.number);",
				options: [{ baseThreshold: 20 }],
			},
			{
				code: "const validator = Ianitor.union(Ianitor.string, Ianitor.number);",
				options: [{ baseThreshold: 20 }],
			},
			{
				code: "const validator = Ianitor.union();",
				options: [{ baseThreshold: 20 }],
			},
			{
				code: "const validator = Ianitor.intersection(Ianitor.string, Ianitor.number);",
				options: [{ baseThreshold: 20 }],
			},
			{
				code: "const validator = Ianitor.instanceIsA(SomeClass);",
				options: [{ baseThreshold: 20 }],
			},
			{
				code: "const validator = Ianitor.instanceOf(SomeClass);",
				options: [{ baseThreshold: 20 }],
			},
			{
				code: "const validator = Ianitor.boolean;",
				options: [{ baseThreshold: 20 }],
			},
			// Type aliases with various complexity levels
			{
				code: "type SimpleUnion = string | number;",
			},
			{
				code: "type SimpleIntersection = { a: string } & { b: number };",
				options: [{ baseThreshold: 30 }],
			},
			{
				code: "type SimpleArray = Array<string>;",
			},
			{
				code: "type SimpleTuple = [string, number];",
			},
			{
				code: "type TupleWithSkippedElements = [name?: string, ...scores: number[]];",
			},
			{
				code: "type SimpleConditional<T> = T extends string ? string : number;",
			},
			{
				code: "type SimpleMapped<T> = { [K in keyof T]: T[K] };",
			},
			{
				code: "type KeyMap<T> = { [K in keyof T]?: string };",
			},
			{
				code: "type KeyPresenceMap<T> = { [K in keyof T]; };",
			},
			{
				code: "type ModifierMap<T> = { [K in keyof T]+?: never };",
			},
			{
				code: "type SimpleFunction = (a: string) => number;",
			},
			{
				code: "type BoundFunction = (this: Context) => void;",
			},
			{
				code: "type RestFunction = (...values: string[]) => void;",
			},
			{
				code: "type DestructuredFunction = ({ value }: { value: string }) => void;",
			},
			{
				code: "type LooseFunction = (value) => void;",
			},
			{
				code: "type SimpleGeneric<T> = { data: T };",
			},
			{
				code: "type CallableObject = { (value: string): boolean; label: string };",
				options: [{ baseThreshold: 30 }],
			},
			{
				code: "interface BasicService { id: string; name: string; }",
				options: [{ errorThreshold: 1, interfacePenalty: 20 }],
			},
			{
				code: "interface UntypedHandler { handle(value); }",
				options: [{ errorThreshold: 1, interfacePenalty: 20 }],
			},
			// Function declarations with return types
			{
				code: "function foo(): string { return 'x'; }",
			},
			{
				code: "const bar = function(): number { return 42; };",
			},
			// Types with primitive keywords
			{
				code: "type PrimitiveUnion = string | number | boolean | null | undefined | void | symbol | bigint;",
				options: [{ baseThreshold: 30 }],
			},
			// Nested arrays
			{
				code: "type NestedArray = Array<Array<string>>;",
			},
			// Non-Ianitor type aliases
			{
				code: "type RegularType = { data: string };",
			},
			// Ianitor primitive validators (low complexity, should pass)
			{
				code: "const validator = Ianitor.string();",
				options: [{ baseThreshold: 20 }],
			},
			{
				code: "const validator = Ianitor.number();",
				options: [{ baseThreshold: 20 }],
			},
			// Complex arrays
			{
				code: "type DeepArray = string[][][];",
			},
			{
				code: "type ComplexArrayType = Array<Array<{ id: string }>>;",
				options: [{ baseThreshold: 30 }],
			},
			// Special TypeScript keywords
			{
				code: "type NeverType = never;",
			},
			{
				code: "type UnknownType = unknown;",
			},
			{
				code: "type AnyType = any;",
			},
			// LuaTuple types cannot be Ianitor'd
			{
				code: "type TimeTuple = LuaTuple<[days: number, hours: number, minutes: number, seconds: number]>;",
			},
			{
				code: "type WrappedTuple = Readonly<LuaTuple<[a: string, b: number]>>;",
			},
			// Non-Ianitor call expressions (to hit isIanitorValidator false path)
			{
				code: "const result = someFunction();",
			},
			{
				code: "const data = OtherLib.method();",
			},
		],
	});
});
