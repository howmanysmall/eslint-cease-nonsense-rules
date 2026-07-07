import type { KnipConfig } from "knip";

const config: KnipConfig = {
	biome: true,
	bumpp: true,
	commitlint: true,
	entry: ["scripts/*.ts", "benchmarks/**/*.bench.ts", ".opencode/**/*.ts", "tests/**/*.ts"],
	eslint: true,
	ignore: ["tests/fixtures/**"],
	ignoreBinaries: ["hk", "notify-send", "osascript", "powershell"],
	ignoreDependencies: [
		"@astrojs/ts-plugin",
		"@mitata/counters",
		"@rbxts/react",
		"@rbxts/types",
		"eslint-plugin-cease-nonsense",
		"skills",
		"source-map",
	],
	oxlint: true,
	pnpm: true,
	project: ["src/**/*.ts", "scripts/**/*.ts", "tests/**/*.ts"],
	rules: {
		binaries: "error",
		catalog: "error",
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
