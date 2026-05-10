import { describe, expect, it, vi } from "vitest";
import { DEFAULT_STATIC_GLOBAL_FACTORIES } from "@rules/no-useless-use-spring";
import {
	createBanInstancesOptions,
	createComplexityConfiguration,
	createEffectFunctionOptions,
	createHookConfiguration,
	createNamingConventionOptions,
	createNoArrayConstructorElementsOptions,
	createNoConstantConditionWithBreakOptions,
	createNoEmptyArrayLiteralOptions,
	createNoEventsInEventsCallbackOptions,
	createNoGodComponentsOptions,
	createNoInstanceMethodsOptions,
	createNoMemoChildrenOptions,
	createNoNewInstanceInUseMemoOptions,
	createNoShorthandOptions,
	createNoUnusedImportsOptions,
	createNoUselessUseEffectOptions,
	createNoUselessUseMemoOptions,
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
} from "@utilities/configure-utilities";
import { pattern } from "@utilities/pattern-replacement";

const TEST_IGNORE_REGEX = /^_/u;

vi.setConfig({ testTimeout: 10000 });

describe("configure-utilities", () => {
	describe("createBanInstancesOptions", () => {
		it("should create options with defaults", () => {
			expect.assertions(1);
			const configuration = createBanInstancesOptions();
			expect(configuration).toStrictEqual({ bannedInstances: [] });
		});

		it("should override defaults", () => {
			expect.assertions(1);
			const configuration = createBanInstancesOptions({ bannedInstances: ["Part"] });
			expect(configuration).toStrictEqual({ bannedInstances: ["Part"] });
		});
	});

	describe("createPairConfiguration", () => {
		it("should create a pair configuration with minimal options", () => {
			expect.assertions(1);
			const configuration = createPairConfiguration("debug.profilebegin", "debug.profileend");
			expect(configuration).toStrictEqual({
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
			expect(configuration.closer).toStrictEqual(["end1", "end2"]);
			expect(configuration.platform).toBe("roblox");
			expect(configuration.requireSync).toBe(true);
		});
	});

	describe("defaultRobloxProfilePair", () => {
		it("should have correct default values", () => {
			expect.assertions(1);
			expect(defaultRobloxProfilePair).toStrictEqual({
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
			expect(configuration).toStrictEqual({
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
			expect(configuration).toStrictEqual({
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
			expect(configuration).toStrictEqual({
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
			expect(configuration.allowedComponents).toStrictEqual(["Modal"]);
			expect(configuration.environment).toBe("standard");
		});
	});

	describe("createNoUselessUseSpringOptions", () => {
		it("should create options with defaults", () => {
			expect.assertions(1);
			const configuration = createNoUselessUseSpringOptions();
			expect(configuration).toStrictEqual({
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
			expect(configuration.springHooks).toStrictEqual(["useMotion"]);
			expect(configuration.staticGlobalFactories).toStrictEqual(["CustomFactory"]);
			expect(configuration.treatEmptyDepsAsViolation).toBe(false);
		});
	});

	describe("createNoShorthandOptions", () => {
		it("should create options with defaults", () => {
			expect.assertions(1);
			const configuration = createNoShorthandOptions();
			expect(configuration).toStrictEqual({
				allowPropertyAccess: [],
				ignoreShorthands: [],
				shorthands: {},
			});
		});

		it("should override defaults", () => {
			expect.assertions(1);
			const configuration = createNoShorthandOptions({ shorthands: { plr: "player" } });
			expect(configuration.shorthands).toStrictEqual({ plr: "player" });
		});

		it("should accept ignoreShorthands", () => {
			expect.assertions(1);
			const configuration = createNoShorthandOptions({ ignoreShorthands: ["Props", "*Ref"] });
			expect(configuration.ignoreShorthands).toStrictEqual(["Props", "*Ref"]);
		});
	});

	describe("createEffectFunctionOptions", () => {
		it("should create options with defaults", () => {
			expect.assertions(1);
			const configuration = createEffectFunctionOptions();
			expect(configuration).toStrictEqual({
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
			expect(configuration).toStrictEqual({
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
			expect(configuration).toStrictEqual({
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
			expect(configuration).toStrictEqual({
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
			expect(configuration).toStrictEqual({
				enforceTargetLines: true,
				ignoreComponents: [],
				maxDestructuredProperties: 5,
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
			expect(configuration.ignoreComponents).toStrictEqual(["Big"]);
			expect(configuration.targetLines).toBe(120);
		});
	});

	describe("createUseExhaustiveDependenciesOptions", () => {
		it("should create options with defaults", () => {
			expect.assertions(1);
			const configuration = createUseExhaustiveDependenciesOptions();
			expect(configuration).toStrictEqual({
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
			expect(configuration).toStrictEqual({
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
			expect(configuration.ignoreHooks).toStrictEqual(["useLegacyHook"]);
			expect(configuration.importSources).toStrictEqual({ react: ["useEffect"] });
			expect(configuration.onlyHooks).toStrictEqual(["useEffect"]);
		});
	});

	describe("createPreferEnumItemOptions", () => {
		it("should create options with defaults", () => {
			expect.assertions(1);
			const configuration = createPreferEnumItemOptions();
			expect(configuration).toStrictEqual({ fixNumericToValue: false, performanceMode: false });
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
			expect(configuration).toStrictEqual({ patterns: [] });
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
			expect(configuration).toStrictEqual({ environment: "roblox-ts" });
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
			expect(configuration).toStrictEqual({ classes: {} });
		});

		it("should override defaults", () => {
			expect.assertions(2);
			const configuration = createRequireModuleLevelInstantiationOptions({
				classes: {
					Log: "@rbxts/rbxts-sleitnick-log",
					Server: "@rbxts/net",
				},
			});
			expect(configuration.classes).toStrictEqual({
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
			expect(configuration).toStrictEqual({
				format: ["PascalCase"],
				selector: "interface",
			});
		});

		it("should override format", () => {
			expect.assertions(1);
			const configuration = createNamingConventionOptions({ format: ["camelCase", "PascalCase"] });
			expect(configuration.format).toStrictEqual(["camelCase", "PascalCase"]);
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
			expect(configuration.custom).toStrictEqual({ match: true, regex: "^[A-Z]" });
		});

		it("should override multiple fields", () => {
			expect.assertions(3);
			const configuration = createNamingConventionOptions({
				// @ts-expect-error Testing purposes
				custom: { match: false },
				format: ["camelCase"],
				selector: "class",
			});
			expect(configuration.format).toStrictEqual(["camelCase"]);
			expect(configuration.selector).toBe("class");
			expect(configuration.custom).toStrictEqual({ match: false });
		});
	});

	describe("createNoUnusedImportsOptions", () => {
		it("should create options with defaults", () => {
			expect.assertions(1);
			const configuration = createNoUnusedImportsOptions();
			expect(configuration).toStrictEqual({ checkJSDoc: true });
		});

		it("should override defaults", () => {
			expect.assertions(1);
			const configuration = createNoUnusedImportsOptions({ checkJSDoc: false });
			expect(configuration.checkJSDoc).toBe(false);
		});

		it("should merge partial overrides", () => {
			expect.assertions(1);
			const configuration = createNoUnusedImportsOptions({ checkJSDoc: false });
			expect(configuration).toStrictEqual({ checkJSDoc: false });
		});
	});

	describe("createNoEventsInEventsCallbackOptions", () => {
		it("should create options with defaults", () => {
			expect.assertions(1);
			const configuration = createNoEventsInEventsCallbackOptions();
			expect(configuration).toStrictEqual({ eventsImportPaths: [] });
		});

		it("should override defaults", () => {
			expect.assertions(1);
			const configuration = createNoEventsInEventsCallbackOptions({
				eventsImportPaths: ["server/networking", "client/networking"],
			});
			expect(configuration.eventsImportPaths).toStrictEqual(["server/networking", "client/networking"]);
		});
	});

	describe("createNoConstantConditionWithBreakOptions", () => {
		it("should create options with defaults", () => {
			expect.assertions(1);
			const configuration = createNoConstantConditionWithBreakOptions();
			expect(configuration).toStrictEqual({ loopExitCalls: [] });
		});

		it("should override defaults", () => {
			expect.assertions(1);
			const configuration = createNoConstantConditionWithBreakOptions({
				loopExitCalls: ["coroutine.yield", "task.wait"],
			});
			expect(configuration.loopExitCalls).toStrictEqual(["coroutine.yield", "task.wait"]);
		});
	});

	describe("createNoEmptyArrayLiteralOptions", () => {
		it("should create options with defaults", () => {
			expect.assertions(1);
			const configuration = createNoEmptyArrayLiteralOptions();
			expect(configuration).toStrictEqual({
				allowedEmptyArrayContexts: {
					arrowFunctionBody: true,
					assignmentExpressions: true,
					assignmentPatterns: true,
					callArguments: true,
					conditionalExpressions: true,
					forOfStatements: true,
					jsxAttributes: true,
					logicalExpressions: true,
					propertyValues: true,
					returnStatements: true,
					typeAssertions: true,
				},
				ignoreInferredNonEmptyLiterals: true,
				inferTypeForEmptyArrayFix: false,
				requireExplicitGenericOnNewArray: true,
			});
		});

		it("should override defaults", () => {
			expect.assertions(4);
			const configuration = createNoEmptyArrayLiteralOptions({
				allowedEmptyArrayContexts: {
					callArguments: false,
				},
				ignoreInferredNonEmptyLiterals: false,
				inferTypeForEmptyArrayFix: true,
				requireExplicitGenericOnNewArray: false,
			});
			expect(configuration.ignoreInferredNonEmptyLiterals).toBe(false);
			expect(configuration.inferTypeForEmptyArrayFix).toBe(true);
			expect(configuration.requireExplicitGenericOnNewArray).toBe(false);
			expect(configuration.allowedEmptyArrayContexts).toStrictEqual({
				arrowFunctionBody: true,
				assignmentExpressions: true,
				assignmentPatterns: true,
				callArguments: false,
				conditionalExpressions: true,
				forOfStatements: true,
				jsxAttributes: true,
				logicalExpressions: true,
				propertyValues: true,
				returnStatements: true,
				typeAssertions: true,
			});
		});
	});

	describe("createNoArrayConstructorElementsOptions", () => {
		it("should create options with defaults", () => {
			expect.assertions(1);
			const configuration = createNoArrayConstructorElementsOptions();
			expect(configuration).toStrictEqual({
				environment: "roblox-ts",
				requireExplicitGenericOnNewArray: true,
			});
		});

		it("should override defaults", () => {
			expect.assertions(2);
			const configuration = createNoArrayConstructorElementsOptions({
				environment: "standard",
				requireExplicitGenericOnNewArray: false,
			});
			expect(configuration.environment).toBe("standard");
			expect(configuration.requireExplicitGenericOnNewArray).toBe(false);
		});
	});

	describe("createNoNewInstanceInUseMemoOptions", () => {
		it("should create options with defaults", () => {
			expect.assertions(1);
			const configuration = createNoNewInstanceInUseMemoOptions();
			expect(configuration).toStrictEqual({
				constructors: ["Instance"],
				environment: "roblox-ts",
				maxHelperTraceDepth: 4,
			});
		});

		it("should override constructors", () => {
			expect.assertions(1);
			const configuration = createNoNewInstanceInUseMemoOptions({ constructors: ["Vector3"] });
			expect(configuration.constructors).toStrictEqual(["Vector3"]);
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
			expect(configuration).toStrictEqual({
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
			expect(configuration.hooks).toStrictEqual(["useEffect"]);
			expect(configuration.propertyCallbackPrefixes).toStrictEqual(["handle"]);
			expect(configuration.reportNotifyParent).toBe(false);
		});
	});

	describe("createNoUselessUseMemoOptions", () => {
		it("should create options with defaults", () => {
			expect.assertions(1);
			const configuration = createNoUselessUseMemoOptions();
			expect(configuration).toStrictEqual({
				dependencyMode: "non-updating",
				environment: "roblox-ts",
				staticGlobalFactories: DEFAULT_STATIC_GLOBAL_FACTORIES,
			});
		});

		it("should override defaults", () => {
			expect.assertions(3);
			const configuration = createNoUselessUseMemoOptions({
				dependencyMode: "aggressive",
				environment: "standard",
				staticGlobalFactories: ["Foo"],
			});
			expect(configuration.dependencyMode).toBe("aggressive");
			expect(configuration.environment).toBe("standard");
			expect(configuration.staticGlobalFactories).toStrictEqual(["Foo"]);
		});
	});

	describe("createPreventAbbreviationsOptions", () => {
		it("should create options with defaults", () => {
			expect.assertions(1);
			const configuration = createPreventAbbreviationsOptions();
			expect(configuration).toStrictEqual({
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
			expect(configuration.allowList).toStrictEqual({ err: true });
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
			expect(configuration.ignore).toStrictEqual(["test", TEST_IGNORE_REGEX]);
		});

		it("should override replacements", () => {
			expect.assertions(1);
			const configuration = createPreventAbbreviationsOptions({
				replacements: { err: { error: true } },
			});
			expect(configuration.replacements).toStrictEqual({ err: { error: true } });
		});

		it("should override multiple fields together", () => {
			expect.assertions(4);
			const configuration = createPreventAbbreviationsOptions({
				allowList: { fn: true },
				checkFilenames: false,
				checkProperties: true,
				ignore: ["test"],
			});
			expect(configuration.allowList).toStrictEqual({ fn: true });
			expect(configuration.checkFilenames).toBe(false);
			expect(configuration.checkProperties).toBe(true);
			expect(configuration.ignore).toStrictEqual(["test"]);
		});
	});
});
