import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { resolveRelativeImport } from "../../src/utilities/resolve-import";

const FIXTURES_DIR = join(import.meta.dir, "..", "fixtures");

describe("resolveRelativeImport", () => {
	describe("relative imports", () => {
		it("resolves ./ import to existing file", () => {
			const sourceFile = join(FIXTURES_DIR, "resolve-test", "index.ts");
			const result = resolveRelativeImport("./helper", sourceFile);
			expect(result.found).toBe(true);
			if (result.found) expect(result.path).toContain("helper.ts");
		});

		it("resolves ../ import to existing file", () => {
			const sourceFile = join(FIXTURES_DIR, "resolve-test", "sub", "nested.ts");
			const result = resolveRelativeImport("../helper", sourceFile);
			expect(result.found).toBe(true);
			if (result.found) expect(result.path).toContain("helper.ts");
		});

		it("resolves directory import to index file", () => {
			const sourceFile = join(FIXTURES_DIR, "resolve-test", "index.ts");
			const result = resolveRelativeImport("./sub", sourceFile);
			expect(result.found).toBe(true);
			if (result.found) expect(result.path).toContain("index.ts");
		});
	});

	describe("non-relative imports", () => {
		it("returns found: false for package imports", () => {
			const sourceFile = join(FIXTURES_DIR, "resolve-test", "index.ts");
			const result = resolveRelativeImport("lodash", sourceFile);
			expect(result.found).toBe(false);
		});

		it("returns found: false for scoped package imports", () => {
			const sourceFile = join(FIXTURES_DIR, "resolve-test", "index.ts");
			const result = resolveRelativeImport("@scope/package", sourceFile);
			expect(result.found).toBe(false);
		});

		it("returns found: false for aliased imports", () => {
			const sourceFile = join(FIXTURES_DIR, "resolve-test", "index.ts");
			const result = resolveRelativeImport("@/utils", sourceFile);
			expect(result.found).toBe(false);
		});
	});

	describe("non-existent files", () => {
		it("returns found: false for non-existent relative import", () => {
			const sourceFile = join(FIXTURES_DIR, "resolve-test", "index.ts");
			const result = resolveRelativeImport("./does-not-exist", sourceFile);
			expect(result.found).toBe(false);
		});

		it("returns found: false when source file directory does not exist", () => {
			const sourceFile = "/non/existent/path/to/file.ts";
			const result = resolveRelativeImport("./something", sourceFile);
			expect(result.found).toBe(false);
		});
	});
});
