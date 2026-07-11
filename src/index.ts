import arrayTypeGeneric from "$rules/array-type-generic";
import banInstances from "$rules/ban-instances";
import banReactFC from "$rules/ban-react-fc";
import dotNotation from "$rules/dot-notation";
import enforceIanitorCheckType from "$rules/enforce-ianitor-check-type";
import fastFormat from "$rules/fast-format";
import memoizedEffectDependencies from "$rules/memoized-effect-dependencies";
import misleadingLuaTupleChecks from "$rules/misleading-lua-tuple-checks";
import namingConvention from "$rules/naming-convention";
import noArrayConstructorElements from "$rules/no-array-constructor-elements";
import noArraySizeAssignment from "$rules/no-array-size-assignment";
import noAsyncConstructor from "$rules/no-async-constructor";
import noColor3Constructor from "$rules/no-color3-constructor";
import noCommentedCode from "$rules/no-commented-code";
import noConstantConditionWithBreak from "$rules/no-constant-condition-with-break";
import noEmptyArrayLiteral from "$rules/no-empty-array-literal";
import noEventsInEventsCallback from "$rules/no-events-in-events-callback";
import noGodComponents from "$rules/no-god-components";
import noIdentityMap from "$rules/no-identity-map";
import noInstanceMethodsWithoutThis from "$rules/no-instance-methods-without-this";
import noManualChildrenProperty from "$rules/no-manual-children-property";
import noMemoChildren from "$rules/no-memo-children";
import noNetworkFastResult from "$rules/no-network-fast-result";
import noNewInstanceInUseMemo from "$rules/no-new-instance-in-use-memo";
import noPrint from "$rules/no-print";
import noRenderHelperFunctions from "$rules/no-render-helper-functions";
import noShorthandNames from "$rules/no-shorthand-names";
import noTableCreateMap from "$rules/no-table-create-map";
import noUnderscoreReactProperties from "$rules/no-underscore-react-properties";
import noUnusedImports from "$rules/no-unused-imports";
import noUnusedUseMemo from "$rules/no-unused-use-memo";
import noUselessUseEffect from "$rules/no-useless-use-effect";
import noUselessUseMemo from "$rules/no-useless-use-memo";
import noUselessUseSpring from "$rules/no-useless-use-spring";
import noWarn from "$rules/no-warn";
import preferClassProperties from "$rules/prefer-class-properties";
import preferContextStack from "$rules/prefer-context-stack";
import preferEarlyReturn from "$rules/prefer-early-return";
import preferEnumItem from "$rules/prefer-enum-item";
import preferEnumMember from "$rules/prefer-enum-member";
import preferIdiv from "$rules/prefer-idiv";
import preferLocalPortalComponent from "$rules/prefer-local-portal-component";
import preferModuleScopeConstants from "$rules/prefer-module-scope-constants";
import preferPaddingComponents from "$rules/prefer-padding-components";
import preferPascalCaseEnums from "$rules/prefer-pascal-case-enums";
import preferPatternReplacements from "$rules/prefer-pattern-replacements";
import preferReadOnlyProperties from "$rules/prefer-read-only-properties";
import preferSequenceOverloads from "$rules/prefer-sequence-overloads";
import preferSingleWorldQuery from "$rules/prefer-single-world-query";
import preferSingularEnums from "$rules/prefer-singular-enums";
import preferTernaryConditionalRendering from "$rules/prefer-ternary-conditional-rendering";
import preferUDim2Shorthand from "$rules/prefer-udim2-shorthand";
import preventAbbreviations from "$rules/prevent-abbreviations";
import reactHooksStrictReturn from "$rules/react-hooks-strict-return";
import requireModuleLevelInstantiation from "$rules/require-module-level-instantiation";
import requireNamedEffectFunctions from "$rules/require-named-effect-functions";
import requirePairedCalls from "$rules/require-paired-calls";
import requireReactComponentKeys from "$rules/require-react-component-keys";
import requireReactDisplayNames from "$rules/require-react-display-names";
import requireSerializedNumericDataType from "$rules/require-serialized-numeric-data-type";
import strictComponentBoundaries from "$rules/strict-component-boundaries";
import useExhaustiveDependencies from "$rules/use-exhaustive-dependencies";
import useHookAtTopLevel from "$rules/use-hook-at-top-level";

import type { ReadonlyRecord } from "$types/utility-types.d";
import type { LooseRuleDefinition } from "@typescript-eslint/utils/ts-eslint";

