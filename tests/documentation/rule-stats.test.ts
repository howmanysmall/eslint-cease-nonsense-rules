import { describe, expect, it } from "bun:test";

import {
	ruleAwareness,
	ruleCategories,
	ruleSidebarGroups,
	totalCategories,
	totalRuleAwareness,
	totalRules,
} from "../../documentation/src/data/rule-stats";

describe("rule stats", () => {
	it("derives totals from the shared rule catalog", () => {
		expect(totalCategories).toBe(4);
		expect(totalRules).toBe(58);
		expect(ruleAwareness).toEqual({
			astOnly: {
				count: 49,
				description: "Rules that only inspect syntax and do not need project type information.",
				label: "AST-only rules",
			},
			typeAware: {
				count: 9,
				description: "Rules that use parser services or the TypeScript checker for deeper analysis.",
				label: "Type-aware rules",
			},
		});
		expect(totalRuleAwareness).toEqual({
			astOnly: 49,
			typeAware: 9,
		});
	});

	it("keeps category stats aligned with the sidebar groups", () => {
		expect(Object.keys(ruleCategories)).toEqual(["general", "naming", "react", "roblox"]);
		expect(ruleCategories).toEqual({
			general: {
				astOnlyCount: 10,
				count: 12,
				label: "General Logic & Style",
				slug: "/eslint-cease-nonsense-rules/rules/prefer-early-return/",
				typeAwareCount: 2,
			},
			naming: {
				astOnlyCount: 6,
				count: 7,
				label: "Naming & Conventions",
				slug: "/eslint-cease-nonsense-rules/rules/naming-convention/",
				typeAwareCount: 1,
			},
			react: {
				astOnlyCount: 19,
				count: 22,
				label: "React Rules",
				slug: "/eslint-cease-nonsense-rules/rules/ban-react-fc/",
				typeAwareCount: 3,
			},
			roblox: {
				astOnlyCount: 14,
				count: 17,
				label: "Roblox & Luau Rules",
				slug: "/eslint-cease-nonsense-rules/rules/ban-instances/",
				typeAwareCount: 3,
			},
		});

		expect(
			ruleSidebarGroups.map(({ items, label }) => ({
				count: items.length,
				first: items[0],
				label,
			})),
		).toEqual([
			{ count: 22, first: "rules/ban-react-fc", label: "React Rules" },
			{ count: 17, first: "rules/ban-instances", label: "Roblox & Luau Rules" },
			{ count: 7, first: "rules/array-type-generic", label: "Naming & Conventions" },
			{ count: 12, first: "rules/dot-notation", label: "General Logic & Style" },
		]);
	});
});
