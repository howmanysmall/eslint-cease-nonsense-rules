import { expect, it } from "bun:test";
import plugin from "@/";

// Minimal smoke test that our plugin shape is valid

it("plugin exports rule and recommended config", () => {
	expect.assertions(4);
	expect(plugin).toBeDefined();
	expect(plugin.rules).toBeDefined();
	expect(Object.keys(plugin.rules)).toContain("no-print");
	expect(plugin.configs.recommended).toBeDefined();
});
