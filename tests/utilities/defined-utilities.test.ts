import { describe, expect, it } from "vitest";
import { getDefinedValue } from "$utilities/defined-utilities";

describe("defined-utilities", () => {
	describe("getDefinedValue", () => {
		it("returns a defined value", () => {
			expect.assertions(1);

			expect(getDefinedValue("value")).toBe("value");
		});

		it("returns null as a defined value", () => {
			expect.assertions(1);

			expect(getDefinedValue(null)).toBeNull();
		});

		it("throws when the value is undefined", () => {
			expect.assertions(1);

			expect(() => {
				getDefinedValue(undefined, "No value found.");
			}).toThrow("No value found.");
		});
	});
});
