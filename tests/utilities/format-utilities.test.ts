import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
// oxlint-disable-next-line no-namespace
import * as fs from "node:fs";
import { __testing, getExtension } from "../../src/utilities/format-utilities";

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
});
