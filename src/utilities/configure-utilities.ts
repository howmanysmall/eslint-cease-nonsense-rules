import type { BanInstancesOptions } from "../rules/ban-instances";
import type { ComplexityConfiguration } from "../rules/enforce-ianitor-check-type";
import type { NamingConventionOptions } from "../rules/naming-convention";
import type { NoGodComponentsOptions } from "../rules/no-god-components";
import type { NoInstanceMethodsOptions } from "../rules/no-instance-methods-without-this";
import type { NoMemoChildrenOptions } from "../rules/no-memo-children";
import type { NoShorthandOptions } from "../rules/no-shorthand-names";
import type { NoUnusedImportsOptions } from "../rules/no-unused-imports";
import type { NoUnusedUseMemoOptions } from "../rules/no-unused-use-memo";
import type { NoUselessUseEffectOptions } from "../rules/no-useless-use-effect";
import type { NoUselessUseSpringOptions } from "../rules/no-useless-use-spring";
import { DEFAULT_STATIC_GLOBAL_FACTORIES } from "../rules/no-useless-use-spring";
import type { PreferEnumItemOptions } from "../rules/prefer-enum-item";
import type { PreventAbbreviationsOptions } from "../rules/prevent-abbreviations";
import type { RequireModuleLevelInstantiationOptions } from "../rules/require-module-level-instantiation";
import type { EffectFunctionOptions, HookConfiguration } from "../rules/require-named-effect-functions";
import type { PairConfiguration, RequirePairedCallsOptions } from "../rules/require-paired-calls";
import type { ReactKeysOptions } from "../rules/require-react-component-keys";
import type { RequireReactDisplayNamesOptions } from "../rules/require-react-display-names";
import type { RequireSerializedNumericDataTypeOptions } from "../rules/require-serialized-numeric-data-type";
import type { UseExhaustiveDependenciesOptions } from "../rules/use-exhaustive-dependencies";
import type { UseHookAtTopLevelOptions } from "../rules/use-hook-at-top-level";
import type { Pattern, PreferPatternReplacementsOptions } from "./pattern-replacement";

/**
 * Creates a pair configuration for require-paired-calls rule
 * @param opener - The opener function name
 * @param closer - The closer function name(s)
 * @param options - Additional options
 * @returns The pair configuration
 */
export function createPairConfiguration(
	opener: string,
	closer: string | ReadonlyArray<string>,
	options: Partial<Omit<PairConfiguration, "opener" | "closer">> = {},
): PairConfiguration {
	return { closer, opener, ...options };
}

/**
 * Default Roblox profiling pair configuration
 */
export const defaultRobloxProfilePair: PairConfiguration = {
	closer: "debug.profileend",
	opener: "debug.profilebegin",
	platform: "roblox",
	requireSync: true,
	yieldingFunctions: ["task.wait", "wait", "*.WaitForChild"],
};

/**
 * Creates options for ban-instances rule
 * @param options - Partial configuration options
 * @returns The full options
 */
export function createBanInstancesOptions(options: Partial<BanInstancesOptions> = {}): BanInstancesOptions {
	return { bannedInstances: [], ...options };
}

/**
 * Creates a complexity configuration for enforce-ianitor-check-type rule
 * @param options - Partial configuration options
 * @returns The full complexity configuration
 */
export function createComplexityConfiguration(options: Partial<ComplexityConfiguration> = {}): ComplexityConfiguration {
	return {
		baseThreshold: 10,
		errorThreshold: 25,
		interfacePenalty: 20,
		performanceMode: true,
		warnThreshold: 15,
		...options,
	};
}

/**
 * Creates a no-instance-methods options for no-instance-methods-without-this rule
 * @param options - Partial configuration options
 * @returns The full options
 */
export function createNoInstanceMethodsOptions(
	options: Partial<NoInstanceMethodsOptions> = {},
): NoInstanceMethodsOptions {
	return {
		checkPrivate: false,
		checkProtected: false,
		checkPublic: false,
		...options,
	};
}

