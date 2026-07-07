import { describe, expect, it } from "vitest";
import rule, { createFastFormatRule, createFormatCache, getLocFromIndex } from "$rules/fast-format";
import { generateDifferences, showInvisibles } from "$utilities/format-utilities";
import { RuleTester } from "eslint";

const languageOptions = {
	ecmaVersion: 2022,
	sourceType: "module",
};

const ruleTester = new RuleTester({
	languageOptions,
});

function* formatterFailures(): Generator<string, string, unknown> {
	yield "";
	return "";
}

function throwFormatterStringFailure(): string {
	const failure = formatterFailures();
	failure.next();
	return failure.throw("formatter string failure").value;
}

describe("fast-format", () => {
	ruleTester.run("fast-format", rule, {
		invalid: [
			{
				code: "const x=1",
				errors: [{ messageId: "INSERT" }, { messageId: "INSERT" }, { messageId: "INSERT" }],
				filename: "test.ts",
				name: "missing semicolon and spacing",
				output: "const x = 1;\n",
			},
			{
				code: "const x = 1",
				errors: [{ messageId: "INSERT" }],
				filename: "test.ts",
				name: "missing semicolon only",
				output: "const x = 1;\n",
			},
			{
				code: "function foo() {\nreturn 42;\n}",
				errors: [{ messageId: "INSERT" }, { messageId: "INSERT" }],
				filename: "test.ts",
				name: "wrong indentation (spaces instead of tabs)",
				output: "function foo() {\n\treturn 42;\n}\n",
			},
			{
				code: "const x=1;const y=2;",
				errors: [
					{ messageId: "INSERT" },
					{ messageId: "INSERT" },
					{ messageId: "INSERT" },
					{ messageId: "INSERT" },
					{ messageId: "INSERT" },
					{ messageId: "INSERT" },
				],
				filename: "test.ts",
				name: "multiple formatting issues",
				output: "const x = 1;\nconst y = 2;\n",
			},
			{
				code: 'const str = "hello"',
				errors: [{ messageId: "INSERT" }],
				filename: "test.ts",
				name: "missing semicolon",
				output: 'const str = "hello";\n',
			},
		],
		valid: [
			{
				code: "const x = 1;\n",
				filename: "test.ts",
				name: "already formatted code with semicolon",
			},
			{
				code: "function foo() {\n\treturn 42;\n}\n",
				filename: "test.ts",
				name: "already formatted function with tabs",
			},
			{
				code: "",
				filename: "test.ts",
				name: "empty file",
			},
			{
				code: "const obj = {\n\tfoo: 1,\n\tbar: 2,\n};\n",
				filename: "test.ts",
				name: "object with trailing comma",
			},
			{
				code: "const x=1",
				filename: "styles.css",
				name: "ignores non-js-ts files",
			},
		],
	});

	const cachingCache = createFormatCache(1);
	const cacheGuardRule = createFastFormatRule({
		cache: cachingCache,
		services: {
			format(source) {
				if (source.includes(" = ")) throw new Error(`formatted input should be cached: ${source}`);
				return source === "const cached=2" ? "const cached = 2;\n" : "const cached = 1;\n";
			},
			generate: generateDifferences,
			show: showInvisibles,
		},
	});

	const cachingTester = new RuleTester({ languageOptions });
	cachingTester.run("format (cached)", cacheGuardRule, {
		invalid: [
			{
				code: "const cached=1",
				errors: [{ messageId: "INSERT" }, { messageId: "INSERT" }, { messageId: "INSERT" }],
				filename: "test.ts",
				name: "caches formatted + already formatted",
				output: "const cached = 1;\n",
			},
			{
				code: "const cached=2",
				errors: [{ messageId: "INSERT" }, { messageId: "INSERT" }, { messageId: "INSERT" }],
				filename: "test.ts",
				name: "evicts older cache entries when limit reached",
				output: "const cached = 2;\n",
			},
		],
		valid: [],
	});

	const errorCache = createFormatCache(4);
	let attempts = 0;
	const failingRule = createFastFormatRule({
		cache: errorCache,
		services: {
			format() {
				attempts += 1;
				if (attempts > 1) throw new Error("cached error not reused");
				throw new Error("formatter broke");
			},
		},
	});

	const failingTester = new RuleTester({ languageOptions });
	failingTester.run("format (errors)", failingRule, {
		invalid: [
			{
				code: "const broke=1",
				errors: [{ message: "Oxfmt error: formatter broke" }],
				filename: "test.ts",
				name: "surface formatter errors once",
			},
		],
		valid: [],
	});
	failingTester.run("format (errors, cached)", failingRule, {
		invalid: [
			{
				code: "const broke=1",
				errors: [{ message: "Oxfmt error: formatter broke" }],
				filename: "test.ts",
				name: "uses cached error instead of reformatting",
			},
		],
		valid: [],
	});

	const nonErrorThrowRule = createFastFormatRule({
		cache: createFormatCache(1),
		services: {
			format() {
				return throwFormatterStringFailure();
			},
		},
	});

	const nonErrorThrowTester = new RuleTester({ languageOptions });
	nonErrorThrowTester.run("format (non-error throw)", nonErrorThrowRule, {
		invalid: [
			{
				code: "const stringFailure=1",
				errors: [{ message: "Oxfmt error: formatter string failure" }],
				filename: "test.ts",
				name: "surfaces non-error formatter failures",
			},
		],
		valid: [],
	});

	const deleteOnlyRule = createFastFormatRule({
		cache: createFormatCache(1),
		services: {
			format() {
				return "ab";
			},
			generate() {
				return [{ deleteText: "c", offset: 2, operation: "DELETE" }];
			},
			show: showInvisibles,
		},
	});

	const deleteOnlyTester = new RuleTester({ languageOptions });
	deleteOnlyTester.run("format (delete only)", deleteOnlyRule, {
		invalid: [
			{
				code: "abc",
				errors: [{ messageId: "DELETE" }],
				filename: "test.ts",
				name: "handles delete-only differences",
				output: "ab",
			},
		],
		valid: [],
	});

	it("clears caches on demand", () => {
		expect.assertions(2);
		const cache = createFormatCache(1);
		const stored = cache.set("key", { kind: "error", message: "boom" });
		expect(stored).toStrictEqual({ kind: "error", message: "boom" });
		cache.clear();
		expect(cache.get("key")).toBeUndefined();
	}, 250);
});

describe("getLocFromIndex", () => {
	it("returns a minimal location when getLocFromIndex is missing", () => {
		expect.assertions(1);
		expect(getLocFromIndex({ text: "abc" }, 2)).toStrictEqual({ column: 2, line: 1 });
	}, 250);
});
