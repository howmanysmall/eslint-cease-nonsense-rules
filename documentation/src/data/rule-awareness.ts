import { ruleCategoryDefinitions, ruleCategoryOrder } from "./rule-sidebar";

const typeAwareRulePaths = [
	"rules/dot-notation",
	"rules/misleading-lua-tuple-checks",
	"rules/no-empty-array-literal",
	"rules/no-manual-children-property",
	"rules/no-memo-children",
	"rules/prefer-enum-item",
	"rules/prefer-enum-member",
	"rules/prefer-read-only-props",
	"rules/require-serialized-numeric-data-type",
] satisfies ReadonlyArray<string>;

const typeAwareRuleSet = new Set(typeAwareRulePaths);

export interface RuleAwarenessStats {
	readonly count: number;
	readonly description: string;
	readonly label: string;
}

export interface RuleAwarenessBreakdown {
	readonly astOnly: number;
	readonly typeAware: number;
}

function countTypeAwareRules(rules: ReadonlyArray<string>): number {
	return rules.reduce((count, rulePath) => count + Number(typeAwareRuleSet.has(rulePath)), 0);
}

function collectAllRulePaths(): ReadonlyArray<string> {
	return ruleCategoryOrder.flatMap((category) => ruleCategoryDefinitions[category].rules);
}

const allRulePaths = collectAllRulePaths();
const typeAwareCount = countTypeAwareRules(allRulePaths);

export const ruleAwareness = {
	astOnly: {
		count: allRulePaths.length - typeAwareCount,
		description: "Rules that only inspect syntax and do not need project type information.",
		label: "AST-only rules",
	},
	typeAware: {
		count: typeAwareCount,
		description: "Rules that use parser services or the TypeScript checker for deeper analysis.",
		label: "Type-aware rules",
	},
} satisfies Record<"astOnly" | "typeAware", RuleAwarenessStats>;

export function getRuleAwarenessBreakdown(rules: ReadonlyArray<string>): RuleAwarenessBreakdown {
	const typeAware = countTypeAwareRules(rules);

	return {
		astOnly: rules.length - typeAware,
		typeAware,
	};
}
