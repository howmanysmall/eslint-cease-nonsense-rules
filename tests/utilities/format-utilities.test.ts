import fs from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
	__testing,
	formatWithOxfmtSync,
	generateDifferences,
	getExtension,
	showInvisibles,
} from "$utilities/format-utilities";

vi.setConfig({ testTimeout: 10000 });

function withResetConfigCache<Result>(run: () => Result): Result {
	__testing.resetConfigCache();

	try {
		return run();
	} finally {
		__testing.resetConfigCache();
	}
}

function withMockedConfigFile<Result>(content: Error | string, run: () => Result): Result {
	return withResetConfigCache(() => {
		const readFileSync = vi.spyOn(fs, "readFileSync");

		if (typeof content === "string") {
			readFileSync.mockReturnValue(content);
		} else {
			readFileSync.mockImplementation(() => {
				throw content;
			});
		}

		try {
			return run();
		} finally {
			readFileSync.mockRestore();
		}
	});
}

describe("format-utilities", () => {
	it("should load the same configuration", () => {
		expect.assertions(1);
		withResetConfigCache(() => {
			const configuration0 = __testing.loadOxfmtConfig();
			const configuration1 = __testing.loadOxfmtConfig();
			expect(configuration0).toBe(configuration1);
		});
	});

	it("returns empty config when file does not exist", () => {
		expect.assertions(1);
		withMockedConfigFile(new Error("ENOENT"), () => {
			const config = __testing.loadOxfmtConfig();
			expect(config).toStrictEqual({});
		});
	});

	it("returns empty config when JSON is not an object", () => {
		expect.assertions(1);
		withMockedConfigFile('"just a string"', () => {
			const config = __testing.loadOxfmtConfig();
			expect(config).toStrictEqual({});
		});
	});

	it("returns empty config when JSON is null", () => {
		expect.assertions(1);
		withMockedConfigFile("null", () => {
			const config = __testing.loadOxfmtConfig();
			expect(config).toStrictEqual({});
		});
	});

	it("loads object config and strips non-format keys", () => {
		expect.assertions(1);
		withMockedConfigFile(
			'{"$schema":"https://example.test/schema.json","ignorePatterns":["dist/**"],"lineWidth":120}',
			() => {
				const config = __testing.loadOxfmtConfig();
				expect(config).toStrictEqual({ lineWidth: 120 });
			},
		);
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

		it("returns .jsx for nested paths", () => {
			expect.assertions(1);
			expect(getExtension("src/components/file.jsx")).toBe(".jsx");
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

		it("returns .cts for declaration-like names", () => {
			expect.assertions(1);
			expect(getExtension("file.test.cts")).toBe(".cts");
		});

		it("returns .cjs for .cjs files", () => {
			expect.assertions(1);
			expect(getExtension("file.cjs")).toBe(".cjs");
		});

		it("returns .cjs for config files", () => {
			expect.assertions(1);
			expect(getExtension("eslint.config.cjs")).toBe(".cjs");
		});

		it("returns undefined for unsupported extensions", () => {
			expect.assertions(4);
			expect(getExtension("file.py")).toBeUndefined();
			expect(getExtension("file.pas")).toBeUndefined();
			expect(getExtension("file.json")).toBeUndefined();
			expect(getExtension("file")).toBeUndefined();
		});

		it("returns undefined for near-miss JavaScript and TypeScript extensions", () => {
			expect.assertions(8);
			expect(getExtension("file.tjsx")).toBeUndefined();
			expect(getExtension("file.tx")).toBeUndefined();
			expect(getExtension("file.ntx")).toBeUndefined();
			expect(getExtension("file.njx")).toBeUndefined();
			expect(getExtension("file.nts")).toBeUndefined();
			expect(getExtension("file.njs")).toBeUndefined();
			expect(getExtension("file.mts.map")).toBeUndefined();
			expect(getExtension("file.d.ts")).toBe(".ts");
		});
	});

	describe("formatWithOxfmtSync", () => {
		it("throws for unsupported extensions before loading config", () => {
			expect.assertions(1);
			expect(() => formatWithOxfmtSync("const value = 1;", "file.txt")).toThrow(
				"Unsupported file extension for file.txt",
			);
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

		it("adjusts replacement offsets for shared suffix text", () => {
			expect.assertions(1);
			const result = generateDifferences("abc", "ac");
			expect(result).toStrictEqual([{ deleteText: "b", offset: 1, operation: "DELETE" }]);
		});
	});

	describe("showInvisibles", () => {
		it("replaces whitespace with visible symbols", () => {
			expect.assertions(1);
			expect(showInvisibles("a b\tc\r\n")).toBe("a·b→c␍␊");
		});

		it("leaves visible characters unchanged", () => {
			expect.assertions(1);
			expect(showInvisibles("abc")).toBe("abc");
		});

		it("truncates long text before replacing whitespace", () => {
			expect.assertions(1);
			expect(showInvisibles(`${"x".repeat(60)} more`)).toBe(`${"x".repeat(60)}…`);
		});
	});
});
