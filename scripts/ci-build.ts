#!/usr/bin/env bun

import buildMetadata from "./plugins/build-metadata";

await Bun.$`rm -rf ./dist`;

await Bun.build({
	entrypoints: ["./src/index.ts"],
	external: [
		"@typescript-eslint/utils",
		"@typescript-eslint/parser",
		"@typescript-eslint/types",
		"eslint",
		"typescript",
	],
	format: "esm",
	minify: false,
	outdir: "./dist",
	plugins: [buildMetadata],
	sourcemap: "external",
	target: "node",
	tsconfig: "./tsconfig.json",
});

await Bun.$`bun x --bun tsgo --emitDeclarationOnly --declaration --outDir dist`;
