import { availableParallelism } from "node:os";
import { argv } from "node:process";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

const tsconfig = tsconfigPaths({
	projects: ["tsconfig.json", "tests/tsconfig.json"],
});

const isFocusedRun = argv.slice(2).some((argument) => argument.endsWith(".test.ts") || argument.startsWith("tests/"));

const cpuCount = availableParallelism();
const workerCount = Math.max(2, Math.min(cpuCount - 1, 12));

/**
 * Type-aware test files rely on typescript-eslint's `projectService`, which is a process-global singleton. With
 * `isolate: false` (used for speed elsewhere), files sharing a worker fork share that service, so heavy type-aware
 * suites (e.g. the naming-convention shards) can starve later files of type information. That makes type inference
 * non-deterministic and only shows up on low-core CI runners where many files pack into each fork. Run these files with
 * `isolate: true` so the module state (and the projectService) is reset per file.
 */
const typeAwareTestGlobs = [
	"tests/upstream/naming-convention.shard-*.test.ts",
	"tests/rules/naming-convention.test.ts",
	"tests/rules/prefer-read-only-properties.test.ts",
	"tests/upstream/prefer-read-only-properties.test.ts",
	"tests/rules/prefer-enum-item.test.ts",
	"tests/rules/no-memo-children.test.ts",
	"tests/rules/no-manual-children-property.test.ts",
	"tests/rules/no-empty-array-literal.test.ts",
	"tests/rules/misleading-lua-tuple-checks.test.ts",
];

const configuration = defineConfig({
	plugins: [tsconfig],
	server: { watch: null },
	test: {
		bail: 1,
		coverage: {
			clean: true,
			cleanOnRerun: false,
			enabled: !isFocusedRun,
			exclude: ["src/**/*.d.ts", "src/oxfmt-worker.ts"],
			include: ["src/**/*.ts"],
			provider: "v8",
			reporter: ["text", "text-summary"],
			reportOnFailure: false,
			thresholds: {
				branches: 80,
				functions: 95,
				lines: 95,
				statements: 85,
			},
		},
		deps: {
			interopDefault: false,
			optimizer: { ssr: { enabled: false } },
		},
		environment: "node",
		exclude: ["**/node_modules/**", "**/dist/**"],
		fileParallelism: true,
		globals: true,
		maxConcurrency: 64,
		maxWorkers: workerCount,
		pool: "forks",
		projects: [
			{
				extends: true,
				test: {
					include: typeAwareTestGlobs,
					isolate: true,
					name: "type-aware",
				},
			},
			{
				extends: true,
				test: {
					exclude: ["**/node_modules/**", "**/dist/**", ...typeAwareTestGlobs],
					include: ["tests/**/*.test.ts"],
					isolate: false,
					name: "unit",
				},
			},
		],
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
