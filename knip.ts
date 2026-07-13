import type { KnipConfig } from "knip";

const config: KnipConfig = {
	biome: true,
	bumpp: true,
	commitlint: true,
	eslint: true,
	ignore: ["tests/fixtures/**", "documentation/src/content/**"],
	ignoreBinaries: ["hk", "notify-send", "osascript", "powershell"],
	ignoreDependencies: [
		"@astrojs/ts-plugin",
		"@mitata/counters",
		"@rbxts/react",
		"@rbxts/types",
		// Self-references in docs code samples; not a real docs-package dependency.
		"@pobammer-ts/eslint-cease-nonsense-rules",
		// Peer via starlight-heading-badges packageExtension in pnpm-workspace.yaml.
		"astro",
		"eslint-plugin-cease-nonsense",
		"skills",
		"source-map",
	],
	oxlint: true,
	pnpm: true,
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
	workspaces: {
		".": {
			entry: ["scripts/*.ts", "benchmarks/**/*.bench.ts", ".opencode/**/*.ts", "tests/**/*.ts"],
			project: ["src/**/*.ts", "scripts/**/*.ts", "tests/**/*.ts"],
		},
		documentation: {
			entry: ["astro.config.ts", "src/**/*.{ts,astro}"],
			project: ["src/**/*.{ts,astro}"],
		},
	},
};

export default config;