/**
 * Creates options for no-memo-children rule
 * @param options - Partial configuration options
 * @returns The full options
 */
export function createNoMemoChildrenOptions(options: Partial<NoMemoChildrenOptions> = {}): NoMemoChildrenOptions {
	return { allowedComponents: [], environment: "roblox-ts", ...options };
}

/**
 * Creates a no-shorthand options for no-shorthand-names rule
 * @param options - Partial configuration options
 * @returns The full options
 */
export function createNoShorthandOptions(options: Partial<NoShorthandOptions> = {}): NoShorthandOptions {
	return { allowPropertyAccess: [], ignoreShorthands: [], shorthands: {}, ...options };
}

/**
 * Creates an effect function options for require-named-effect-functions rule
 * @param options - Partial configuration options
 * @returns The full options
 */
export function createEffectFunctionOptions(options: Partial<EffectFunctionOptions> = {}): EffectFunctionOptions {
	return { environment: "standard", hooks: [], ...options };
}

/**
 * Creates a hook configuration for require-named-effect-functions rule
 * @param name - The hook name
 * @param options - Partial configuration options
 * @returns The full hook configuration
 */
export function createHookConfiguration(
	name: string,
	options: Partial<Omit<HookConfiguration, "name">> = {},
): HookConfiguration {
	return { allowAsync: false, name, ...options };
}

/**
 * Creates a require-paired-calls options for require-paired-calls rule
 * @param options - Partial configuration options
 * @returns The full options
 */
export function createRequirePairedCallsOptions(
	options: Partial<RequirePairedCallsOptions> = {},
): RequirePairedCallsOptions {
	return {
		allowConditionalClosers: false,
		allowMultipleOpeners: true,
		maxNestingDepth: 0,
		pairs: [],
		...options,
	};
}

/**
 * Creates a react keys options for require-react-component-keys rule
 * @param options - Partial configuration options
 * @returns The full options
 */
export function createReactKeysOptions(options: Partial<ReactKeysOptions> = {}): ReactKeysOptions {
	return {
		allowRootKeys: false,
		ignoreCallExpressions: [],
		iterationMethods: ["map", "forEach", "filter"],
		memoizationHooks: ["useMemo", "useCallback"],
		...options,
	};
}

/**
 * Creates options for no-god-components rule
 * @param options - Partial configuration options
 * @returns The full options
 */
export function createNoGodComponentsOptions(options: Partial<NoGodComponentsOptions> = {}): NoGodComponentsOptions {
	return {
		enforceTargetLines: true,
		ignoreComponents: [],
		maxDestructuredProps: 5,
		maxLines: 200,
		maxStateHooks: 5,
		maxTsxNesting: 3,
		stateHooks: ["useState", "useReducer", "useBinding"],
		targetLines: 120,
		...options,
	};
}

/**
 * Creates a use-exhaustive-dependencies options for use-exhaustive-dependencies rule
 * @param options - Partial configuration options
 * @returns The full options
 */
export function createUseExhaustiveDependenciesOptions(
	options: Partial<UseExhaustiveDependenciesOptions> = {},
): UseExhaustiveDependenciesOptions {
	return {
		hooks: [],
		reportMissingDependenciesArray: false,
		reportUnnecessaryDependencies: false,
		...options,
	};
}

/**
 * Creates options for use-hook-at-top-level rule
 * @param options - Partial configuration options
 * @returns The full options
 */
export function createUseHookAtTopLevelOptions(
	options: Partial<UseHookAtTopLevelOptions> = {},
): UseHookAtTopLevelOptions {
	return {
		ignoreHooks: [],
		importSources: {},
		onlyHooks: [],
		...options,
	};
}

/**
 * Creates options for no-useless-use-spring rule
 * @param options - Partial configuration options
 * @returns The full options
 */
