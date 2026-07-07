import { readdir, stat } from "node:fs/promises";
import nodePath from "node:path";
import picocolors from "picocolors";
import prettyBytes from "pretty-bytes";
import prettyMilliseconds from "pretty-ms";
import { defineConfig } from "tsdown";

const { bold, cyan, dim, gray, green } = picocolors;

const bundledPackages = [
	"@typescript-eslint/scope-manager",
	"@typescript-eslint/visitor-keys",
	"confbox",
	"eslint-visitor-keys",
	"ts-api-utils",
];

const externalPackages = [
	"@typescript-eslint/parser",
	"@typescript-eslint/types",
	"@typescript-eslint/utils",
	"eslint",
	"oxc-parser",
	"oxc-resolver",
	"oxfmt",
	"type-fest",
	"typescript",
];

interface OutputFile {
	readonly path: string;
	readonly size: number;
}

const buildStartTime = performance.now();
const expectedBuildCount = 2;
let completedBuildCount = 0;

async function getOutputFilesAsync(directory: string): Promise<ReadonlyArray<OutputFile>> {
	const resolvedDirectory = nodePath.resolve(directory);

	async function walkAsync(walkDirectory: string): Promise<ReadonlyArray<OutputFile>> {
		const entries = await readdir(walkDirectory, { withFileTypes: true });
		const nestedFiles = await Promise.all(
			entries.map(async (entry): Promise<ReadonlyArray<OutputFile>> => {
				const fullPath = nodePath.resolve(walkDirectory, entry.name);
				if (entry.isDirectory()) return walkAsync(fullPath);
				if (!entry.isFile()) return [];

				const fileStats = await stat(fullPath);
				return [{ path: fullPath.replace(`${resolvedDirectory}/`, ""), size: fileStats.size }];
			}),
		);

		return nestedFiles.flat();
	}

	return [...(await walkAsync(directory))].toSorted((left, right) => left.path.localeCompare(right.path));
}

async function printBuildSummaryAsync(): Promise<void> {
	completedBuildCount += 1;
	if (completedBuildCount !== expectedBuildCount) return;

	const files = await getOutputFilesAsync("dist");
	const javaScriptFiles = files.filter(({ path }) => path.endsWith(".js"));
	const declarationFiles = files.filter(({ path }) => path.endsWith(".d.ts"));
	const totalSize = files.reduce((sum, file) => sum + file.size, 0);
	const duration = performance.now() - buildStartTime;

	console.log();
	console.log(`${green("✔")} ${bold("Build completed")} in ${cyan(prettyMilliseconds(duration))}`);
	console.log();

	const maxPathLength = Math.max(...files.map(({ path }) => path.length + 5), 15);

	for (const file of files) {
		const isDts = file.path.endsWith(".d.ts");
		const fileColor = isDts ? dim : cyan;
		const sizeColor = isDts ? gray : green;
		const typeLabel = isDts ? gray("dts") : dim("esm");

		const displayPath = `dist/${file.path}`;
		const paddedPath = displayPath.padEnd(maxPathLength);
		const paddedSize = prettyBytes(file.size).padStart(10);

		console.log(`  ${fileColor(paddedPath)} ${sizeColor(paddedSize)}  ${typeLabel}`);
	}

	console.log();
	console.log(
		`  ${bold("Summary:")} ${dim("js:")} ${cyan(javaScriptFiles.length)} ${dim("· dts:")} ${cyan(declarationFiles.length)} ${dim("· total size:")} ${green(prettyBytes(totalSize))}`,
	);
	console.log();
}

const sharedConfigurations = defineConfig({
	deps: {
		neverBundle: externalPackages,
		onlyBundle: bundledPackages,
	},
	fixedExtension: false,
	format: ["esm"],
	inputOptions: {
		external: externalPackages,
	},
	logLevel: "silent",
	minify: false,
	outDir: "dist",
	platform: "node",
	sourcemap: false,
	tsconfig: "./tsconfig.json",
});

const configuration = defineConfig([
	{
		...sharedConfigurations,
		clean: true,
		dts: {
			compilerOptions: {
				declarationMap: false,
				removeComments: true,
				sourceMap: false,
			},
			incremental: true,
			resolver: "oxc",
			sourcemap: false,
			tsgo: true,
		},
		entry: {
			index: "./src/index.ts",
		},
		hooks: {
			"build:done": printBuildSummaryAsync,
		},
	},
	{
		...sharedConfigurations,
		clean: false,
		dts: false,
		entry: {
			"oxfmt-worker": "./src/oxfmt-worker.ts",
		},
		hooks: {
			"build:done": printBuildSummaryAsync,
		},
	},
]);

export default configuration;
