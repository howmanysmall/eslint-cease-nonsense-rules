import { ruleCategoryDefinitions, ruleCategoryOrder, ruleSidebarGroups } from "./rule-sidebar";

import type { RuleCategoryDefinition, RuleCategoryKey } from "./rule-sidebar";

interface RuleCategoryStats {
	readonly count: number;
	readonly label: string;
	readonly slug: string;
}

function createRuleCategoryStats(definition: RuleCategoryDefinition): RuleCategoryStats {
	const [firstRulePath] = definition.rules;
	if (firstRulePath === undefined) {
		throw new Error(`Rule category "${definition.label}" must contain at least one rule.`);
	}

	return {
		count: definition.rules.length,
		label: definition.label,
		slug: definition.slug,
	};
}

export const ruleCategories = {
	general: createRuleCategoryStats(ruleCategoryDefinitions.general),
	naming: createRuleCategoryStats(ruleCategoryDefinitions.naming),
	react: createRuleCategoryStats(ruleCategoryDefinitions.react),
	roblox: createRuleCategoryStats(ruleCategoryDefinitions.roblox),
} satisfies Record<RuleCategoryKey, RuleCategoryStats>;

export { ruleSidebarGroups };

export const totalCategories = ruleCategoryOrder.length;
export const totalRules = ruleCategoryOrder.reduce((sum, category) => sum + ruleCategories[category].count, 0);
