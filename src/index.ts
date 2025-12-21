import type { TSESLint } from "@typescript-eslint/utils";
import type { Rule } from "eslint";
import banInstances from "./rules/ban-instances";
import banReactFC from "./rules/ban-react-fc";
import enforceIanitorCheckType from "./rules/enforce-ianitor-check-type";
import fastFormat from "./rules/fast-format";
import misleadingLuaTupleChecks from "./rules/misleading-lua-tuple-checks";
import noAsyncConstructor from "./rules/no-async-constructor";
import noColor3Constructor from "./rules/no-color3-constructor";
import noCommentedCode from "./rules/no-commented-code";
import noGodComponents from "./rules/no-god-components";
import noIdentityMap from "./rules/no-identity-map";
import noInstanceMethodsWithoutThis from "./rules/no-instance-methods-without-this";
import noPrint from "./rules/no-print";
import noShorthandNames from "./rules/no-shorthand-names";
import noUselessUseSpring from "./rules/no-useless-use-spring";
import noWarn from "./rules/no-warn";
import preferClassProperties from "./rules/prefer-class-properties";
import preferEarlyReturn from "./rules/prefer-early-return";
import preferModuleScopeConstants from "./rules/prefer-module-scope-constants";
import preferPascalCaseEnums from "./rules/prefer-pascal-case-enums";
import preferSequenceOverloads from "./rules/prefer-sequence-overloads";
import preferSingularEnums from "./rules/prefer-singular-enums";
import preferUDim2Shorthand from "./rules/prefer-udim2-shorthand";
import reactHooksStrictReturn from "./rules/react-hooks-strict-return";
import requireNamedEffectFunctions from "./rules/require-named-effect-functions";
import requirePairedCalls from "./rules/require-paired-calls";
import requireReactComponentKeys from "./rules/require-react-component-keys";
import strictComponentBoundaries from "./rules/strict-component-boundaries";
import useExhaustiveDependencies from "./rules/use-exhaustive-dependencies";
import useHookAtTopLevel from "./rules/use-hook-at-top-level";

type AnyRuleModule = Rule.RuleModule | TSESLint.AnyRuleModuleWithMetaDocs;

export type { BanInstancesOptions } from "./rules/ban-instances";
export type { ComplexityConfiguration } from "./rules/enforce-ianitor-check-type";
export type { NoGodComponentsOptions } from "./rules/no-god-components";
export type { NoIdentityMapOptions } from "./rules/no-identity-map";
export type { NoInstanceMethodsOptions } from "./rules/no-instance-methods-without-this";
export type { NoShorthandOptions } from "./rules/no-shorthand-names";
export type { NoUselessUseSpringOptions } from "./rules/no-useless-use-spring";
export type { EffectFunctionOptions, EnvironmentMode, HookConfiguration } from "./rules/require-named-effect-functions";
export type { PairConfiguration, RequirePairedCallsOptions } from "./rules/require-paired-calls";
export type { ReactKeysOptions } from "./rules/require-react-component-keys";
export type { HookEntry, UseExhaustiveDependenciesOptions } from "./rules/use-exhaustive-dependencies";
export {
	createBanInstancesOptions,
	createComplexityConfiguration,
	createEffectFunctionOptions,
	createHookConfiguration,
	createNoGodComponentsOptions,
	createNoInstanceMethodsOptions,
	createNoShorthandOptions,
	createNoUselessUseSpringOptions,
	createPairConfiguration,
	createReactKeysOptions,
	createRequirePairedCallsOptions,
	createUseExhaustiveDependenciesOptions,
	createUseHookAtTopLevelOptions,
	defaultRobloxProfilePair,
} from "./utilities/configure-utilities";

/**
 * ESLint plugin entry for eslint-cease-nonsense-rules.
 *
 * Exposes rule implementations and configuration presets for ESLint flat config.
 */
const rules: Readonly<Record<string, AnyRuleModule>> = {
	"ban-instances": banInstances,
	"ban-react-fc": banReactFC,
	"enforce-ianitor-check-type": enforceIanitorCheckType,
	"fast-format": fastFormat,
	"misleading-lua-tuple-checks": misleadingLuaTupleChecks,
	"no-async-constructor": noAsyncConstructor,
	"no-color3-constructor": noColor3Constructor,
	"no-commented-code": noCommentedCode,
	"no-god-components": noGodComponents,
	"no-identity-map": noIdentityMap,
	"no-instance-methods-without-this": noInstanceMethodsWithoutThis,
	"no-print": noPrint,
	"no-shorthand-names": noShorthandNames,
	"no-useless-use-spring": noUselessUseSpring,
	"no-warn": noWarn,
	"prefer-class-properties": preferClassProperties,
	"prefer-early-return": preferEarlyReturn,
	"prefer-module-scope-constants": preferModuleScopeConstants,
	"prefer-pascal-case-enums": preferPascalCaseEnums,
	"prefer-sequence-overloads": preferSequenceOverloads,
	"prefer-singular-enums": preferSingularEnums,
	"prefer-udim2-shorthand": preferUDim2Shorthand,
	"react-hooks-strict-return": reactHooksStrictReturn,
	"require-named-effect-functions": requireNamedEffectFunctions,
	"require-paired-calls": requirePairedCalls,
	"require-react-component-keys": requireReactComponentKeys,
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
const recommended = {
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
		"cease-nonsense/no-print": "error",
		"cease-nonsense/no-shorthand-names": "error",
		"cease-nonsense/no-warn": "error",
		"cease-nonsense/prefer-sequence-overloads": "error",
		"cease-nonsense/prefer-udim2-shorthand": "error",
		"cease-nonsense/require-named-effect-functions": "error",
		"cease-nonsense/require-react-component-keys": "error",
		"cease-nonsense/use-exhaustive-dependencies": "error",
		"cease-nonsense/use-hook-at-top-level": "error",
	},
} as const;

type PluginConfig = typeof recommended;

interface Plugin {
	readonly rules: Readonly<Record<string, AnyRuleModule>>;
	readonly configs: { readonly recommended: PluginConfig };
}

const plugin: Plugin = {
	configs: { recommended },
	rules,
} as const;

export default plugin;
