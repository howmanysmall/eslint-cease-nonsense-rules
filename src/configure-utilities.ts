import type { BanInstancesOptions } from "./rules/ban-instances";
import type { ComplexityConfiguration } from "./rules/enforce-ianitor-check-type";
import type { NoInstanceMethodsOptions } from "./rules/no-instance-methods-without-this";
import type { NoShorthandOptions } from "./rules/no-shorthand-names";
import type { NoUselessUseSpringOptions } from "./rules/no-useless-use-spring";
import type { EffectFunctionOptions, HookConfiguration } from "./rules/require-named-effect-functions";
import type { PairConfiguration, RequirePairedCallsOptions } from "./rules/require-paired-calls";
import type { ReactKeysOptions } from "./rules/require-react-component-keys";
import type { UseExhaustiveDependenciesOptions } from "./rules/use-exhaustive-dependencies";
import type { UseHookAtTopLevelOptions } from "./rules/use-hook-at-top-level";

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
 * Creates a no-shorthand options for no-shorthand-names rule
 * @param options - Partial configuration options
 * @returns The full options
 */
export function createNoShorthandOptions(options: Partial<NoShorthandOptions> = {}): NoShorthandOptions {
	return { allowPropertyAccess: [], shorthands: {}, ...options };
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
		treatEmptyDepsAsViolation: true,
		...options,
	};
}
