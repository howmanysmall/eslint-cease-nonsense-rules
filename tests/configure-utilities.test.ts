import { describe, expect, it } from "bun:test";
import {
	createComplexityConfiguration,
	createEffectFunctionOptions,
	createHookConfiguration,
	createNoInstanceMethodsOptions,
	createNoUselessUseSpringOptions,
	createNoShorthandOptions,
	createPairConfiguration,
	createReactKeysOptions,
	createRequirePairedCallsOptions,
	createUseExhaustiveDependenciesOptions,
	createUseHookAtTopLevelOptions,
	defaultRobloxProfilePair,
} from "../src/configure-utilities";

describe("configure-utilities", () => {
	describe("createPairConfiguration", () => {
		it("should create a pair configuration with minimal options", () => {
			const configuration = createPairConfiguration("debug.profilebegin", "debug.profileend");
			expect(configuration).toEqual({
				closer: "debug.profileend",
				opener: "debug.profilebegin",
			});
		});

		it("should override defaults with provided options", () => {
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
			const configuration = createComplexityConfiguration({ baseThreshold: 5 });
			expect(configuration.baseThreshold).toBe(5);
			expect(configuration.errorThreshold).toBe(25);
		});
	});

	describe("createNoInstanceMethodsOptions", () => {
		it("should create options with defaults", () => {
			const configuration = createNoInstanceMethodsOptions();
			expect(configuration).toEqual({
				checkPrivate: false,
				checkProtected: false,
				checkPublic: false,
			});
		});

		it("should override defaults", () => {
			const configuration = createNoInstanceMethodsOptions({ checkPublic: true });
			expect(configuration.checkPublic).toBe(true);
		});
	});

	describe("createNoUselessUseSpringOptions", () => {
		it("should create options with defaults", () => {
			const configuration = createNoUselessUseSpringOptions();
			expect(configuration).toEqual({
				springHooks: ["useSpring"],
				treatEmptyDepsAsViolation: true,
			});
		});

		it("should override defaults", () => {
			const configuration = createNoUselessUseSpringOptions({ springHooks: ["useMotion"], treatEmptyDepsAsViolation: false });
			expect(configuration.springHooks).toEqual(["useMotion"]);
			expect(configuration.treatEmptyDepsAsViolation).toBe(false);
		});
	});

	describe("createNoShorthandOptions", () => {
		it("should create options with defaults", () => {
			const configuration = createNoShorthandOptions();
			expect(configuration).toEqual({
				allowPropertyAccess: [],
				shorthands: {},
			});
		});

		it("should override defaults", () => {
			const configuration = createNoShorthandOptions({ shorthands: { plr: "player" } });
			expect(configuration.shorthands).toEqual({ plr: "player" });
		});
	});

	describe("createEffectFunctionOptions", () => {
		it("should create options with defaults", () => {
			const configuration = createEffectFunctionOptions();
			expect(configuration).toEqual({
				environment: "standard",
				hooks: [],
			});
		});

		it("should override defaults", () => {
			const configuration = createEffectFunctionOptions({ environment: "roblox-ts" });
			expect(configuration.environment).toBe("roblox-ts");
		});
	});

	describe("createHookConfiguration", () => {
		it("should create hook configuration with defaults", () => {
			const configuration = createHookConfiguration("useEffect");
			expect(configuration).toEqual({
				allowAsync: false,
				name: "useEffect",
			});
		});

		it("should override defaults", () => {
			const configuration = createHookConfiguration("useCustom", { allowAsync: true });
			expect(configuration.name).toBe("useCustom");
			expect(configuration.allowAsync).toBe(true);
		});
	});

	describe("createRequirePairedCallsOptions", () => {
		it("should create options with defaults", () => {
			const configuration = createRequirePairedCallsOptions();
			expect(configuration).toEqual({
				allowConditionalClosers: false,
				allowMultipleOpeners: true,
				maxNestingDepth: 0,
				pairs: [],
			});
		});

		it("should override defaults", () => {
			const configuration = createRequirePairedCallsOptions({
				maxNestingDepth: 3,
			});
			expect(configuration.maxNestingDepth).toBe(3);
		});
	});

	describe("createReactKeysOptions", () => {
		it("should create options with defaults", () => {
			const configuration = createReactKeysOptions();
			expect(configuration).toEqual({
				allowRootKeys: false,
				ignoreCallExpressions: [],
				iterationMethods: ["map", "forEach", "filter"],
				memoizationHooks: ["useMemo", "useCallback"],
			});
		});

		it("should override defaults", () => {
			const configuration = createReactKeysOptions({ allowRootKeys: true });
			expect(configuration.allowRootKeys).toBe(true);
		});
	});

	describe("createUseExhaustiveDependenciesOptions", () => {
		it("should create options with defaults", () => {
			const configuration = createUseExhaustiveDependenciesOptions();
			expect(configuration).toEqual({
				hooks: [],
				reportMissingDependenciesArray: false,
				reportUnnecessaryDependencies: false,
			});
		});

		it("should override defaults", () => {
			const configuration = createUseExhaustiveDependenciesOptions({ reportMissingDependenciesArray: true });
			expect(configuration.reportMissingDependenciesArray).toBe(true);
		});
	});

	describe("createUseHookAtTopLevelOptions", () => {
		it("should create options with defaults", () => {
			const configuration = createUseHookAtTopLevelOptions();
			expect(configuration).toEqual({
				ignoreHooks: [],
				importSources: {},
				onlyHooks: [],
			});
		});

		it("should override defaults", () => {
			const configuration = createUseHookAtTopLevelOptions({
				ignoreHooks: ["useLegacyHook"],
				importSources: { react: ["useEffect"] },
				onlyHooks: ["useEffect"],
			});
			expect(configuration.ignoreHooks).toEqual(["useLegacyHook"]);
			expect(configuration.importSources).toEqual({ react: ["useEffect"] });
			expect(configuration.onlyHooks).toEqual(["useEffect"]);
		});
	});
});
