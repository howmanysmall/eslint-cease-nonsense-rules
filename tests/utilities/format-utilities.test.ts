import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
// oxlint-disable-next-line no-namespace
import * as fs from "node:fs";
import { __testing, generateDifferences, getExtension } from "../../src/utilities/format-utilities";

describe("format-utilities", () => {
	afterEach(() => {
		__testing.resetConfigCache();
		mock.restore();
	});

	it("should load the same configuration", () => {
		expect.assertions(1);
		const configuration0 = __testing.loadOxfmtConfig();
		const configuration1 = __testing.loadOxfmtConfig();
		expect(configuration0).toBe(configuration1);
	});

	it("returns empty config when file does not exist", () => {
		__testing.resetConfigCache();
		spyOn(fs, "readFileSync").mockImplementation(() => {
			throw new Error("ENOENT");
		});
		const config = __testing.loadOxfmtConfig();
		expect(config).toEqual({});
	});

	it("returns empty config when JSON is not an object", () => {
		__testing.resetConfigCache();
		spyOn(fs, "readFileSync").mockReturnValue('"just a string"');
		const config = __testing.loadOxfmtConfig();
		expect(config).toEqual({});
	});

	it("returns empty config when JSON is null", () => {
		__testing.resetConfigCache();
		spyOn(fs, "readFileSync").mockReturnValue("null");
		const config = __testing.loadOxfmtConfig();
		expect(config).toEqual({});
	});

	describe("getExtension", () => {
		it("returns .tsx for .tsx files", () => {
			expect(getExtension("file.tsx")).toBe(".tsx");
		});

		it("returns .ts for .ts files", () => {
			expect(getExtension("file.ts")).toBe(".ts");
		});

		it("returns .jsx for .jsx files", () => {
			expect(getExtension("file.jsx")).toBe(".jsx");
		});

		it("returns .js for .js files", () => {
			expect(getExtension("file.js")).toBe(".js");
		});

		it("returns .mts for .mts files", () => {
			expect(getExtension("file.mts")).toBe(".mts");
		});

		it("returns .mjs for .mjs files", () => {
			expect(getExtension("file.mjs")).toBe(".mjs");
		});

		it("returns .cts for .cts files", () => {
			expect(getExtension("file.cts")).toBe(".cts");
		});

		it("returns .cjs for .cjs files", () => {
			expect(getExtension("file.cjs")).toBe(".cjs");
		});

		it("returns undefined for unsupported extensions", () => {
			expect(getExtension("file.py")).toBeUndefined();
			expect(getExtension("file.json")).toBeUndefined();
			expect(getExtension("file")).toBeUndefined();
		});
	});

	describe("generateDifferences", () => {
		it("returns empty array when strings are identical", () => {
			const result = generateDifferences("hello", "hello");
			expect(result).toEqual([]);
		});

		it("detects INSERT operation", () => {
			const result = generateDifferences("helloworld", "hello world");
			expect(result).toEqual([{ insertText: " ", offset: 5, operation: "INSERT" }]);
		});

		it("detects DELETE operation", () => {
			const result = generateDifferences("hello  world", "hello world");
			expect(result).toEqual([{ deleteText: " ", offset: 5, operation: "DELETE" }]);
		});

		it("detects REPLACE operation (DELETE + INSERT merged)", () => {
			const result = generateDifferences("hello\tworld", "hello world");
			expect(result).toEqual([{ deleteText: "\t", insertText: " ", offset: 5, operation: "REPLACE" }]);
		});

		it("handles multiple operations", () => {
			const result = generateDifferences("a  b  c", "a b c");
			expect(result).toHaveLength(2);
			expect(result[0]).toMatchObject({ offset: 1, operation: "DELETE" });
			expect(result[1]).toMatchObject({ offset: 4, operation: "DELETE" });
		});

		it("handles beginning of string changes", () => {
			const result = generateDifferences("  hello", "hello");
			expect(result).toEqual([{ deleteText: "  ", offset: 0, operation: "DELETE" }]);
		});

		it("handles end of string changes", () => {
			const result = generateDifferences("hello", "hello\n");
			expect(result).toEqual([{ insertText: "\n", offset: 5, operation: "INSERT" }]);
		});
	});
});
