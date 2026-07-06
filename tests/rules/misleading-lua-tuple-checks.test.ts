import nodePath from "node:path";
import { describe, vi } from "vitest";
import rule from "$rules/misleading-lua-tuple-checks";
import tsParser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";

const testDirectory = import.meta.dirname;

vi.setConfig({ testTimeout: 30_000 });

const fixturesDir = nodePath.join(testDirectory, "../fixtures/misleading-lua-tuple-checks");
const filename = nodePath.join(fixturesDir, "input.ts");

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser: tsParser,
		parserOptions: {
			ecmaFeatures: { jsx: true },
			projectService: {
				allowDefaultProject: ["*.ts", "*.tsx"],
				defaultProject: nodePath.join(fixturesDir, "tsconfig.json"),
				maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 64,
			},
			tsconfigRootDir: fixturesDir,
		},
		sourceType: "module",
	},
});

const iterableDeclarations =
	"interface IterableFunction<T> { (this: unknown): T; } declare function getIterable(): IterableFunction<LuaTuple<[string]>>;";

const callableIterableDeclarations =
	"type CallableTupleIterable = { (): LuaTuple<[string]>; }; declare const callableTupleIterable: CallableTupleIterable;";

const constrainedIterableDeclarations =
	"declare function getConstrainedIterable<T extends IterableFunction<LuaTuple<[string]>>>(): T;";

const wrappedIterableDeclarations =
	"type WrappedIterable<T> = IterableFunction<T>; declare function getWrappedIterable(): WrappedIterable<LuaTuple<[string]>>;";

const wrappedTargetDeclarations =
	"type TupleAlias = LuaTuple<[string]>; type WrappedTarget = IterableFunction<TupleAlias>; declare const wrappedTarget: WrappedTarget;";

const wrappedArrayDeclarations =
	"type WrappedArray<T> = Array<T>; declare const wrappedArray: WrappedArray<LuaTuple<[string]>>;";

const namespacedIterableDeclarations =
	"declare namespace Types { interface IterableFunction<T> { (this: unknown): T; } }";

const tupleDeclarations = `
type LuaTuple<T extends unknown[]> = T & { readonly LUA_TUPLE: never };
interface LuaSignal<T extends unknown[]> {
    Wait(): LuaTuple<T>;
}
interface Player {}
interface PlayersService {
    PlayerAdded: LuaSignal<[Player]>;
}
interface Game {
    Loaded: LuaSignal<[boolean]>;
    GetService(name: "Players"): PlayersService;
}
declare const game: Game;
`;

