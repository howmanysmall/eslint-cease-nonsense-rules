import { getRuleAwarenessBreakdown } from "./rule-awareness";
import { ruleCategoryDefinitions, ruleCategoryOrder } from "./rule-sidebar";

import type { RuleCategoryDefinition, RuleCategoryKey } from "./rule-sidebar";

interface RuleCategoryStats {
	readonly astOnlyCount: number;
	readonly count: number;
	readonly label: string;
	readonly slug: string;
	readonly typeAwareCount: number;
}

function createRuleCategoryStats(definition: RuleCategoryDefinition): RuleCategoryStats {
	const [firstRulePath] = definition.rules;
	if (firstRulePath === undefined) {
		const error = new Error(`Rule category "${definition.label}" must contain at least one rule.`);
		Error.captureStackTrace(error, createRuleCategoryStats);
		throw error;
	}

	const awareness = getRuleAwarenessBreakdown(definition.rules);

	return {
		astOnlyCount: awareness.astOnly,
		count: definition.rules.length,
		label: definition.label,
		slug: definition.slug,
		typeAwareCount: awareness.typeAware,
	};
}

export const ruleCategories = {
	general: createRuleCategoryStats(ruleCategoryDefinitions.general),
	naming: createRuleCategoryStats(ruleCategoryDefinitions.naming),
	react: createRuleCategoryStats(ruleCategoryDefinitions.react),
	roblox: createRuleCategoryStats(ruleCategoryDefinitions.roblox),
} satisfies Record<RuleCategoryKey, RuleCategoryStats>;

export { ruleAwareness } from "./rule-awareness";
export { ruleSidebarGroups } from "./rule-sidebar";

export const __testing = { createRuleCategoryStats };

export const totalCategories = ruleCategoryOrder.length;
export const totalRules = ruleCategoryOrder.reduce((sum, category) => sum + ruleCategories[category].count, 0);

const totalRuleAwarenessStats: {
	astOnly: number;
	typeAware: number;
} = {
	astOnly: 0,
	typeAware: 0,
};

for (const category of ruleCategoryOrder) {
	totalRuleAwarenessStats.astOnly += ruleCategories[category].astOnlyCount;
	totalRuleAwarenessStats.typeAware += ruleCategories[category].typeAwareCount;
}

export const totalRuleAwareness = totalRuleAwarenessStats;
