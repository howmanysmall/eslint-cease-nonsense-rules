import { resolve } from "node:path";
import { getTsconfig } from "get-tsconfig";
import { defineConfig } from "vitest/config";

const SMALL_RULES = "plugins/oxc/small-rules";
const TESTS = `${SMALL_RULES}/__tests__`;

const tsconfig = getTsconfig(".", "tsconfig.vitest.json");
const paths = tsconfig?.config?.compilerOptions?.paths ?? {};

const alias = Object.entries(paths).map(([shorthand, replacements]) => ({
	find: shorthand.replace("/*", ""),
	replacement: resolve(__dirname, replacements[0]?.replace("/*", "") ?? ""),
}));

const configuration = defineConfig({
	resolve: { alias },
	// oxlint-disable-next-line unicorn/no-null
	server: { watch: null },
	test: {
		bail: 1,
		coverage: {
			enabled: true,
			exclude: [`${SMALL_RULES}/utilities/**`],
			include: [`${SMALL_RULES}/**`],
			provider: "v8",
			reporter: ["text", "text-summary"],
			thresholds: {
				[`${SMALL_RULES}/index.ts`]: {
					branches: 100,
					functions: 100,
					lines: 0,
					statements: 0,
				},
				branches: 75,
				functions: 90,
				lines: 90,
				statements: 75,
			},
		},
		deps: {
			interopDefault: false,
			optimizer: { ssr: { enabled: false } },
		},
		environment: "node",
		globals: true,
		include: [`${TESTS}/**/*.test.{ts,tsx}`],
		isolate: false,
		pool: "forks",
		reporters: ["dot"],
		testTimeout: 1000,
		typecheck: {
			checker: "tsgo",
			enabled: false,
			include: [`${TESTS}/**/*.test-d.{ts,tsx}`],
			tsconfig: "./tsconfig.vitest.json",
		},
	},
});

export default configuration;
