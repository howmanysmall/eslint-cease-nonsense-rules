import fs from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { __testing, generateDifferences, getExtension } from "@utilities/format-utilities";

vi.setConfig({ testTimeout: 10000 });

describe("format-utilities", () => {
	afterEach(() => {
		__testing.resetConfigCache();
		vi.restoreAllMocks();
	});

	it("should load the same configuration", () => {
		expect.assertions(1);
		const configuration0 = __testing.loadOxfmtConfig();
		const configuration1 = __testing.loadOxfmtConfig();
		expect(configuration0).toBe(configuration1);
	});

	it("returns empty config when file does not exist", () => {
		expect.assertions(1);
		__testing.resetConfigCache();
		vi.spyOn(fs, "readFileSync").mockImplementation(() => {
			throw new Error("ENOENT");
		});
		const config = __testing.loadOxfmtConfig();
		expect(config).toStrictEqual({});
	});

	it("returns empty config when JSON is not an object", () => {
		expect.assertions(1);
		__testing.resetConfigCache();
		vi.spyOn(fs, "readFileSync").mockReturnValue('"just a string"');
		const config = __testing.loadOxfmtConfig();
		expect(config).toStrictEqual({});
	});

	it("returns empty config when JSON is null", () => {
		expect.assertions(1);
		__testing.resetConfigCache();
		vi.spyOn(fs, "readFileSync").mockReturnValue("null");
		const config = __testing.loadOxfmtConfig();
		expect(config).toStrictEqual({});
	});

	it("loads object config and strips non-format keys", () => {
		expect.assertions(1);
		__testing.resetConfigCache();
		vi.spyOn(fs, "readFileSync").mockReturnValue(
			'{"$schema":"https://example.test/schema.json","ignorePatterns":["dist/**"],"lineWidth":120}',
		);
		const config = __testing.loadOxfmtConfig();
		expect(config).toStrictEqual({ lineWidth: 120 });
	});

	describe("getExtension", () => {
		it("returns .tsx for .tsx files", () => {
			expect.assertions(1);
			expect(getExtension("file.tsx")).toBe(".tsx");
		});

		it("returns .ts for .ts files", () => {
			expect.assertions(1);
			expect(getExtension("file.ts")).toBe(".ts");
		});

		it("returns .jsx for .jsx files", () => {
			expect.assertions(1);
			expect(getExtension("file.jsx")).toBe(".jsx");
		});

		it("returns .js for .js files", () => {
			expect.assertions(1);
			expect(getExtension("file.js")).toBe(".js");
		});

		it("returns .mts for .mts files", () => {
			expect.assertions(1);
			expect(getExtension("file.mts")).toBe(".mts");
		});

		it("returns .mjs for .mjs files", () => {
			expect.assertions(1);
			expect(getExtension("file.mjs")).toBe(".mjs");
		});

		it("returns .cts for .cts files", () => {
			expect.assertions(1);
			expect(getExtension("file.cts")).toBe(".cts");
		});

		it("returns .cjs for .cjs files", () => {
			expect.assertions(1);
			expect(getExtension("file.cjs")).toBe(".cjs");
		});

		it("returns undefined for unsupported extensions", () => {
			expect.assertions(4);
			expect(getExtension("file.py")).toBeUndefined();
			expect(getExtension("file.pas")).toBeUndefined();
			expect(getExtension("file.json")).toBeUndefined();
			expect(getExtension("file")).toBeUndefined();
		});
	});

	describe("generateDifferences", () => {
		it("returns empty array when strings are identical", () => {
			expect.assertions(1);
			const result = generateDifferences("hello", "hello");
			expect(result).toStrictEqual([]);
		});

		it("detects INSERT operation", () => {
			expect.assertions(1);
			const result = generateDifferences("helloworld", "hello world");
			expect(result).toStrictEqual([{ insertText: " ", offset: 5, operation: "INSERT" }]);
		});

		it("detects DELETE operation", () => {
			expect.assertions(1);
			const result = generateDifferences("hello  world", "hello world");
			expect(result).toStrictEqual([{ deleteText: " ", offset: 5, operation: "DELETE" }]);
		});

		it("detects REPLACE operation (DELETE + INSERT merged)", () => {
			expect.assertions(1);
			const result = generateDifferences("hello\tworld", "hello world");
			expect(result).toStrictEqual([{ deleteText: "\t", insertText: " ", offset: 5, operation: "REPLACE" }]);
		});

		it("handles multiple operations", () => {
			expect.assertions(3);
			const result = generateDifferences("a  b  c", "a b c");
			expect(result).toHaveLength(2);
			expect(result[0]).toMatchObject({ offset: 1, operation: "DELETE" });
			expect(result[1]).toMatchObject({ offset: 4, operation: "DELETE" });
		});

		it("handles beginning of string changes", () => {
			expect.assertions(1);
			const result = generateDifferences("  hello", "hello");
			expect(result).toStrictEqual([{ deleteText: "  ", offset: 0, operation: "DELETE" }]);
		});

		it("handles end of string changes", () => {
			expect.assertions(1);
			const result = generateDifferences("hello", "hello\n");
			expect(result).toStrictEqual([{ insertText: "\n", offset: 5, operation: "INSERT" }]);
		});
	});
});
