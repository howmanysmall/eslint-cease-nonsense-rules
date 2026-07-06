import { describe, expect, it } from "vitest";
import { getLastElement } from "$utilities/array-utilities";

describe("array-utilities", () => {
	describe("getLastElement", () => {
		it("returns the only element", () => {
			expect.assertions(1);

			expect(getLastElement(["value"])).toBe("value");
		});

		it("returns the final element", () => {
			expect.assertions(1);

			expect(getLastElement(["first", "second", "third"])).toBe("third");
		});

		it("throws when the array is empty", () => {
			expect.assertions(1);

			expect(() => getLastElement([], "No values found.")).toThrow("No values found.");
		});
	});
});
