import { expect, it } from "bun:test";
import plugin, { rules } from "../src";

// Minimal smoke test that our plugin shape is valid

it("plugin exports rule and recommended config", () => {
	expect.assertions(4);
	expect(plugin).toBeDefined();
	expect(rules).toBeDefined();
	expect(Object.keys(rules)).toContain("no-print");
	expect(plugin.configs.recommended).toBeDefined();
});
