import { test, expect } from "bun:test";
import plugin from "../src/index";

// Minimal smoke test that our plugin shape is valid

test("plugin exports rule and recommended config", () => {
  expect(plugin).toBeDefined();
  expect(plugin.rules).toBeDefined();
  expect(Object.keys(plugin.rules)).toContain("no-idiot");
  expect(plugin.configs.recommended).toBeDefined();
});
