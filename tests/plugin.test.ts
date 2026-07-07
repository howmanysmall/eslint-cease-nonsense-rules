import { describe, expect, it } from "vitest";
import plugin, { rules } from "$small-rules";

// Minimal smoke test that our plugin shape is valid

describe("plugin.test", () => {
	it("plugin exports rule and recommended config", () => {
		expect.assertions(4);
		expect(plugin).toBeDefined();
		expect(rules).toBeDefined();
		expect(Object.keys(rules)).toContain("no-print");
		expect(plugin.configs.recommended).toBeDefined();
	}, 100);
});
