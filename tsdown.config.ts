import { defineConfig } from "tsdown";

const externalPackages = [
	"@typescript-eslint/parser",
	"@typescript-eslint/types",
	"@typescript-eslint/utils",
	"eslint",
	"oxc-parser",
	"oxc-resolver",
	"oxfmt",
	"typescript",
];

const configuration = defineConfig({
	clean: true,
	deps: {
		neverBundle: externalPackages,
	},
	dts: {
		incremental: true,
		resolver: "oxc",
		tsgo: true,
	},
	entry: {
		index: "./src/index.ts",
		"oxfmt-worker": "./src/oxfmt-worker.ts",
	},
	fixedExtension: false,
	format: ["esm"],
	inputOptions: {
		external: externalPackages,
	},
	outDir: "dist",
	platform: "node",
	tsconfig: "./tsconfig.json",
});

export default configuration;