export type { BanInstancesOptions } from "$rules/ban-instances";
export type { ComplexityConfiguration } from "$rules/enforce-ianitor-check-type";
export type { DotNotationOptions } from "$rules/dot-notation";
export type { MemoizedEffectDependenciesOptions } from "$rules/memoized-effect-dependencies";
export type { NamingConventionOptions } from "$rules/naming-convention";
export type { TypeMatcher, TypeReference } from "$utilities/naming-convention-utilities/types";
export type { NoArrayConstructorElementsOptions } from "$rules/no-array-constructor-elements";
export type { NoArraySizeAssignmentOptions } from "$rules/no-array-size-assignment";
export type { NoConstantConditionWithBreakOptions } from "$rules/no-constant-condition-with-break";
export type { NoEmptyArrayLiteralOptions } from "$rules/no-empty-array-literal";
export type { NoEventsInEventsCallbackOptions } from "$rules/no-events-in-events-callback";
export type { NoGodComponentsOptions } from "$rules/no-god-components";
export type { NoIdentityMapOptions } from "$rules/no-identity-map";
export type { NoInstanceMethodsOptions } from "$rules/no-instance-methods-without-this";
export type { NoManualChildrenPropertyOptions } from "$rules/no-manual-children-property";
export type { NoMemoChildrenOptions } from "$rules/no-memo-children";
export type { NoNewInstanceInUseMemoOptions } from "$rules/no-new-instance-in-use-memo";
export type { NoNetworkFastResultOptions } from "$rules/no-network-fast-result";
export type { NoShorthandOptions } from "$rules/no-shorthand-names";
export type { NoUnusedImportsOptions } from "$rules/no-unused-imports";
export type { NoUnusedUseMemoOptions } from "$rules/no-unused-use-memo";
export type { NoUselessUseEffectOptions } from "$rules/no-useless-use-effect";
export type { NoUselessUseMemoOptions } from "$rules/no-useless-use-memo";
export type { NoUselessUseSpringOptions } from "$rules/no-useless-use-spring";
export type { PreferEnumItemOptions } from "$rules/prefer-enum-item";
export type { PreventAbbreviationsOptions } from "$rules/prevent-abbreviations";
export type { RequireModuleLevelInstantiationOptions } from "$rules/require-module-level-instantiation";
export type { EffectFunctionOptions, HookConfiguration } from "$rules/require-named-effect-functions";
export type { PairConfiguration, RequirePairedCallsOptions } from "$rules/require-paired-calls";
export type { ReactKeysOptions } from "$rules/require-react-component-keys";
export type { RequireReactDisplayNamesOptions } from "$rules/require-react-display-names";
export type { RequireSerializedNumericDataTypeOptions } from "$rules/require-serialized-numeric-data-type";
export type { HookEntry, UseExhaustiveDependenciesOptions } from "$rules/use-exhaustive-dependencies";
export type { EnvironmentMode } from "$types/environment-mode";
export type { Pattern, PreferPatternReplacementsOptions } from "$utilities/pattern-replacement/pattern-types";

/**
 * ESLint plugin entry for eslint-cease-nonsense-rules.
 *
 * Exposes rule implementations and configuration presets for ESLint flat config.
 */