export function createNoUselessUseSpringOptions(
	options: Partial<NoUselessUseSpringOptions> = {},
): NoUselessUseSpringOptions {
	return {
		springHooks: ["useSpring"],
		staticGlobalFactories: DEFAULT_STATIC_GLOBAL_FACTORIES,
		treatEmptyDepsAsViolation: true,
		...options,
	};
}

/**
 * Creates options for prefer-pattern-replacements rule
 * @param patterns - Array of pattern configurations
 * @returns The full options
 */
export function createPreferPatternReplacementsOptions(
	patterns: ReadonlyArray<Pattern> = [],
): PreferPatternReplacementsOptions {
	return { patterns };
}

/**
 * Creates options for prefer-enum-item rule
 * @param options - Partial configuration options
 * @returns The full options
 */
export function createPreferEnumItemOptions(options: Partial<PreferEnumItemOptions> = {}): PreferEnumItemOptions {
	return { fixNumericToValue: false, performanceMode: false, ...options };
}

/**
 * Creates options for require-react-display-names rule
 * @param options - Partial configuration options
 * @returns The full options
 */
export function createRequireReactDisplayNamesOptions(
	options: Partial<RequireReactDisplayNamesOptions> = {},
): RequireReactDisplayNamesOptions {
	return { environment: "roblox-ts", ...options };
}

/**
 * Creates options for require-module-level-instantiation rule
 * @param options - Partial configuration options
 * @returns The full options
 */
export function createRequireModuleLevelInstantiationOptions(
	options: Partial<RequireModuleLevelInstantiationOptions> = {},
): RequireModuleLevelInstantiationOptions {
	return { classes: {}, ...options };
}

/**
 * Creates options for naming-convention rule
 * @param options - Partial configuration options
 * @returns The full options
 */
export function createNamingConventionOptions(options: Partial<NamingConventionOptions> = {}): NamingConventionOptions {
	return {
		format: ["PascalCase"],
		selector: "interface",
		...options,
	};
}

/**
 * Creates options for no-unused-imports rule
 * @param options - Partial configuration options
 * @returns The full options
 */
export function createNoUnusedImportsOptions(options: Partial<NoUnusedImportsOptions> = {}): NoUnusedImportsOptions {
	return { checkJSDoc: true, ...options };
}

/**
 * Creates options for no-unused-use-memo rule
 * @param options - Partial configuration options
 * @returns The full options
 */
export function createNoUnusedUseMemoOptions(options: Partial<NoUnusedUseMemoOptions> = {}): NoUnusedUseMemoOptions {
	return { environment: "roblox-ts", ...options };
}

/**
 * Creates options for no-useless-use-effect rule
 * @param options - Partial configuration options
 * @returns The full options
 */
export function createNoUselessUseEffectOptions(
	options: Partial<NoUselessUseEffectOptions> = {},
): NoUselessUseEffectOptions {
	return {
		environment: "roblox-ts",
		hooks: ["useEffect", "useLayoutEffect", "useInsertionEffect"],
		propertyCallbackPrefixes: ["on"],
		reportDerivedState: true,
		reportEventFlag: true,
		reportNotifyParent: true,
		...options,
	};
}

/**
 * Creates options for prevent-abbreviations rule
 * @param options - Partial configuration options
 * @returns The full options
 */
export function createPreventAbbreviationsOptions(
	options: Partial<PreventAbbreviationsOptions> = {},
): PreventAbbreviationsOptions {
	return {
		allowList: {},
		checkFilenames: true,
		checkProperties: false,
		checkVariables: true,
		ignore: [],
		replacements: {},
		...options,
	};
}

/**
 * Creates options for require-serialized-numeric-data-type rule
 * @param options - Partial configuration options
 * @returns The full options
 */
export function createRequireSerializedNumericDataTypeOptions(
	options: Partial<RequireSerializedNumericDataTypeOptions> = {},
): RequireSerializedNumericDataTypeOptions {
	return {
		functionNames: ["registerComponent"],
		mode: "type-arguments",
		strict: false,
		...options,
	};
}
