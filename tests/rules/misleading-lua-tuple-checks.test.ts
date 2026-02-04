import { describe, setDefaultTimeout } from "bun:test";
import { join } from "node:path";
import tsParser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import rule from "../../src/rules/misleading-lua-tuple-checks";

setDefaultTimeout(30_000);

const fixturesDir = join(__dirname, "../fixtures/misleading-lua-tuple-checks");
const filename = join(fixturesDir, "input.ts");

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser: tsParser,
		parserOptions: {
			ecmaFeatures: { jsx: true },
			projectService: {
				allowDefaultProject: ["*.ts", "*.tsx"],
				defaultProject: join(fixturesDir, "tsconfig.json"),
			},
			tsconfigRootDir: fixturesDir,
		},
		sourceType: "module",
	},
});

const iterableDeclarations =
	"interface IterableFunction<T> { (this: unknown): T; } declare function getIterable(): IterableFunction<LuaTuple<[string]>>;";

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
	"if (!game.Loaded.Wait()[0]) {}",
	"if (a && game.Loaded.Wait()[0]) {}",
	"if (game.Loaded.Wait()[0] || b) {}",
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
		code: `${iterableDeclarations} let x; for (x of getIterable()) {}`,
		errors: [{ messageId: "luaTupleDeclaration" }],
		output: `${iterableDeclarations} let x; for ([x] of getIterable()) {}`,
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
