import { describe, setDefaultTimeout } from "bun:test";
import { dirname, join, resolve } from "node:path";
import parser from "@typescript-eslint/parser";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { fileURLToPath } from "bun";

import rule from "../../src/rules/dot-notation";

import type { InvalidTestCase, ValidTestCase } from "@typescript-eslint/rule-tester";

import type { DotNotationOptions } from "../../src/rules/dot-notation";

const __dirname = dirname(fileURLToPath(import.meta.url));
const testsDir = resolve(__dirname, "..");
const fixturesDir = join(testsDir, "fixtures", "dot-notation");
const fixtureProjectPath = join(fixturesDir, "tsconfig.json");

setDefaultTimeout(30_000);

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser,
		parserOptions: {
			project: fixtureProjectPath,
			tsconfigRootDir: fixturesDir,
		},
		sourceType: "module",
	},
});

type RuleOptions = [DotNotationOptions?];
type MessageIds = "useBrackets" | "useDot";
type RuleInvalidCase = InvalidTestCase<MessageIds, RuleOptions>;
type RuleValidCase = ValidTestCase<RuleOptions>;

interface RuleTestCase {
	readonly filename?: string;
}

function withStableFilenames<TTestCase extends RuleTestCase>(
	cases: ReadonlyArray<TTestCase>,
	_prefix: string,
): Array<TTestCase> {
	return cases.map((testCase) => ({
		...testCase,
		filename: "case.ts",
	}));
}

describe("dot-notation", () => {
	ruleTester.run("dot-notation", rule, {
		invalid: withStableFilenames<RuleInvalidCase>(
			[
				{
					code: `
interface PublicBox {
	name: number;
}

function incrementValue(object: PublicBox): void {
	object["name"] += 1;
}
				`,
					errors: [{ messageId: "useDot" }],
					output: `
interface PublicBox {
	name: number;
}

function incrementValue(object: PublicBox): void {
	object.name += 1;
}
				`,
				},
				{
					code: `
interface PublicBox {
	name: number;
}

function incrementValue(object: PublicBox): void {
	object[\`name\`] += 1;
}
				`,
					errors: [{ messageId: "useDot" }],
					output: `
interface PublicBox {
	name: number;
}

function incrementValue(object: PublicBox): void {
	object.name += 1;
}
				`,
				},
				{
					code: `
declare const keywords: Record<string, number>;

keywords.default += 1;
				`,
					errors: [{ messageId: "useBrackets" }],
					options: [{ allowKeywords: false }],
					output: `
declare const keywords: Record<string, number>;

keywords["default"] += 1;
				`,
				},
				{
					code: `
function incrementValue(object: ExampleClass): void {
	object["value"] += 1;
}

class ExampleClass {
	private value = 0;
}
				`,
					errors: [{ messageId: "useDot" }],
					output: `
function incrementValue(object: ExampleClass): void {
	object.value += 1;
}

class ExampleClass {
	private value = 0;
}
				`,
				},
				{
					code: `
class ExampleClass {
	private value = 0;

	public incrementBy(): void {
		this["value"] += 1;
	}
}
				`,
					errors: [{ messageId: "useDot" }],
					options: [{ allowInaccessibleClassPropertyAccess: true, environment: "roblox-ts" }],
					output: `
class ExampleClass {
	private value = 0;

	public incrementBy(): void {
		this.value += 1;
	}
}
				`,
				},
				{
					code: `
class ExampleClass {
	protected value = 0;
}

class Derived extends ExampleClass {
	public incrementBy(): void {
		this["value"] += 1;
	}
}
				`,
					errors: [{ messageId: "useDot" }],
					options: [{ allowInaccessibleClassPropertyAccess: true, environment: "roblox-ts" }],
					output: `
class ExampleClass {
	protected value = 0;
}

class Derived extends ExampleClass {
	public incrementBy(): void {
		this.value += 1;
	}
}
				`,
				},
				{
					code: `
interface PublicBox {
	name: number;
}

declare const object: PublicBox;
declare const other: object;

const result = object["name"]in other;
					`,
					errors: [{ messageId: "useDot" }],
					output: `
interface PublicBox {
	name: number;
}

declare const object: PublicBox;
declare const other: object;

const result = object.name in other;
					`,
				},
				{
					code: `
0["toFixed"]();
					`,
					errors: [{ messageId: "useDot" }],
					output: `
0 .toFixed();
					`,
				},
				{
					code: `
declare const values: Record<string, number>;

values[true] += 1;
					`,
					errors: [{ messageId: "useDot" }],
					output: `
declare const values: Record<string, number>;

values.true += 1;
					`,
				},
				{
					code: `
declare const values: Record<string, number>;

values[null] += 1;
					`,
					errors: [{ messageId: "useDot" }],
					output: `
declare const values: Record<string, number>;

values.null += 1;
					`,
				},
				{
					code: `
interface PublicBox {
	name: number;
}

declare const object: PublicBox | undefined;

object?.["name"];
					`,
					errors: [{ messageId: "useDot" }],
					output: `
interface PublicBox {
	name: number;
}

declare const object: PublicBox | undefined;

object?.name;
					`,
				},
			],
			"invalid",
		),
		valid: withStableFilenames<RuleValidCase>(
			[
				{
					code: `
function incrementValue(object: ExampleClass): void {
	object["value"] += 1;
}

class ExampleClass {
	private value = 0;
}
				`,
					options: [{ allowInaccessibleClassPropertyAccess: true, environment: "roblox-ts" }],
				},
				{
					code: `
function incrementValue(object: ExampleClass): void {
	object["value"] += 1;
}

class ExampleClass {
	protected value = 0;
}
				`,
					options: [{ allowInaccessibleClassPropertyAccess: true, environment: "roblox-ts" }],
				},
				{
					code: `
function incrementValue(object: ExampleClass): void {
	object["value"] += 1;
}

class ExampleClass {
	private value = 0;
}
				`,
					options: [{ allowPrivateClassPropertyAccess: true }],
				},
				{
					code: `
function incrementValue(object: ExampleClass): void {
	object["value"] += 1;
}

class ExampleClass {
	protected value = 0;
}
				`,
					options: [{ allowProtectedClassPropertyAccess: true }],
				},
				{
					code: `
type ValueMap = {
	[key: string]: number;
};

declare const values: ValueMap;

values["score"] += 1;
				`,
					options: [{ allowIndexSignaturePropertyAccess: true }],
				},
				{
					code: `
declare const values: Record<number, number>;

values[1] += 1;
				`,
				},
				{
					code: `
declare const keywords: Record<string, number>;

keywords["default"] += 1;
				`,
					options: [{ allowKeywords: false }],
				},
				{
					code: `
declare const ignored: Record<string, number>;

ignored["__value"] += 1;
				`,
					options: [{ allowPattern: "^__" }],
				},
			],
			"valid",
		),
	});
});
