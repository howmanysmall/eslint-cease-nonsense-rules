import type { StarlightUserConfig } from "@astrojs/starlight/types";

export type RuleCategoryKey = "general" | "naming" | "react" | "roblox";

export interface RuleCategoryDefinition {
	readonly label: string;
	readonly slug: string;
	readonly rules: ReadonlyArray<string>;
}

export const ruleCategoryDefinitions = {
	general: {
		label: "General Logic & Style",
		rules: [
			"rules/dot-notation",
			"rules/fast-format",
			"rules/no-async-constructor",
			"rules/no-commented-code",
			"rules/no-identity-map",
			"rules/no-unused-imports",
			"rules/prefer-class-properties",
			"rules/prefer-early-return",
			"rules/prefer-enum-member",
			"rules/prefer-module-scope-constants",
			"rules/prefer-pattern-replacements",
			"rules/require-paired-calls",
		],
		slug: "/eslint-cease-nonsense-rules/rules/prefer-early-return/",
	},
	naming: {
		label: "Naming & Conventions",
		rules: [
			"rules/array-type-generic",
			"rules/naming-convention",
			"rules/no-empty-array-literal",
			"rules/no-shorthand-names",
			"rules/prefer-pascal-case-enums",
			"rules/prefer-singular-enums",
			"rules/prevent-abbreviations",
		],
		slug: "/eslint-cease-nonsense-rules/rules/naming-convention/",
	},
	react: {
		label: "React Rules",
		rules: [
			"rules/ban-react-fc",
			"rules/no-god-components",
			"rules/no-memo-children",
			"rules/no-new-instance-in-use-memo",
			"rules/no-underscore-react-props",
			"rules/no-unused-use-memo",
			"rules/no-useless-use-memo",
			"rules/no-useless-use-effect",
			"rules/no-useless-use-spring",
			"rules/prefer-context-stack",
			"rules/prefer-local-portal-component",
			"rules/prefer-padding-components",
			"rules/prefer-read-only-props",
			"rules/prefer-ternary-conditional-rendering",
			"rules/react-hooks-strict-return",
			"rules/require-named-effect-functions",
			"rules/require-react-component-keys",
			"rules/require-react-display-names",
			"rules/strict-component-boundaries",
			"rules/use-exhaustive-dependencies",
			"rules/use-hook-at-top-level",
		],
		slug: "/eslint-cease-nonsense-rules/rules/ban-react-fc/",
	},
	roblox: {
		label: "Roblox & Luau Rules",
		rules: [
			"rules/ban-instances",
			"rules/enforce-ianitor-check-type",
			"rules/misleading-lua-tuple-checks",
			"rules/no-array-constructor-elements",
			"rules/no-array-size-assignment",
			"rules/no-color3-constructor",
			"rules/no-instance-methods-without-this",
			"rules/no-print",
			"rules/no-table-create-map",
			"rules/no-warn",
			"rules/prefer-enum-item",
			"rules/prefer-idiv",
			"rules/prefer-sequence-overloads",
			"rules/prefer-single-world-query",
			"rules/prefer-udim2-shorthand",
			"rules/require-module-level-instantiation",
			"rules/require-serialized-numeric-data-type",
		],
		slug: "/eslint-cease-nonsense-rules/rules/ban-instances/",
	},
} satisfies Record<RuleCategoryKey, RuleCategoryDefinition>;

export const ruleCategoryOrder: ReadonlyArray<RuleCategoryKey> = ["react", "roblox", "naming", "general"];

export const ruleSidebarGroups = ruleCategoryOrder.map((category) => ({
	collapsed: false,
	items: [...ruleCategoryDefinitions[category].rules],
	label: ruleCategoryDefinitions[category].label,
	translations: {},
})) satisfies NonNullable<StarlightUserConfig["sidebar"]>;
