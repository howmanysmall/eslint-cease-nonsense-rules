import type { KnipConfig } from "knip";

const config: KnipConfig = {
	biome: true,
	bumpp: true,
	bun: true,
	entry: ["scripts/*.ts", "benchmarks/**/*.bench.ts", ".opencode/**/*.ts", "tests/**/*.ts"],
	eslint: true,
	ignore: ["dist/**", "src/types/reset.d.ts", "scripts/plugins/**/*.ts"],
	ignoreDependencies: ["source-map", "lint-staged", "@mitata/counters", "oxfmt"],
	"lint-staged": true,
	oxlint: true,
	project: ["src/**/*.ts", "scripts/**/*.ts", "tests/**/*.ts"],
	rules: {
		binaries: "error",
		catalog: "error",
		classMembers: "error",
		dependencies: "error",
		devDependencies: "error",
		duplicates: "error",
		enumMembers: "error",
		exports: "error",
		files: "error",
		nsExports: "error",
		nsTypes: "error",
		optionalPeerDependencies: "error",
		types: "error",
		unlisted: "error",
		unresolved: "error",
	},
	typescript: {
		config: ["tsconfig.json", "tsconfig.base.json"],
	},
};

export default config;