const validSamples = [
	"if (true) {}",
	"if (someVar) {}",
	"if (game.Loaded.Wait()[0]) {}",
	"while (game.Loaded.Wait()[0]) {}",
	"do {} while (game.Loaded.Wait()[0]);",
	"for (const [i] of [1, 2, 3]) {}",
	"for (let i = 0; game.Loaded.Wait()[0]; i++) {}",
	`${wrappedIterableDeclarations} for (const [value] of getWrappedIterable()) {}`,
	`${wrappedTargetDeclarations} for (const [value] of wrappedTarget) {}`,
	"if (!game.Loaded.Wait()[0]) {}",
	"if (a && game.Loaded.Wait()[0]) {}",
	"if (game.Loaded.Wait()[0] || b) {}",
	"function check<T extends LuaTuple<[string]>>(tuple: T) { if (tuple[0]) {} }",
	"interface EmptyReference { [Symbol.iterator](): Iterator<string>; } declare const emptyReference: EmptyReference; for (const value of emptyReference) {}",
	"interface IterableFunction<T> { (this: unknown): T; } function iterate<T extends IterableFunction<string>>(iterable: T) { for (const value of iterable) {} }",
	"function iterate<T extends string>([iterable]: [T]) { for (const value of iterable) {} }",
	"function iterate(iterable: string[]) { for (const value of iterable) {} }",
	"declare namespace Types { type Box<T> = { value: T }; } declare const values: Types.Box<LuaTuple<[string]>>; for (const value of values) {}",
	"type Box<T> = { values: Array<T> }; declare const boxed: Box<LuaTuple<[string]>>; for (const value of boxed) {}",
	"interface IterableFunction<T = string> { (this: unknown): T; } declare const bareIterable: IterableFunction; for (const value of bareIterable) {}",
	"function iterate<T extends string, U extends IterableFunction<LuaTuple<[string]>>>(iterable: T) { for (const value of iterable) {} }",
	"declare const values: MissingArrayAlias<LuaTuple<[string]>>; for (const value of values) {}",
	"type CircularArray<T> = CircularArray<T>; declare const values: CircularArray<LuaTuple<[string]>>; for (const value of values) {}",
	"interface IterableFunction { (this: unknown): string; } declare const bareIterable: IterableFunction; for (const value of bareIterable) {}",
	"const createValues = () => [1, 2, 3]; for (const value of createValues()) {}",
	"function createValues() { return [1, 2, 3]; } for (const value of createValues()) {}",
	"function createValues(): Array<number> { return [1, 2, 3]; } for (const value of createValues()) {}",
	"function createValues(): number[] { return [1, 2, 3]; } for (const value of createValues()) {}",
	"function createValues(): number[] { return [1, 2, 3]; } for (const first of createValues()) {} for (const second of createValues()) {}",
	"declare namespace Types { type Values = Array<number>; } function createValues(): Types.Values { return [1, 2, 3]; } for (const value of createValues()) {}",
	"declare const source: { create: Function }; for (const value of source.create()) {}",
	"declare const createValues: Function; for (const value of createValues()) {}",
	"for (const value of (function (): number[] { return []; })()) {}",
	"for (const value of missingIterable) {}",
	"(function (): number[] { return []; })();",
	"if (typeof game.Loaded.Wait()) {}",
	`${namespacedIterableDeclarations} declare const values: Types.IterableFunction<string>; for (const value of values()) {}`,
	`${namespacedIterableDeclarations} function iterate(iterable: Types.IterableFunction<string>) { for (const value of iterable) {} }`,
	'const [player] = game.GetService("Players").PlayerAdded.Wait();',
	'const player = game.GetService("Players").PlayerAdded.Wait()[0];',
	"let player: LuaTuple<[Player]>;",
	'let player: LuaTuple<[Player]>; player = game.GetService("Players").PlayerAdded.Wait();',
	"type FakeLuaTuple = { readonly LUA_TUPLE: never }; declare function getFake(): FakeLuaTuple; if (getFake()) {}",
];

const valid = validSamples.map((code) => ({
	code: `${tupleDeclarations}\n${code}`,
	filename,
}));

