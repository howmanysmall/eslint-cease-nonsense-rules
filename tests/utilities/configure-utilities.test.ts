import { describe, expect, it } from "bun:test";
import { DEFAULT_STATIC_GLOBAL_FACTORIES } from "../../src/rules/no-useless-use-spring";
import {
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
} from "../../src/utilities/configure-utilities";

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
});
