import type { KnipConfig } from "knip";

const config: KnipConfig = {
	biome: true,
	bumpp: true,
	bun: true,
	commitlint: true,
	entry: ["scripts/*.ts", "benchmarks/**/*.bench.ts", ".opencode/**/*.ts", "tests/**/*.ts"],
	eslint: true,
	ignore: ["scripts/plugins/**/*.ts"],
	ignoreBinaries: ["rumdl", "tombi"],
	ignoreDependencies: ["source-map", "@mitata/counters", "oxfmt", "@rbxts/types", "better-result"],
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
