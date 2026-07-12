import { describe, expect, it } from "vitest";

import {
	__testing,
	ruleAwareness,
	ruleCategories,
	ruleSidebarGroups,
	totalCategories,
	totalRuleAwareness,
	totalRules,
} from "../../documentation/src/data/rule-stats";

import type { RuleCategoryDefinition } from "../../documentation/src/data/rule-sidebar";

describe("rule stats", () => {
	it("derives totals from the shared rule catalog", () => {
		expect.assertions(4);
		expect(totalCategories).toBe(4);
		expect(totalRules).toBe(59);
		expect(ruleAwareness).toStrictEqual({
			astOnly: {
				count: 49,
				description: "Rules that only inspect syntax and do not need project type information.",
				label: "AST-only rules",
			},
			typeAware: {
				count: 10,
				description: "Rules that use parser services or the TypeScript checker for deeper analysis.",
				label: "Type-aware rules",
			},
		});
		expect(totalRuleAwareness).toStrictEqual({
			astOnly: 49,
			typeAware: 10,
		});
	}, 1000);

	it("keeps category stats aligned with the sidebar groups", () => {
		expect.assertions(3);
		expect(Object.keys(ruleCategories)).toStrictEqual(["general", "naming", "react", "roblox"]);
		expect(ruleCategories).toStrictEqual({
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
				count: 18,
				label: "Roblox & Luau Rules",
				slug: "/eslint-cease-nonsense-rules/rules/ban-instances/",
				typeAwareCount: 4,
			},
		});

		expect(
			ruleSidebarGroups.map(({ items, label }) => ({
				count: items.length,
				first: items[0],
				label,
			})),
		).toStrictEqual([
			{ count: 22, first: "rules/ban-react-fc", label: "React Rules" },
			{ count: 18, first: "rules/ban-instances", label: "Roblox & Luau Rules" },
			{ count: 7, first: "rules/array-type-generic", label: "Naming & Conventions" },
			{ count: 12, first: "rules/dot-notation", label: "General Logic & Style" },
		]);
	}, 1000);

	it("throws when a category has no rules", () => {
		expect.assertions(1);
		const emptyCategory: RuleCategoryDefinition = {
			label: "Empty Category",
			rules: [],
			slug: "/eslint-cease-nonsense-rules/rules/empty/",
		};

		expect(() => __testing.createRuleCategoryStats(emptyCategory)).toThrow(
			'Rule category "Empty Category" must contain at least one rule.',
		);
	}, 1000);
});
