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

	it("recommended config only enables exported rules as errors", () => {
		expect.assertions(3);
		const configuredRules = Object.entries(plugin.configs.recommended.rules);
		const exportedRuleNames = configuredRules.map(([ruleName]) => ruleName.replace(/^cease-nonsense\//u, ""));

		expect(configuredRules.length).toBeGreaterThan(0);
		expect(exportedRuleNames.map((ruleName) => Object.hasOwn(rules, ruleName))).not.toContain(false);
		expect(configuredRules.map(([, severity]) => severity)).toStrictEqual(
			Array.from({ length: configuredRules.length }, () => "error"),
		);
	}, 100);
});