const invalidCases = [
	{
		code: "if (game.Loaded.Wait()) {}",
		errors: [{ messageId: "misleadingLuaTupleCheck" }],
		output: "if (game.Loaded.Wait()[0]) {}",
	},
	{
		code: "const result = game.Loaded.Wait() ? 1 : 0;",
		errors: [{ messageId: "misleadingLuaTupleCheck" }],
		output: "const result = game.Loaded.Wait()[0] ? 1 : 0;",
	},
	{
		code: "const result = game.Loaded.Wait() ? game.Loaded.Wait()[0] : undefined;",
		errors: [{ messageId: "misleadingLuaTupleCheck" }],
		output: "const result = game.Loaded.Wait()[0] ? game.Loaded.Wait()[0] : undefined;",
	},
	{
		code: "while (game.Loaded.Wait()) {}",
		errors: [{ messageId: "misleadingLuaTupleCheck" }],
		output: "while (game.Loaded.Wait()[0]) {}",
	},
	{
		code: "do {} while (game.Loaded.Wait());",
		errors: [{ messageId: "misleadingLuaTupleCheck" }],
		output: "do {} while (game.Loaded.Wait()[0]);",
	},
	{
		code: "for (let i = 0; game.Loaded.Wait(); i++) {}",
		errors: [{ messageId: "misleadingLuaTupleCheck" }],
		output: "for (let i = 0; game.Loaded.Wait()[0]; i++) {}",
	},
	{
		code: "for (const x of game.Loaded.Wait()) {}",
		errors: [{ messageId: "misleadingLuaTupleCheck" }],
		output: "for (const x of game.Loaded.Wait()[0]) {}",
	},
	{
		code: "if (!game.Loaded.Wait()) {}",
		errors: [{ messageId: "misleadingLuaTupleCheck" }],
		output: "if (!game.Loaded.Wait()[0]) {}",
	},
	{
		code: "if (a && game.Loaded.Wait()) {}",
		errors: [{ messageId: "misleadingLuaTupleCheck" }],
		output: "if (a && game.Loaded.Wait()[0]) {}",
	},
	{
		code: "if (game.Loaded.Wait() || b) {}",
		errors: [{ messageId: "misleadingLuaTupleCheck" }],
		output: "if (game.Loaded.Wait()[0] || b) {}",
	},
	{
		code: "if (game.Loaded.Wait() && game.Loaded.Wait()) {}",
		errors: [{ messageId: "misleadingLuaTupleCheck" }, { messageId: "misleadingLuaTupleCheck" }],
		output: "if (game.Loaded.Wait()[0] && game.Loaded.Wait()[0]) {}",
	},
	{
		code: "if (a ?? game.Loaded.Wait()) {}",
		errors: [{ messageId: "misleadingLuaTupleCheck" }],
		output: "if (a ?? game.Loaded.Wait()[0]) {}",
	},
	{
		code: "if (game.Loaded.Wait() ?? b) {}",
		errors: [{ messageId: "misleadingLuaTupleCheck" }],
		output: "if (game.Loaded.Wait()[0] ?? b) {}",
	},
	{
		code: "if (game.Loaded.Wait() && game.Loaded.Wait()[0]) {}",
		errors: [{ messageId: "misleadingLuaTupleCheck" }],
		output: "if (game.Loaded.Wait()[0] && game.Loaded.Wait()[0]) {}",
	},
	{
		code: 'const player = game.GetService("Players").PlayerAdded.Wait();',
		errors: [{ messageId: "luaTupleDeclaration" }],
		output: 'const [player] = game.GetService("Players").PlayerAdded.Wait();',
	},
	{
		code: 'const player: LuaTuple<[Player]> = game.GetService("Players").PlayerAdded.Wait();',
		errors: [{ messageId: "luaTupleDeclaration" }],
		output: 'const [player]: LuaTuple<[Player]> = game.GetService("Players").PlayerAdded.Wait();',
	},
	{
		code: 'let player: Player; player = game.GetService("Players").PlayerAdded.Wait();',
		errors: [{ messageId: "luaTupleDeclaration" }],
		output: 'let player: Player; [player] = game.GetService("Players").PlayerAdded.Wait();',
	},
	{
		code: `${iterableDeclarations} for (const x of getIterable()) {}`,
		errors: [{ messageId: "luaTupleDeclaration" }],
		output: `${iterableDeclarations} for (const [x] of getIterable()) {}`,
	},
	{
		code: `${iterableDeclarations} for (const first of getIterable()) {} for (const second of getIterable()) {}`,
		errors: [{ messageId: "luaTupleDeclaration" }, { messageId: "luaTupleDeclaration" }],
		output: `${iterableDeclarations} for (const [first] of getIterable()) {} for (const [second] of getIterable()) {}`,
	},
	{
		code: `${iterableDeclarations} let x; for (x of getIterable()) {}`,
		errors: [{ messageId: "luaTupleDeclaration" }],
		output: `${iterableDeclarations} let x; for ([x] of getIterable()) {}`,
	},
	{
		code: `${callableIterableDeclarations} for (const value of callableTupleIterable) {}`,
		errors: [{ messageId: "luaTupleDeclaration" }],
		output: `${callableIterableDeclarations} for (const [value] of callableTupleIterable) {}`,
	},
	{
		code: `${constrainedIterableDeclarations} for (const value of getConstrainedIterable()) {}`,
		errors: [{ messageId: "luaTupleDeclaration" }],
		output: `${constrainedIterableDeclarations} for (const [value] of getConstrainedIterable()) {}`,
	},
	{
		code: "function createIterable<T extends IterableFunction<LuaTuple<[string]>>>(): T { throw new Error(); } for (const value of createIterable()) {}",
		errors: [{ messageId: "luaTupleDeclaration" }],
		output: "function createIterable<T extends IterableFunction<LuaTuple<[string]>>>(): T { throw new Error(); } for (const [value] of createIterable()) {}",
	},
	{
		code: "function iterate<T extends IterableFunction<LuaTuple<[string]>>>(iterable: T) { for (const value of iterable) {} }",
		errors: [{ messageId: "luaTupleDeclaration" }],
		output: "function iterate<T extends IterableFunction<LuaTuple<[string]>>>(iterable: T) { for (const [value] of iterable) {} }",
	},
	{
		code: `${wrappedArrayDeclarations} for (const value of wrappedArray) {}`,
		errors: [{ messageId: "luaTupleDeclaration" }],
		output: `${wrappedArrayDeclarations} for (const [value] of wrappedArray) {}`,
	},
	{
		code: "function check<T extends LuaTuple<[string]>>(tuple: T) { if (tuple) {} }",
		errors: [{ messageId: "misleadingLuaTupleCheck" }],
		output: "function check<T extends LuaTuple<[string]>>(tuple: T) { if (tuple[0]) {} }",
	},
	{
		code: "interface TupleIndexIterable { [index: number]: LuaTuple<[string]>; } declare const tupleIndexIterable: TupleIndexIterable; for (const value of tupleIndexIterable) {}",
		errors: [{ messageId: "luaTupleDeclaration" }],
		output: "interface TupleIndexIterable { [index: number]: LuaTuple<[string]>; } declare const tupleIndexIterable: TupleIndexIterable; for (const [value] of tupleIndexIterable) {}",
	},
	{
		code: `${iterableDeclarations} declare const unionIterable: IterableFunction<LuaTuple<[string]>> | IterableFunction<string>; for (const value of unionIterable) {}`,
		errors: [{ messageId: "luaTupleDeclaration" }],
		output: `${iterableDeclarations} declare const unionIterable: IterableFunction<LuaTuple<[string]>> | IterableFunction<string>; for (const [value] of unionIterable) {}`,
	},
	{
		code: "type ReadonlyWrappedArray<T> = ReadonlyArray<T>; declare const values: ReadonlyWrappedArray<LuaTuple<[string]>>; for (const value of values) {}",
		errors: [{ messageId: "luaTupleDeclaration" }],
		output: "type ReadonlyWrappedArray<T> = ReadonlyArray<T>; declare const values: ReadonlyWrappedArray<LuaTuple<[string]>>; for (const [value] of values) {}",
	},
	{
		code: "declare const values: Array<LuaTuple<[string]>>; for (const value of values) {}",
		errors: [{ messageId: "luaTupleDeclaration" }],
		output: "declare const values: Array<LuaTuple<[string]>>; for (const [value] of values) {}",
	},
	{
		code: "declare const values: LuaTuple<[string]>[]; for (const value of values) {}",
		errors: [{ messageId: "luaTupleDeclaration" }],
		output: "declare const values: LuaTuple<[string]>[]; for (const [value] of values) {}",
	},
	{
		code: "declare const values: [LuaTuple<[string]>]; for (const value of values) {}",
		errors: [{ messageId: "luaTupleDeclaration" }],
		output: "declare const values: [LuaTuple<[string]>]; for (const [value] of values) {}",
	},
	{
		code: "const source = { create<T extends IterableFunction<LuaTuple<[string]>>>(): T { throw new Error(); } }; for (const value of source.create()) {}",
		errors: [{ messageId: "luaTupleDeclaration" }],
		output: "const source = { create<T extends IterableFunction<LuaTuple<[string]>>>(): T { throw new Error(); } }; for (const [value] of source.create()) {}",
	},
];

const invalid = invalidCases.map((testCase) => ({
	code: `${tupleDeclarations}\n${testCase.code}`,
	errors: testCase.errors,
	filename,
	output: `${tupleDeclarations}\n${testCase.output}`,
}));

describe("misleading-lua-tuple-checks", () => {
	// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
	ruleTester.run("misleading-lua-tuple-checks", rule, {
		invalid,
		valid,
	});
});
