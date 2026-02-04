import type { LooseRuleDefinition } from "@typescript-eslint/utils/ts-eslint";
import banInstances from "./rules/ban-instances";
import banReactFC from "./rules/ban-react-fc";
import enforceIanitorCheckType from "./rules/enforce-ianitor-check-type";
import fastFormat from "./rules/fast-format";
import memoizedEffectDependencies from "./rules/memoized-effect-dependencies";
import misleadingLuaTupleChecks from "./rules/misleading-lua-tuple-checks";
import namingConvention from "./rules/naming-convention";
import noAsyncConstructor from "./rules/no-async-constructor";
import noColor3Constructor from "./rules/no-color3-constructor";
import noCommentedCode from "./rules/no-commented-code";
import noGodComponents from "./rules/no-god-components";
import noIdentityMap from "./rules/no-identity-map";
import noInstanceMethodsWithoutThis from "./rules/no-instance-methods-without-this";
import noMemoChildren from "./rules/no-memo-children";
import noPrint from "./rules/no-print";
import noShorthandNames from "./rules/no-shorthand-names";
import noUnusedImports from "./rules/no-unused-imports";
import noUnusedUseMemo from "./rules/no-unused-use-memo";
import noUselessUseEffect from "./rules/no-useless-use-effect";
import noUselessUseSpring from "./rules/no-useless-use-spring";
import noWarn from "./rules/no-warn";
import preferClassProperties from "./rules/prefer-class-properties";
import preferEarlyReturn from "./rules/prefer-early-return";
import preferEnumItem from "./rules/prefer-enum-item";
import preferEnumMember from "./rules/prefer-enum-member";
import preferModuleScopeConstants from "./rules/prefer-module-scope-constants";
import preferPascalCaseEnums from "./rules/prefer-pascal-case-enums";
import preferPatternReplacements from "./rules/prefer-pattern-replacements";
import preferReadOnlyProps from "./rules/prefer-read-only-props";
import preferSequenceOverloads from "./rules/prefer-sequence-overloads";
import preferSingleWorldQuery from "./rules/prefer-single-world-query";
import preferSingularEnums from "./rules/prefer-singular-enums";
import preferUDim2Shorthand from "./rules/prefer-udim2-shorthand";
import preventAbbreviations from "./rules/prevent-abbreviations";
import reactHooksStrictReturn from "./rules/react-hooks-strict-return";
import requireModuleLevelInstantiation from "./rules/require-module-level-instantiation";
import requireNamedEffectFunctions from "./rules/require-named-effect-functions";
import requirePairedCalls from "./rules/require-paired-calls";
import requireReactComponentKeys from "./rules/require-react-component-keys";
import requireReactDisplayNames from "./rules/require-react-display-names";
import requireSerializedNumericDataType from "./rules/require-serialized-numeric-data-type";
import strictComponentBoundaries from "./rules/strict-component-boundaries";
import useExhaustiveDependencies from "./rules/use-exhaustive-dependencies";
import useHookAtTopLevel from "./rules/use-hook-at-top-level";
import type { ReadonlyRecord } from "./types/utility-types.d";

export type { BanInstancesOptions } from "./rules/ban-instances";
export type { ComplexityConfiguration } from "./rules/enforce-ianitor-check-type";
export type { MemoizedEffectDependenciesOptions } from "./rules/memoized-effect-dependencies";
export type { NamingConventionOptions } from "./rules/naming-convention";
export type { NoGodComponentsOptions } from "./rules/no-god-components";
export type { NoIdentityMapOptions } from "./rules/no-identity-map";
export type { NoInstanceMethodsOptions } from "./rules/no-instance-methods-without-this";
export type { NoMemoChildrenOptions } from "./rules/no-memo-children";
export type { NoShorthandOptions } from "./rules/no-shorthand-names";
export type { NoUnusedImportsOptions } from "./rules/no-unused-imports";
export type { NoUnusedUseMemoOptions } from "./rules/no-unused-use-memo";
export type { NoUselessUseEffectOptions } from "./rules/no-useless-use-effect";
export type { NoUselessUseSpringOptions } from "./rules/no-useless-use-spring";
export type { PreferEnumItemOptions } from "./rules/prefer-enum-item";
export type { PreventAbbreviationsOptions } from "./rules/prevent-abbreviations";
export type { RequireModuleLevelInstantiationOptions } from "./rules/require-module-level-instantiation";
export type { EffectFunctionOptions, HookConfiguration } from "./rules/require-named-effect-functions";
export type { PairConfiguration, RequirePairedCallsOptions } from "./rules/require-paired-calls";
export type { ReactKeysOptions } from "./rules/require-react-component-keys";
export type { RequireReactDisplayNamesOptions } from "./rules/require-react-display-names";
export type { RequireSerializedNumericDataTypeOptions } from "./rules/require-serialized-numeric-data-type";
export type { HookEntry, UseExhaustiveDependenciesOptions } from "./rules/use-exhaustive-dependencies";
export type { EnvironmentMode } from "./types/environment-mode";
export {
	createBanInstancesOptions,
	createComplexityConfiguration,
	createEffectFunctionOptions,
	createHookConfiguration,
	createNamingConventionOptions,
	createNoGodComponentsOptions,
	createNoInstanceMethodsOptions,
	createNoMemoChildrenOptions,
	createNoShorthandOptions,
	createNoUnusedImportsOptions,
	createNoUnusedUseMemoOptions,
	createNoUselessUseEffectOptions,
	createNoUselessUseSpringOptions,
	createPairConfiguration,
	createPreferEnumItemOptions,
	createPreferPatternReplacementsOptions,
	createPreventAbbreviationsOptions,
	createReactKeysOptions,
	createRequireModuleLevelInstantiationOptions,
	createRequirePairedCallsOptions,
	createRequireReactDisplayNamesOptions,
	createRequireSerializedNumericDataTypeOptions,
	createUseExhaustiveDependenciesOptions,
	createUseHookAtTopLevelOptions,
	defaultRobloxProfilePair,
} from "./utilities/configure-utilities";
export type { Pattern, PreferPatternReplacementsOptions } from "./utilities/pattern-replacement";
export { pattern } from "./utilities/pattern-replacement";

