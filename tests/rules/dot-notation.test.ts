import nodePath from "node:path";
import { describe, vi } from "vitest";
import rule from "$rules/dot-notation";
import parser from "@typescript-eslint/parser";
import { RuleTester } from "@typescript-eslint/rule-tester";

import type { DotNotationOptions } from "$rules/dot-notation";
import type { InvalidTestCase, ValidTestCase } from "@typescript-eslint/rule-tester";

const __dirname = import.meta.dirname;
const testsDir = nodePath.resolve(__dirname, "..");
const fixturesDir = nodePath.join(testsDir, "fixtures", "dot-notation");
const fixtureProjectPath = nodePath.join(fixturesDir, "tsconfig.json");

vi.setConfig({ testTimeout: 30_000 });

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
type EntityReference<TKey extends string> = {
    readonly [key in TKey]: number;
};

declare const reference: EntityReference<"entityId">;

reference["entityId"];
	                `,
					errors: [{ messageId: "useDot" }],
					output: `
type EntityReference<TKey extends string> = {
    readonly [key in TKey]: number;
};

declare const reference: EntityReference<"entityId">;

reference.entityId;
	                `,
				},
				{
					code: `
declare const object: { name: number } | { name: number };

object["name"];
	                `,
					errors: [{ messageId: "useDot" }],
					output: `
declare const object: { name: number } | { name: number };

object.name;
	                `,
				},
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
    public value = 0;

    public incrementBy(): void {
        this["value"] += 1;
    }
}
                `,
					errors: [{ messageId: "useDot" }],
					options: [{ allowInaccessibleClassPropertyAccess: true, environment: "roblox-ts" }],
					output: `
class ExampleClass {
    public value = 0;

    public incrementBy(): void {
        this.value += 1;
    }
}
                `,
				},
				{
					code: `
interface EmptyBox {}

declare const object: EmptyBox;

object["name"];
                `,
					errors: [{ messageId: "useDot" }],
					options: [{ allowInaccessibleClassPropertyAccess: true, environment: "roblox-ts" }],
					output: `
interface EmptyBox {}

declare const object: EmptyBox;

object.name;
                `,
				},
				{
					code: `
type Entry<TValue> = {
    value: TValue;
};

export default class SomeClass<TKey, TValue extends NonNullable<unknown>> {
    private readonly entries = new Map<TKey, Entry<TValue>>();

    public clear(): void {
        this["entries"].clear();
    }
}
                `,
					errors: [{ messageId: "useDot" }],
					options: [{ allowInaccessibleClassPropertyAccess: true, environment: "roblox-ts" }],
					output: `
type Entry<TValue> = {
    value: TValue;
};

export default class SomeClass<TKey, TValue extends NonNullable<unknown>> {
    private readonly entries = new Map<TKey, Entry<TValue>>();

    public clear(): void {
        this.entries.clear();
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

const result = object["name"] in other;
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
interface PublicBox {
    name: number;
}

declare const object: PublicBox;

object[\`na\\u006de\`];
                    `,
					errors: [{ messageId: "useDot" }],
					output: `
interface PublicBox {
    name: number;
}

declare const object: PublicBox;

object.name;
                    `,
				},
				{
					code: `
declare const object: object;

object["toString"];
                    `,
					errors: [{ messageId: "useDot" }],
					output: `
declare const object: object;

object.toString;
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
				{
					code: `
interface PublicBox {
    name: number;
}

declare const object: PublicBox;

object[
    /* keep */
    "name"
];
                    `,
					errors: [{ messageId: "useDot" }],
					output: null,
				},
				{
					code: `
interface PublicBox {
    name: number;
}

declare const object: PublicBox;
declare const nextValue: number;

const result = object["name"]+ ++nextValue;
                    `,
					errors: [{ messageId: "useDot" }],
					output: `
interface PublicBox {
    name: number;
}

declare const object: PublicBox;
declare const nextValue: number;

const result = object.name+ ++nextValue;
                    `,
				},
				{
					code: `
interface PublicBox {
    name: number;
}

declare const object: PublicBox;
declare const nextValue: number;

const result = object["name"]- --nextValue;
                    `,
					errors: [{ messageId: "useDot" }],
					output: `
interface PublicBox {
    name: number;
}

declare const object: PublicBox;
declare const nextValue: number;

const result = object.name- --nextValue;
                    `,
				},
				{
					code: `
interface PublicBox {
    name: number;
}

declare const object: PublicBox;

const result = object["name"]/* comment */;
                    `,
					errors: [{ messageId: "useDot" }],
					output: `
interface PublicBox {
    name: number;
}

declare const object: PublicBox;

const result = object.name/* comment */;
                    `,
				},
				{
					code: `
interface PublicBox {
    name: number;
}

declare const object: PublicBox;

object["name"]
                    `,
					errors: [{ messageId: "useDot" }],
					output: `
interface PublicBox {
    name: number;
}

declare const object: PublicBox;

object.name
                    `,
				},
				{
					code: `
declare const keywords: Record<string, number> | undefined;

keywords?.default;
                `,
					errors: [{ messageId: "useBrackets" }],
					options: [{ allowKeywords: false }],
					output: `
declare const keywords: Record<string, number> | undefined;

keywords?.["default"];
                `,
				},
				{
					code: `
declare const let: Record<string, number>;

let.default;
                `,
					errors: [{ messageId: "useBrackets" }],
					options: [{ allowKeywords: false }],
					output: null,
				},
				{
					code: `
declare const keywords: Record<string, number>;

keywords./* keep */default;
                `,
					errors: [{ messageId: "useBrackets" }],
					options: [{ allowKeywords: false }],
					output: null,
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
    object["value"]++;
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
				{
					code: `
interface PublicBox {
    name: number;
}

declare const object: PublicBox;
declare const key: keyof PublicBox;

object[key];
                `,
				},
				{
					code: `
interface PublicBox {
    name: number;
}

declare const object: PublicBox;
declare const suffix: string;

object[\`name\${suffix}\`];
                `,
				},
			],
			"valid",
		),
	});
});
