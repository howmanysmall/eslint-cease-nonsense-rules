import { describe, expect, it } from "vitest";
import { SCHEMA } from "@utilities/naming-convention-utilities/schema";

describe("naming-convention schema", () => {
	it("exposes the selector schema definitions", () => {
		expect.assertions(3);
		expect(SCHEMA.$defs).toBeDefined();
		expect(SCHEMA.$defs).toHaveProperty("typeModifiers");
		expect(SCHEMA.$defs).toHaveProperty("underscoreOptions");
	}, 1000);
});
