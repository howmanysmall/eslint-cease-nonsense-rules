import { describe, expect, it } from "vitest";
import { SCHEMA } from "$utilities/naming-convention-utilities/schema";

describe("naming-convention schema", () => {
	it("exposes the selector schema definitions", () => {
		expect.assertions(3);
		expect(SCHEMA.$defs).toBeDefined();
		expect(SCHEMA.$defs).toHaveProperty("typeMatcher");
		expect(SCHEMA.$defs).toHaveProperty("underscoreOptions");
	}, 1000);

	it("allows modifiers only for selectors that support them", () => {
		expect.assertions(2);
		const serializedSchema = JSON.stringify(SCHEMA);

		expect(serializedSchema).toContain('"description":"Selector \'default\'"');
		expect(serializedSchema).toContain('"description":"Selector \'autoAccessor\'"');
	}, 1000);
});
