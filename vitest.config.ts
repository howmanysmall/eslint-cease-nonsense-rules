import { argv } from "node:process";
import { defineConfig } from "vitest/config";

const isFocusedRun = argv.slice(2).some((argument) => argument.endsWith(".test.ts") || argument.startsWith("tests/"));

const configuration = defineConfig({
	// oxlint-disable-next-line unicorn/no-null
	server: { watch: null },
	test: {
		bail: 1,
		coverage: {
			enabled: !isFocusedRun,
			exclude: ["src/**/*.d.ts"],
			include: ["src/**/*.ts"],
			provider: "v8",
			reporter: ["text", "text-summary"],
			thresholds: {
				branches: 90,
				functions: 90,
				lines: 90,
				statements: 90,
			},
		},
		deps: {
			interopDefault: false,
			optimizer: { ssr: { enabled: false } },
		},
		environment: "node",
		exclude: ["**/node_modules/**", "**/dist/**"],
		globals: true,
		include: ["tests/**/*.test.ts"],
		isolate: false,
		pool: "forks",
		reporters: ["dot"],
		testTimeout: 30_000,
		typecheck: {
			checker: "tsgo",
			enabled: false,
			include: ["tests/**/*.test-d.ts"],
			tsconfig: "./tests/tsconfig.json",
		},
	},
});

export default configuration;