/**
 * ESLint plugin entry for eslint-cease-nonsense-rules.
 *
 * Exposes rule implementations and configuration presets for ESLint flat config.
 */
export const rules: ReadonlyRecord<string, LooseRuleDefinition> = {
	"ban-instances": banInstances,
	"ban-react-fc": banReactFC,
	"enforce-ianitor-check-type": enforceIanitorCheckType,
	"fast-format": fastFormat,
	"memoized-effect-dependencies": memoizedEffectDependencies,
	"misleading-lua-tuple-checks": misleadingLuaTupleChecks,
	"naming-convention": namingConvention,
	"no-async-constructor": noAsyncConstructor,
	"no-color3-constructor": noColor3Constructor,
	"no-commented-code": noCommentedCode,
	"no-god-components": noGodComponents,
	"no-identity-map": noIdentityMap,
	"no-instance-methods-without-this": noInstanceMethodsWithoutThis,
	"no-memo-children": noMemoChildren,
	"no-print": noPrint,
	"no-shorthand-names": noShorthandNames,
	"no-unused-imports": noUnusedImports,
	"no-unused-use-memo": noUnusedUseMemo,
	"no-useless-use-effect": noUselessUseEffect,
	"no-useless-use-spring": noUselessUseSpring,
	"no-warn": noWarn,
	"prefer-class-properties": preferClassProperties,
	"prefer-early-return": preferEarlyReturn,
	"prefer-enum-item": preferEnumItem,
	"prefer-enum-member": preferEnumMember,
	"prefer-module-scope-constants": preferModuleScopeConstants,
	"prefer-pascal-case-enums": preferPascalCaseEnums,
	"prefer-pattern-replacements": preferPatternReplacements,
	"prefer-read-only-props": preferReadOnlyProps,
	"prefer-sequence-overloads": preferSequenceOverloads,
	"prefer-single-world-query": preferSingleWorldQuery,
	"prefer-singular-enums": preferSingularEnums,
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
} as const;

/**
 * Recommended configuration for ESLint flat config.
 *
 * Enables all rules with recommended settings. Users should import this
 * configuration and add it to their flat config array.
 *
 * @example
 * ```typescript
 * import ceaseNonsense from '@pobammer-ts/eslint-cease-nonsense-rules';
 *
 * export default [
 *   ceaseNonsense.configs.recommended,
 *   // ... other configs
 * ];
 * ```
 */
export const recommended = {
	plugins: {
		"cease-nonsense": { rules },
	},
	rules: {
		"cease-nonsense/ban-react-fc": "error",
		"cease-nonsense/enforce-ianitor-check-type": "error",
		"cease-nonsense/fast-format": "error",
		"cease-nonsense/misleading-lua-tuple-checks": "error",
		"cease-nonsense/no-async-constructor": "error",
		"cease-nonsense/no-color3-constructor": "error",
		"cease-nonsense/no-god-components": "error",
		"cease-nonsense/no-identity-map": "error",
		"cease-nonsense/no-instance-methods-without-this": "error",
		"cease-nonsense/no-memo-children": "error",
		"cease-nonsense/no-print": "error",
		"cease-nonsense/no-shorthand-names": "error",
		"cease-nonsense/no-unused-imports": "error",
		"cease-nonsense/no-unused-use-memo": "error",
		"cease-nonsense/no-warn": "error",
		"cease-nonsense/prefer-enum-member": "error",
		"cease-nonsense/prefer-read-only-props": "error",
		"cease-nonsense/prefer-sequence-overloads": "error",
		"cease-nonsense/prefer-udim2-shorthand": "error",
		"cease-nonsense/require-named-effect-functions": "error",
		"cease-nonsense/require-react-component-keys": "error",
		"cease-nonsense/require-react-display-names": "error",
		"cease-nonsense/use-exhaustive-dependencies": "error",
		"cease-nonsense/use-hook-at-top-level": "error",
	},
} as const;

type PluginConfiguration = typeof recommended;

interface Plugin {
	readonly rules: ReadonlyRecord<string, LooseRuleDefinition>;
	readonly configs: { readonly recommended: PluginConfiguration };
}

const plugin: Plugin = {
	configs: { recommended },
	rules,
} as const;

export default plugin;
