import { describe, expect, it } from "bun:test";
import { DEFAULT_STATIC_GLOBAL_FACTORIES } from "../../src/rules/no-useless-use-spring";
import {
	createBanInstancesOptions,
	createComplexityConfiguration,
	createEffectFunctionOptions,
	createHookConfiguration,
	createNamingConventionOptions,
	createNoConstantConditionWithBreakOptions,
	createNoEventsInEventsCallbackOptions,
	createNoGodComponentsOptions,
	createNoInstanceMethodsOptions,
	createNoMemoChildrenOptions,
	createNoNewInstanceInUseMemoOptions,
	createNoShorthandOptions,
	createNoUnusedImportsOptions,
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
	createUseExhaustiveDependenciesOptions,
	createUseHookAtTopLevelOptions,
	defaultRobloxProfilePair,
} from "../../src/utilities/configure-utilities";
import { pattern } from "../../src/utilities/pattern-replacement";

const TEST_IGNORE_REGEX = /^_/;

describe("configure-utilities", () => {
	describe("createBanInstancesOptions", () => {
		it("should create options with defaults", () => {
			expect.assertions(1);
			const configuration = createBanInstancesOptions();
			expect(configuration).toEqual({ bannedInstances: [] });
		});

		it("should override defaults", () => {
			expect.assertions(1);
			const configuration = createBanInstancesOptions({ bannedInstances: ["Part"] });
			expect(configuration).toEqual({ bannedInstances: ["Part"] });
		});
	});

	describe("createPairConfiguration", () => {
		it("should create a pair configuration with minimal options", () => {
			expect.assertions(1);
			const configuration = createPairConfiguration("debug.profilebegin", "debug.profileend");
			expect(configuration).toEqual({
				closer: "debug.profileend",
				opener: "debug.profilebegin",
			});
		});

		it("should override defaults with provided options", () => {
			expect.assertions(4);
			const configuration = createPairConfiguration("start", ["end1", "end2"], {
				platform: "roblox",
				requireSync: true,
			});
			expect(configuration.opener).toBe("start");
			expect(configuration.closer).toEqual(["end1", "end2"]);
			expect(configuration.platform).toBe("roblox");
			expect(configuration.requireSync).toBe(true);
		});
	});

	describe("defaultRobloxProfilePair", () => {
		it("should have correct default values", () => {
			expect.assertions(1);
			expect(defaultRobloxProfilePair).toEqual({
				closer: "debug.profileend",
				opener: "debug.profilebegin",
				platform: "roblox",
				requireSync: true,
				yieldingFunctions: ["task.wait", "wait", "*.WaitForChild"],
			});
		});
	});

	describe("createComplexityConfiguration", () => {
		it("should create complexity configuration with defaults", () => {
			expect.assertions(1);
			const configuration = createComplexityConfiguration();
			expect(configuration).toEqual({
				baseThreshold: 10,
				errorThreshold: 25,
				interfacePenalty: 20,
				performanceMode: true,
				warnThreshold: 15,
			});
		});

		it("should override defaults", () => {
			expect.assertions(2);
			const configuration = createComplexityConfiguration({ baseThreshold: 5 });
			expect(configuration.baseThreshold).toBe(5);
			expect(configuration.errorThreshold).toBe(25);
		});
	});

	describe("createNoInstanceMethodsOptions", () => {
		it("should create options with defaults", () => {
			expect.assertions(1);
			const configuration = createNoInstanceMethodsOptions();
			expect(configuration).toEqual({
				checkPrivate: false,
				checkProtected: false,
				checkPublic: false,
			});
		});

		it("should override defaults", () => {
			expect.assertions(1);
			const configuration = createNoInstanceMethodsOptions({ checkPublic: true });
			expect(configuration.checkPublic).toBe(true);
		});
	});

	describe("createNoMemoChildrenOptions", () => {
		it("should create options with defaults", () => {
			expect.assertions(1);
			const configuration = createNoMemoChildrenOptions();
			expect(configuration).toEqual({
				allowedComponents: [],
				environment: "roblox-ts",
			});
		});

		it("should override defaults", () => {
			expect.assertions(2);
			const configuration = createNoMemoChildrenOptions({
				allowedComponents: ["Modal"],
				environment: "standard",
			});
			expect(configuration.allowedComponents).toEqual(["Modal"]);
			expect(configuration.environment).toBe("standard");
		});
	});

	describe("createNoUselessUseSpringOptions", () => {
		it("should create options with defaults", () => {
			expect.assertions(1);
			const configuration = createNoUselessUseSpringOptions();
			expect(configuration).toEqual({
				springHooks: ["useSpring"],
				staticGlobalFactories: DEFAULT_STATIC_GLOBAL_FACTORIES,
				treatEmptyDepsAsViolation: true,
			});
		});

		it("should override defaults", () => {
			expect.assertions(3);
			const configuration = createNoUselessUseSpringOptions({
				springHooks: ["useMotion"],
				staticGlobalFactories: ["CustomFactory"],
				treatEmptyDepsAsViolation: false,
			});
			expect(configuration.springHooks).toEqual(["useMotion"]);
			expect(configuration.staticGlobalFactories).toEqual(["CustomFactory"]);
			expect(configuration.treatEmptyDepsAsViolation).toBe(false);
		});
	});

	describe("createNoShorthandOptions", () => {
		it("should create options with defaults", () => {
			expect.assertions(1);
			const configuration = createNoShorthandOptions();
			expect(configuration).toEqual({
				allowPropertyAccess: [],
				ignoreShorthands: [],
				shorthands: {},
			});
		});

		it("should override defaults", () => {
			expect.assertions(1);
			const configuration = createNoShorthandOptions({ shorthands: { plr: "player" } });
			expect(configuration.shorthands).toEqual({ plr: "player" });
		});

		it("should accept ignoreShorthands", () => {
			expect.assertions(1);
			const configuration = createNoShorthandOptions({ ignoreShorthands: ["Props", "*Ref"] });
			expect(configuration.ignoreShorthands).toEqual(["Props", "*Ref"]);
		});
	});

	describe("createEffectFunctionOptions", () => {
		it("should create options with defaults", () => {
			expect.assertions(1);
			const configuration = createEffectFunctionOptions();
			expect(configuration).toEqual({
				environment: "standard",
				hooks: [],
			});
		});

		it("should override defaults", () => {
			expect.assertions(1);
			const configuration = createEffectFunctionOptions({ environment: "roblox-ts" });
			expect(configuration.environment).toBe("roblox-ts");
		});
	});

	describe("createHookConfiguration", () => {
		it("should create hook configuration with defaults", () => {
			expect.assertions(1);
			const configuration = createHookConfiguration("useEffect");
			expect(configuration).toEqual({
				allowAsync: false,
				name: "useEffect",
			});
		});

		it("should override defaults", () => {
			expect.assertions(2);
			const configuration = createHookConfiguration("useCustom", { allowAsync: true });
			expect(configuration.name).toBe("useCustom");
			expect(configuration.allowAsync).toBe(true);
		});
	});

	describe("createRequirePairedCallsOptions", () => {
		it("should create options with defaults", () => {
			expect.assertions(1);
			const configuration = createRequirePairedCallsOptions();
			expect(configuration).toEqual({
				allowConditionalClosers: false,
				allowMultipleOpeners: true,
				maxNestingDepth: 0,
				pairs: [],
			});
		});

		it("should override defaults", () => {
			expect.assertions(1);
			const configuration = createRequirePairedCallsOptions({
				maxNestingDepth: 3,
			});
			expect(configuration.maxNestingDepth).toBe(3);
		});
	});

	describe("createReactKeysOptions", () => {
		it("should create options with defaults", () => {
			expect.assertions(1);
			const configuration = createReactKeysOptions();
			expect(configuration).toEqual({
				allowRootKeys: false,
				ignoreCallExpressions: [],
				iterationMethods: ["map", "forEach", "filter"],
				memoizationHooks: ["useMemo", "useCallback"],
			});
		});

		it("should override defaults", () => {
			expect.assertions(1);
			const configuration = createReactKeysOptions({ allowRootKeys: true });
			expect(configuration.allowRootKeys).toBe(true);
		});
	});

	describe("createNoGodComponentsOptions", () => {
		it("should create options with defaults", () => {
			expect.assertions(1);
			const configuration = createNoGodComponentsOptions();
			expect(configuration).toEqual({
				enforceTargetLines: true,
				ignoreComponents: [],
				maxDestructuredProps: 5,
				maxLines: 200,
				maxStateHooks: 5,
				maxTsxNesting: 3,
				stateHooks: ["useState", "useReducer", "useBinding"],
				targetLines: 120,
			});
		});

		it("should override defaults", () => {
			expect.assertions(3);
			const configuration = createNoGodComponentsOptions({ ignoreComponents: ["Big"], maxLines: 300 });
			expect(configuration.maxLines).toBe(300);
			expect(configuration.ignoreComponents).toEqual(["Big"]);
			expect(configuration.targetLines).toBe(120);
		});
	});

	describe("createUseExhaustiveDependenciesOptions", () => {
		it("should create options with defaults", () => {
			expect.assertions(1);
			const configuration = createUseExhaustiveDependenciesOptions();
			expect(configuration).toEqual({
				hooks: [],
				reportMissingDependenciesArray: false,
				reportUnnecessaryDependencies: false,
			});
		});

		it("should override defaults", () => {
			expect.assertions(1);
			const configuration = createUseExhaustiveDependenciesOptions({ reportMissingDependenciesArray: true });
			expect(configuration.reportMissingDependenciesArray).toBe(true);
		});
	});

	describe("createUseHookAtTopLevelOptions", () => {
		it("should create options with defaults", () => {
			expect.assertions(1);
			const configuration = createUseHookAtTopLevelOptions();
			expect(configuration).toEqual({
				ignoreHooks: [],
				importSources: {},
				onlyHooks: [],
			});
		});

		it("should override defaults", () => {
			expect.assertions(3);
			const configuration = createUseHookAtTopLevelOptions({
				ignoreHooks: ["useLegacyHook"],
				// @ts-expect-error Testing purposes
				importSources: { react: ["useEffect"] },
				onlyHooks: ["useEffect"],
			});
			expect(configuration.ignoreHooks).toEqual(["useLegacyHook"]);
			// @ts-expect-error Testing purposes
			expect(configuration.importSources).toEqual({ react: ["useEffect"] });
			expect(configuration.onlyHooks).toEqual(["useEffect"]);
		});
	});

	describe("createPreferEnumItemOptions", () => {
		it("should create options with defaults", () => {
			expect.assertions(1);
			const configuration = createPreferEnumItemOptions();
			expect(configuration).toEqual({ fixNumericToValue: false, performanceMode: false });
		});

		it("should override defaults", () => {
			expect.assertions(1);
			const configuration = createPreferEnumItemOptions({ fixNumericToValue: true });
			expect(configuration.fixNumericToValue).toBe(true);
		});
	});

	describe("createPreferPatternReplacementsOptions", () => {
		it("should create options with empty patterns by default", () => {
			expect.assertions(1);
			const configuration = createPreferPatternReplacementsOptions();
			expect(configuration).toEqual({ patterns: [] });
		});

		it("should accept an array of patterns", () => {
			expect.assertions(2);
			const patterns = [
				pattern({ match: "UDim2.fromScale(1, 1)", replacement: "oneScale" }),
				pattern({ match: "new Vector2($x, $x)", replacement: "fromUniform($x)" }),
			];
			const configuration = createPreferPatternReplacementsOptions(patterns);
			expect(configuration.patterns).toHaveLength(2);
			expect(configuration.patterns[0]?.match).toBe("UDim2.fromScale(1, 1)");
		});
	});

	describe("createRequireReactDisplayNamesOptions", () => {
		it("should create options with defaults", () => {
			expect.assertions(1);
			const configuration = createRequireReactDisplayNamesOptions();
			expect(configuration).toEqual({ environment: "roblox-ts" });
		});

		it("should override defaults", () => {
			expect.assertions(1);
			const configuration = createRequireReactDisplayNamesOptions({ environment: "standard" });
			expect(configuration.environment).toBe("standard");
		});
	});

	describe("createRequireModuleLevelInstantiationOptions", () => {
		it("should create options with defaults", () => {
			expect.assertions(1);
			const configuration = createRequireModuleLevelInstantiationOptions();
			expect(configuration).toEqual({ classes: {} });
		});

		it("should override defaults", () => {
			expect.assertions(2);
			const configuration = createRequireModuleLevelInstantiationOptions({
				classes: {
					Log: "@rbxts/rbxts-sleitnick-log",
					Server: "@rbxts/net",
				},
			});
			expect(configuration.classes).toEqual({
				Log: "@rbxts/rbxts-sleitnick-log",
				Server: "@rbxts/net",
			});
			expect(Object.keys(configuration.classes)).toHaveLength(2);
		});
	});

	describe("createNamingConventionOptions", () => {
		it("should create options with defaults", () => {
			expect.assertions(1);
			const configuration = createNamingConventionOptions();
			expect(configuration).toEqual({
				format: ["PascalCase"],
				selector: "interface",
			});
		});

		it("should override format", () => {
			expect.assertions(1);
			const configuration = createNamingConventionOptions({ format: ["camelCase", "PascalCase"] });
			expect(configuration.format).toEqual(["camelCase", "PascalCase"]);
		});

		it("should override selector", () => {
			expect.assertions(1);
			const configuration = createNamingConventionOptions({ selector: "typeAlias" });
			expect(configuration.selector).toBe("typeAlias");
		});

		it("should override custom", () => {
			expect.assertions(1);
			const configuration = createNamingConventionOptions({
				custom: { match: true, regex: "^[A-Z]" },
			});
			expect(configuration.custom).toEqual({ match: true, regex: "^[A-Z]" });
		});

		it("should override multiple fields", () => {
			expect.assertions(3);
			const configuration = createNamingConventionOptions({
				// @ts-expect-error Testing purposes
				custom: { match: false },
				format: ["camelCase"],
				selector: "class",
			});
			expect(configuration.format).toEqual(["camelCase"]);
			expect(configuration.selector).toBe("class");
			// @ts-expect-error Testing purposes
			expect(configuration.custom).toEqual({ match: false });
		});
	});

	describe("createNoUnusedImportsOptions", () => {
		it("should create options with defaults", () => {
			expect.assertions(1);
			const configuration = createNoUnusedImportsOptions();
			expect(configuration).toEqual({ checkJSDoc: true });
		});

		it("should override defaults", () => {
			expect.assertions(1);
			const configuration = createNoUnusedImportsOptions({ checkJSDoc: false });
			expect(configuration.checkJSDoc).toBe(false);
		});

		it("should merge partial overrides", () => {
			expect.assertions(1);
			const configuration = createNoUnusedImportsOptions({ checkJSDoc: false });
			expect(configuration).toEqual({ checkJSDoc: false });
		});
	});

	describe("createNoEventsInEventsCallbackOptions", () => {
		it("should create options with defaults", () => {
			expect.assertions(1);
			const configuration = createNoEventsInEventsCallbackOptions();
			expect(configuration).toEqual({ eventsImportPaths: [] });
		});

		it("should override defaults", () => {
			expect.assertions(1);
			const configuration = createNoEventsInEventsCallbackOptions({
				eventsImportPaths: ["server/networking", "client/networking"],
			});
			expect(configuration.eventsImportPaths).toEqual(["server/networking", "client/networking"]);
		});
	});

	describe("createNoConstantConditionWithBreakOptions", () => {
		it("should create options with defaults", () => {
			expect.assertions(1);
			const configuration = createNoConstantConditionWithBreakOptions();
			expect(configuration).toEqual({ loopExitCalls: [] });
		});

		it("should override defaults", () => {
			expect.assertions(1);
			const configuration = createNoConstantConditionWithBreakOptions({
				loopExitCalls: ["coroutine.yield", "task.wait"],
			});
			expect(configuration.loopExitCalls).toEqual(["coroutine.yield", "task.wait"]);
		});
	});

	describe("createNoNewInstanceInUseMemoOptions", () => {
		it("should create options with defaults", () => {
			expect.assertions(1);
			const configuration = createNoNewInstanceInUseMemoOptions();
			expect(configuration).toEqual({
				constructors: ["Instance"],
				environment: "roblox-ts",
				maxHelperTraceDepth: 4,
			});
		});

		it("should override constructors", () => {
			expect.assertions(1);
			const configuration = createNoNewInstanceInUseMemoOptions({ constructors: ["Vector3"] });
			expect(configuration.constructors).toEqual(["Vector3"]);
		});

		it("should override environment", () => {
			expect.assertions(1);
			const configuration = createNoNewInstanceInUseMemoOptions({ environment: "standard" });
			expect(configuration.environment).toBe("standard");
		});

		it("should override maxHelperTraceDepth", () => {
			expect.assertions(1);
			const configuration = createNoNewInstanceInUseMemoOptions({ maxHelperTraceDepth: 1 });
			expect(configuration.maxHelperTraceDepth).toBe(1);
		});
	});

	describe("createNoUselessUseEffectOptions", () => {
		it("should create options with defaults", () => {
			expect.assertions(1);
			const configuration = createNoUselessUseEffectOptions();
			expect(configuration).toEqual({
				environment: "roblox-ts",
				hooks: ["useEffect", "useLayoutEffect", "useInsertionEffect"],
				propertyCallbackPrefixes: ["on"],
				reportDerivedState: true,
				reportEventFlag: true,
				reportNotifyParent: true,
			});
		});

		it("should override defaults", () => {
			expect.assertions(4);
			const configuration = createNoUselessUseEffectOptions({
				environment: "standard",
				hooks: ["useEffect"],
				propertyCallbackPrefixes: ["handle"],
				reportNotifyParent: false,
			});
			expect(configuration.environment).toBe("standard");
			expect(configuration.hooks).toEqual(["useEffect"]);
			expect(configuration.propertyCallbackPrefixes).toEqual(["handle"]);
			expect(configuration.reportNotifyParent).toBe(false);
		});
	});

	describe("createPreventAbbreviationsOptions", () => {
		it("should create options with defaults", () => {
			expect.assertions(1);
			const configuration = createPreventAbbreviationsOptions();
			expect(configuration).toEqual({
				allowList: {},
				checkFilenames: true,
				checkProperties: false,
				checkVariables: true,
				ignore: [],
				replacements: {},
			});
		});

		it("should override allowList", () => {
			expect.assertions(1);
			const configuration = createPreventAbbreviationsOptions({ allowList: { err: true } });
			expect(configuration.allowList).toEqual({ err: true });
		});

		it("should override checkFilenames", () => {
			expect.assertions(1);
			const configuration = createPreventAbbreviationsOptions({ checkFilenames: false });
			expect(configuration.checkFilenames).toBe(false);
		});

		it("should override checkProperties", () => {
			expect.assertions(1);
			const configuration = createPreventAbbreviationsOptions({ checkProperties: true });
			expect(configuration.checkProperties).toBe(true);
		});

		it("should override checkVariables", () => {
			expect.assertions(1);
			const configuration = createPreventAbbreviationsOptions({ checkVariables: false });
			expect(configuration.checkVariables).toBe(false);
		});

		it("should override ignore", () => {
			expect.assertions(1);
			const configuration = createPreventAbbreviationsOptions({ ignore: ["test", TEST_IGNORE_REGEX] });
			expect(configuration.ignore).toEqual(["test", TEST_IGNORE_REGEX]);
		});

		it("should override replacements", () => {
			expect.assertions(1);
			const configuration = createPreventAbbreviationsOptions({
				replacements: { err: { error: true } },
			});
			expect(configuration.replacements).toEqual({ err: { error: true } });
		});

		it("should override multiple fields together", () => {
			expect.assertions(4);
			const configuration = createPreventAbbreviationsOptions({
				allowList: { fn: true },
				checkFilenames: false,
				checkProperties: true,
				ignore: ["test"],
			});
			expect(configuration.allowList).toEqual({ fn: true });
			expect(configuration.checkFilenames).toBe(false);
			expect(configuration.checkProperties).toBe(true);
			expect(configuration.ignore).toEqual(["test"]);
		});
	});
});
