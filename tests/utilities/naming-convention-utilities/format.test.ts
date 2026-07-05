import { describe, expect, it, vi } from "vitest";
import { PredefinedFormatToCheckFunction } from "$utilities/naming-convention-utilities/format";

vi.setConfig({ testTimeout: 500 });

// oxlint-disable-next-line vitest/prefer-lowercase-title -- no lol
describe("PredefinedFormatToCheckFunction", () => {
	describe("camelCase", () => {
		it("should return true for valid camelCase", () => {
			expect.assertions(1);
			expect(PredefinedFormatToCheckFunction.camelCase("fooBar")).toBe(true);
		});

		it("should return true for single character", () => {
			expect.assertions(1);
			expect(PredefinedFormatToCheckFunction.camelCase("a")).toBe(true);
		});

		it("should return true for empty string", () => {
			expect.assertions(1);
			expect(PredefinedFormatToCheckFunction.camelCase("")).toBe(true);
		});

		it("should return false for PascalCase (starts with uppercase)", () => {
			expect.assertions(1);
			expect(PredefinedFormatToCheckFunction.camelCase("FooBar")).toBe(false);
		});

		it("should return false for snake_case (contains underscore)", () => {
			expect.assertions(1);
			expect(PredefinedFormatToCheckFunction.camelCase("foo_bar")).toBe(false);
		});

		it("should return false for name starting with underscore", () => {
			expect.assertions(1);
			expect(PredefinedFormatToCheckFunction.camelCase("_fooBar")).toBe(false);
		});
	});

	describe("pascalCase", () => {
		it("should return true for valid PascalCase", () => {
			expect.assertions(1);
			expect(PredefinedFormatToCheckFunction.PascalCase("FooBar")).toBe(true);
		});

		it("should return true for single uppercase character", () => {
			expect.assertions(1);
			expect(PredefinedFormatToCheckFunction.PascalCase("A")).toBe(true);
		});

		it("should return true for empty string", () => {
			expect.assertions(1);
			expect(PredefinedFormatToCheckFunction.PascalCase("")).toBe(true);
		});

		it("should return false for camelCase (starts with lowercase)", () => {
			expect.assertions(1);
			expect(PredefinedFormatToCheckFunction.PascalCase("fooBar")).toBe(false);
		});

		it("should return false for snake_case", () => {
			expect.assertions(1);
			expect(PredefinedFormatToCheckFunction.PascalCase("Foo_Bar")).toBe(false);
		});

		it("should return false for name containing underscore", () => {
			expect.assertions(1);
			expect(PredefinedFormatToCheckFunction.PascalCase("FooBar_baz")).toBe(false);
		});
	});

	describe("snake_case", () => {
		it("should return true for valid snake_case", () => {
			expect.assertions(1);
			expect(PredefinedFormatToCheckFunction.snake_case("foo_bar")).toBe(true);
		});

		it("should return true for single lowercase word", () => {
			expect.assertions(1);
			expect(PredefinedFormatToCheckFunction.snake_case("foo")).toBe(true);
		});

		it("should return true for empty string", () => {
			expect.assertions(1);
			expect(PredefinedFormatToCheckFunction.snake_case("")).toBe(true);
		});

		it("should return false for camelCase", () => {
			expect.assertions(1);
			expect(PredefinedFormatToCheckFunction.snake_case("fooBar")).toBe(false);
		});

		it("should return false for PascalCase", () => {
			expect.assertions(1);
			expect(PredefinedFormatToCheckFunction.snake_case("FooBar")).toBe(false);
		});

		it("should return false for name starting with underscore", () => {
			expect.assertions(1);
			expect(PredefinedFormatToCheckFunction.snake_case("_foo_bar")).toBe(false);
		});

		it("should return false for name with consecutive underscores", () => {
			expect.assertions(1);
			expect(PredefinedFormatToCheckFunction.snake_case("foo__bar")).toBe(false);
		});

		it("should return false for UPPER_CASE", () => {
			expect.assertions(1);
			expect(PredefinedFormatToCheckFunction.snake_case("FOO_BAR")).toBe(false);
		});
	});

	describe("strictCamelCase", () => {
		it("should return true for valid strict camelCase", () => {
			expect.assertions(1);
			expect(PredefinedFormatToCheckFunction.strictCamelCase("fooBar")).toBe(true);
		});

		it("should return true for single lowercase character", () => {
			expect.assertions(1);
			expect(PredefinedFormatToCheckFunction.strictCamelCase("a")).toBe(true);
		});

		it("should return true for empty string", () => {
			expect.assertions(1);
			expect(PredefinedFormatToCheckFunction.strictCamelCase("")).toBe(true);
		});

		it("should return false for PascalCase (starts with uppercase)", () => {
			expect.assertions(1);
			expect(PredefinedFormatToCheckFunction.strictCamelCase("FooBar")).toBe(false);
		});

		it("should return false for name with consecutive uppercase (fooBAR)", () => {
			expect.assertions(1);
			expect(PredefinedFormatToCheckFunction.strictCamelCase("fooBAR")).toBe(false);
		});

		it("should return false for name containing underscore", () => {
			expect.assertions(1);
			expect(PredefinedFormatToCheckFunction.strictCamelCase("foo_Bar")).toBe(false);
		});

		it("should return false for name starting with underscore", () => {
			expect.assertions(1);
			expect(PredefinedFormatToCheckFunction.strictCamelCase("_fooBar")).toBe(false);
		});
	});

	describe("strictPascalCase", () => {
		it("should return true for valid strict PascalCase", () => {
			expect.assertions(1);
			expect(PredefinedFormatToCheckFunction.StrictPascalCase("FooBar")).toBe(true);
		});

		it("should return true for single uppercase character", () => {
			expect.assertions(1);
			expect(PredefinedFormatToCheckFunction.StrictPascalCase("A")).toBe(true);
		});

		it("should return true for empty string", () => {
			expect.assertions(1);
			expect(PredefinedFormatToCheckFunction.StrictPascalCase("")).toBe(true);
		});

		it("should return false for camelCase (starts with lowercase)", () => {
			expect.assertions(1);
			expect(PredefinedFormatToCheckFunction.StrictPascalCase("fooBar")).toBe(false);
		});

		it("should return false for name with consecutive uppercase (FOOBar)", () => {
			expect.assertions(1);
			expect(PredefinedFormatToCheckFunction.StrictPascalCase("FOOBar")).toBe(false);
		});

		it("should return false for name containing underscore", () => {
			expect.assertions(1);
			expect(PredefinedFormatToCheckFunction.StrictPascalCase("Foo_Bar")).toBe(false);
		});

		it("should return false for name starting with underscore", () => {
			expect.assertions(1);
			expect(PredefinedFormatToCheckFunction.StrictPascalCase("_FooBar")).toBe(false);
		});

		it("should return true for simple two-word PascalCase", () => {
			expect.assertions(1);
			expect(PredefinedFormatToCheckFunction.StrictPascalCase("Ab")).toBe(true);
		});
	});

	describe("uPPER_CASE", () => {
		it("should return true for valid UPPER_CASE", () => {
			expect.assertions(1);
			expect(PredefinedFormatToCheckFunction.UPPER_CASE("FOO_BAR")).toBe(true);
		});

		it("should return true for single uppercase word", () => {
			expect.assertions(1);
			expect(PredefinedFormatToCheckFunction.UPPER_CASE("FOO")).toBe(true);
		});

		it("should return true for empty string", () => {
			expect.assertions(1);
			expect(PredefinedFormatToCheckFunction.UPPER_CASE("")).toBe(true);
		});

		it("should return false for snake_case (lowercase)", () => {
			expect.assertions(1);
			expect(PredefinedFormatToCheckFunction.UPPER_CASE("foo_bar")).toBe(false);
		});

		it("should return false for PascalCase", () => {
			expect.assertions(1);
			expect(PredefinedFormatToCheckFunction.UPPER_CASE("FooBar")).toBe(false);
		});

		it("should return false for name starting with underscore", () => {
			expect.assertions(1);
			expect(PredefinedFormatToCheckFunction.UPPER_CASE("_FOO_BAR")).toBe(false);
		});

		it("should return false for name with consecutive underscores", () => {
			expect.assertions(1);
			expect(PredefinedFormatToCheckFunction.UPPER_CASE("FOO__BAR")).toBe(false);
		});

		it("should return false for mixed case", () => {
			expect.assertions(1);
			expect(PredefinedFormatToCheckFunction.UPPER_CASE("Foo_BAR")).toBe(false);
		});
	});
});
