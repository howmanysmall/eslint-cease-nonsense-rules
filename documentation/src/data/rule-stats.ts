/**
 * Rule statistics extracted from the Astro sidebar configuration.
 * This data is used throughout the documentation to display accurate rule counts.
 *
 * ⚠️ Update these counts when adding or removing rules from astro.config.ts sidebar.
 * The counts should match the sidebar configuration exactly.
 */
const ruleCategories = {
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
		count: 17,
		label: "React Rules",
		slug: "/eslint-cease-nonsense-rules/rules/ban-react-fc/",
	},
	roblox: {
		count: 14,
		label: "Roblox & Luau Rules",
		slug: "/eslint-cease-nonsense-rules/rules/ban-instances/",
	},
} as const;

export const totalRules = Object.values(ruleCategories).reduce((sum, { count }) => sum + count, 0);
export { ruleCategories };
