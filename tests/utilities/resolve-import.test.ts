import nodePath from "node:path";
import { describe, expect, it, vi } from "vitest";
import { resolveRelativeImport } from "$utilities/resolve-import";

const FIXTURES_DIR = nodePath.join(import.meta.dirname, "..", "fixtures");

vi.setConfig({ testTimeout: 10000 });

describe("resolveRelativeImport", () => {
	describe("relative imports", () => {
		it("resolves ./ import to existing file", () => {
			expect.assertions(1);
			const sourceFile = nodePath.join(FIXTURES_DIR, "resolve-test", "index.ts");
			const result = resolveRelativeImport("./helper", sourceFile);
			expect(result).toMatchObject({
				found: true,
				path: expect.stringContaining("helper.ts"),
			});
		});

		it("resolves ../ import to existing file", () => {
			expect.assertions(1);
			const sourceFile = nodePath.join(FIXTURES_DIR, "resolve-test", "sub", "nested.ts");
			const result = resolveRelativeImport("../helper", sourceFile);
			expect(result).toMatchObject({
				found: true,
				path: expect.stringContaining("helper.ts"),
			});
		});

		it("resolves directory import to index file", () => {
			expect.assertions(1);
			const sourceFile = nodePath.join(FIXTURES_DIR, "resolve-test", "index.ts");
			const result = resolveRelativeImport("./sub", sourceFile);
			expect(result).toMatchObject({
				found: true,
				path: expect.stringContaining("index.ts"),
			});
		});
	});

	describe("non-relative imports", () => {
		it("returns found: false for package imports", () => {
			expect.assertions(1);
			const sourceFile = nodePath.join(FIXTURES_DIR, "resolve-test", "index.ts");
			const result = resolveRelativeImport("lodash", sourceFile);
			expect(result.found).toBe(false);
		});

		it("returns found: false for scoped package imports", () => {
			expect.assertions(1);
			const sourceFile = nodePath.join(FIXTURES_DIR, "resolve-test", "index.ts");
			const result = resolveRelativeImport("@scope/package", sourceFile);
			expect(result.found).toBe(false);
		});

		it("returns found: false for aliased imports", () => {
			expect.assertions(1);
			const sourceFile = nodePath.join(FIXTURES_DIR, "resolve-test", "index.ts");
			const result = resolveRelativeImport("@/utils", sourceFile);
			expect(result.found).toBe(false);
		});
	});

	describe("non-existent files", () => {
		it("returns found: false for non-existent relative import", () => {
			expect.assertions(1);
			const sourceFile = nodePath.join(FIXTURES_DIR, "resolve-test", "index.ts");
			const result = resolveRelativeImport("./does-not-exist", sourceFile);
			expect(result.found).toBe(false);
		});

		it("returns found: false when source file directory does not exist", () => {
			expect.assertions(1);
			const sourceFile = "/non/existent/path/to/file.ts";
			const result = resolveRelativeImport("./something", sourceFile);
			expect(result.found).toBe(false);
		});
	});
});
