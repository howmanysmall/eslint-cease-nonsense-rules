import { describe, expect, it } from "bun:test";
import { __testing } from "@utilities/format-utilities";

describe("format-utilities", () => {
	it("should load the same configuration", () => {
		expect.assertions(1);
		const configuration0 = __testing.loadOxfmtConfig();
		const configuration1 = __testing.loadOxfmtConfig();
		expect(configuration0).toBe(configuration1);
	});
});
