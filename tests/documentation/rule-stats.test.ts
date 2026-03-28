import { describe, expect, it } from "bun:test";

import {
	ruleCategories,
	ruleSidebarGroups,
	totalCategories,
	totalRules,
} from "../../documentation/src/data/rule-stats";

describe("rule stats", () => {
	it("derives totals from the shared rule catalog", () => {
		expect(totalCategories).toBe(4);
		expect(totalRules).toBe(56);
	});

	it("keeps category stats aligned with the sidebar groups", () => {
		expect(Object.keys(ruleCategories)).toEqual(["general", "naming", "react", "roblox"]);
		expect(ruleCategories).toEqual({
			general: {
				count: 12,
				label: "General Logic & Style",
				slug: "/eslint-cease-nonsense-rules/rules/prefer-early-return/",
			},
			naming: {
				count: 7,
				label: "Naming & Conventions",
				slug: "/eslint-cease-nonsense-rules/rules/naming-convention/",
			},
			react: {
				count: 20,
				label: "React Rules",
				slug: "/eslint-cease-nonsense-rules/rules/ban-react-fc/",
			},
			roblox: {
				count: 17,
				label: "Roblox & Luau Rules",
				slug: "/eslint-cease-nonsense-rules/rules/ban-instances/",
			},
		});

		expect(
			ruleSidebarGroups.map(({ items, label }) => ({
				count: items.length,
				first: items[0],
				label,
			})),
		).toEqual([
			{ count: 20, first: "rules/ban-react-fc", label: "React Rules" },
			{ count: 17, first: "rules/ban-instances", label: "Roblox & Luau Rules" },
			{ count: 7, first: "rules/array-type-generic", label: "Naming & Conventions" },
			{ count: 12, first: "rules/dot-notation", label: "General Logic & Style" },
		]);
	});
});