const ruleImplementations = {
	"array-type-generic": arrayTypeGeneric,
	"ban-instances": banInstances,
	"ban-react-fc": banReactFC,
	"dot-notation": dotNotation,
	"enforce-ianitor-check-type": enforceIanitorCheckType,
	"fast-format": fastFormat,
	"memoized-effect-dependencies": memoizedEffectDependencies,
	"misleading-lua-tuple-checks": misleadingLuaTupleChecks,
	"naming-convention": namingConvention,
	"no-array-constructor-elements": noArrayConstructorElements,
	"no-array-size-assignment": noArraySizeAssignment,
	"no-async-constructor": noAsyncConstructor,
	"no-color3-constructor": noColor3Constructor,
	"no-commented-code": noCommentedCode,
	"no-constant-condition-with-break": noConstantConditionWithBreak,
	"no-empty-array-literal": noEmptyArrayLiteral,
	"no-events-in-events-callback": noEventsInEventsCallback,
	"no-god-components": noGodComponents,
	"no-identity-map": noIdentityMap,
	"no-instance-methods-without-this": noInstanceMethodsWithoutThis,
	"no-manual-children-property": noManualChildrenProperty,
	"no-memo-children": noMemoChildren,
	"no-network-fast-result": noNetworkFastResult,
	"no-new-instance-in-use-memo": noNewInstanceInUseMemo,
	"no-print": noPrint,
	"no-render-helper-functions": noRenderHelperFunctions,
	"no-shorthand-names": noShorthandNames,
	"no-table-create-map": noTableCreateMap,
	"no-underscore-react-props": noUnderscoreReactProperties,
	"no-unused-imports": noUnusedImports,
	"no-unused-use-memo": noUnusedUseMemo,
	"no-useless-use-effect": noUselessUseEffect,
	"no-useless-use-memo": noUselessUseMemo,
	"no-useless-use-spring": noUselessUseSpring,
	"no-warn": noWarn,
	"prefer-class-properties": preferClassProperties,
	"prefer-context-stack": preferContextStack,
	"prefer-early-return": preferEarlyReturn,
	"prefer-enum-item": preferEnumItem,
	"prefer-enum-member": preferEnumMember,
	"prefer-idiv": preferIdiv,
	"prefer-local-portal-component": preferLocalPortalComponent,
	"prefer-module-scope-constants": preferModuleScopeConstants,
	"prefer-padding-components": preferPaddingComponents,
	"prefer-pascal-case-enums": preferPascalCaseEnums,
	"prefer-pattern-replacements": preferPatternReplacements,
	"prefer-read-only-props": preferReadOnlyProperties,
	"prefer-sequence-overloads": preferSequenceOverloads,
	"prefer-single-world-query": preferSingleWorldQuery,
	"prefer-singular-enums": preferSingularEnums,
	"prefer-ternary-conditional-rendering": preferTernaryConditionalRendering,
	"prefer-udim2-shorthand": preferUDim2Shorthand,
	"prevent-abbreviations": preventAbbreviations,
	"react-hooks-strict-return": reactHooksStrictReturn,
	"require-module-level-instantiation": requireModuleLevelInstantiation,
	"require-named-effect-functions": requireNamedEffectFunctions,
	"require-paired-calls": requirePairedCalls,
	"require-react-component-keys": requireReactComponentKeys,
	"require-react-display-names": requireReactDisplayNames,
	"require-serialized-numeric-data-type": requireSerializedNumericDataType,
	"strict-component-boundaries": strictComponentBoundaries,
	"use-exhaustive-dependencies": useExhaustiveDependencies,
	"use-hook-at-top-level": useHookAtTopLevel,
} as const satisfies ReadonlyRecord<string, LooseRuleDefinition>;

export const rules: ReadonlyRecord<string, LooseRuleDefinition> = ruleImplementations;

const recommendedRuleNames = [
	"array-type-generic",
	"ban-react-fc",
	"dot-notation",
	"enforce-ianitor-check-type",
	"fast-format",
	"misleading-lua-tuple-checks",
	"no-array-constructor-elements",
	"no-array-size-assignment",
	"no-async-constructor",
	"no-color3-constructor",
	"no-empty-array-literal",
	"no-god-components",
	"no-identity-map",
	"no-instance-methods-without-this",
	"no-memo-children",
	"no-new-instance-in-use-memo",
	"no-network-fast-result",
	"no-print",
	"no-render-helper-functions",
	"no-shorthand-names",
	"no-table-create-map",
	"no-underscore-react-props",
	"no-unused-imports",
	"no-unused-use-memo",
	"no-useless-use-effect",
	"no-useless-use-memo",
	"no-useless-use-spring",
	"no-warn",
	"prefer-enum-member",
	"prefer-idiv",
	"prefer-read-only-props",
	"prefer-sequence-overloads",
	"prefer-ternary-conditional-rendering",
	"prefer-udim2-shorthand",
	"require-named-effect-functions",
	"require-react-component-keys",
	"require-react-display-names",
	"use-exhaustive-dependencies",
	"use-hook-at-top-level",
] as const satisfies ReadonlyArray<keyof typeof ruleImplementations>;

function createRecommendedRules(ruleNames: ReadonlyArray<keyof typeof ruleImplementations>): Record<string, "error"> {
	const recommendedRules: Record<string, "error"> = {};

	for (const ruleName of ruleNames) {
		recommendedRules[`cease-nonsense/${ruleName}`] = "error";
	}

	return recommendedRules;
}

/**
 * Recommended configuration for ESLint flat config.
 *
 * Enables all rules with recommended settings. Users should import this configuration and add it to their flat config
 * array.
 *
 * @example
 * 	```typescript
 * 	import ceaseNonsense from "@pobammer-ts/eslint-cease-nonsense-rules";
 *
 * 	export default [
 * 		ceaseNonsense.configs.recommended,
 * 		// ... other configs
 * 	];
 * 	```;
 */
export const recommended = {
	plugins: {
		"cease-nonsense": { rules },
	},
	rules: createRecommendedRules(recommendedRuleNames),
} as const;

type PluginConfiguration = typeof recommended;

interface Plugin {
	readonly configs: { readonly recommended: PluginConfiguration };
	readonly rules: ReadonlyRecord<string, LooseRuleDefinition>;
}

const plugin: Plugin = {
	configs: { recommended },
	rules,
} as const;

export default plugin;

export { pattern } from "$utilities/pattern-replacement/pattern-types";
