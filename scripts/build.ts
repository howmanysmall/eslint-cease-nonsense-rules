#!/usr/bin/env bun

import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import { exit, platform } from "node:process";
import { Command } from "@jsr/cliffy__command";
import console from "consola";
import picocolors from "picocolors";
import prettyBytes from "pretty-bytes";
import prettyMs from "pretty-ms";
import buildMetadata from "./plugins/build-metadata";

if (typeof Bun === "undefined") {
	const installScript =
		platform === "win32"
			? `${picocolors.gray("`")}${picocolors.green("powershell")} ${picocolors.yellow("-c")} ${picocolors.cyan('"irm bun.sh/install.ps1 | iex"')}${picocolors.gray("`")}`
			: `${picocolors.gray("`")}${picocolors.green("curl")} ${picocolors.yellow("-fsSL")} ${picocolors.cyan("https://bun.sh/install")} ${picocolors.magenta("|")} ${picocolors.green("bash")}${picocolors.gray("`")}`;
	console.fail(picocolors.red("This script must be run with Bun."));
	console.fail(`Please install Bun using ${installScript}`);
	exit(1);
}

const scriptPath = import.meta.path;
const SCRIPT_NAME = basename(scriptPath, extname(scriptPath));

const DIST_DIR = "./dist";
const ENTRY_POINTS = ["./src/index.ts", "./src/utilities/oxfmt-worker.ts"];
const EXTERNAL_PACKAGES = [
	"@typescript-eslint/utils",
	"@typescript-eslint/parser",
	"@typescript-eslint/types",
	"eslint",
	"typescript",
];

interface BuildOptions {
	readonly clean: boolean;
	readonly minify: boolean;
	readonly sourcemap: boolean;
	readonly verbose: boolean;
}

interface OutputFile {
	readonly path: string;
	readonly size: number;
}
interface BuildResult {
	readonly duration: number;
	readonly files: ReadonlyArray<OutputFile>;
	readonly success: boolean;
}

async function cleanDistDirectory(verbose: boolean): Promise<void> {
	if (existsSync(DIST_DIR)) {
		if (verbose) console.info(`Removing ${picocolors.cyan(DIST_DIR)}...`);
		await fs.rm(DIST_DIR, { recursive: true });
	}
}

async function getOutputFilesAsync(directory: string): Promise<ReadonlyArray<OutputFile>> {
	const resolvedDir = resolve(directory);

	async function walk(dir: string): Promise<ReadonlyArray<OutputFile>> {
		const entries = await fs.readdir(dir, { withFileTypes: true });
		const results: ReadonlyArray<ReadonlyArray<OutputFile>> = await Promise.all(
			entries.map(async (entry): Promise<ReadonlyArray<OutputFile>> => {
				const fullPath = resolve(dir, entry.name);
				if (entry.isDirectory()) return walk(fullPath);
				if (entry.isFile()) {
					const stats = await fs.stat(fullPath);
					return [{ path: fullPath.replace(`${resolvedDir}/`, ""), size: stats.size }];
				}
				return [];
			}),
		);
		return results.flat();
	}

	const files = await walk(directory);
	// oxlint-disable-next-line no-array-sort
	return [...files].sort((left, right) => left.path.localeCompare(right.path));
}

async function runBuildAsync(options: BuildOptions): Promise<BuildResult> {
	const startTime = performance.now();

	try {
		if (options.clean) {
			if (options.verbose) console.start("Cleaning dist directory...");
			await cleanDistDirectory(options.verbose);
			if (options.verbose) console.success("Cleaned dist directory");
		}

		if (options.verbose) {
			console.start("Building with Bun...");
			console.info(`  Entry points: ${picocolors.cyan(ENTRY_POINTS.join(", "))}`);
			console.info(`  Minify: ${options.minify ? picocolors.green("yes") : picocolors.gray("no")}`);
			console.info(`  Sourcemap: ${options.sourcemap ? picocolors.green("yes") : picocolors.gray("no")}`);
		}

		const buildResult = await Bun.build({
			entrypoints: [...ENTRY_POINTS],
			external: [...EXTERNAL_PACKAGES],
			format: "esm",
			minify: options.minify,
			outdir: DIST_DIR,
			plugins: [buildMetadata],
			sourcemap: options.sourcemap ? "external" : "none",
			target: "node",
			tsconfig: "./tsconfig.json",
		});

		if (!buildResult.success) {
			for (const log of buildResult.logs) console.error(log.message);
			return { duration: performance.now() - startTime, files: [], success: false };
		}

		if (options.verbose) console.success("Bun build completed");

		if (options.verbose) console.start("Generating type declarations...");
		await Bun.$`bun x --bun tsgo --emitDeclarationOnly --declaration --outDir dist`.quiet();
		if (options.verbose) console.success("Type declarations generated");

		const criticalFiles = ["dist/index.js", "dist/utilities/oxfmt-worker.js"];
		for (const file of criticalFiles) {
			if (!existsSync(file)) {
				console.error(`Critical file missing: ${picocolors.red(file)}`);
				return { duration: performance.now() - startTime, files: [], success: false };
			}
		}

		const outputFiles = await getOutputFilesAsync(DIST_DIR);
		const duration = performance.now() - startTime;

		return { duration, files: outputFiles, success: true };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`Build failed: ${picocolors.red(message)}`);
		return { duration: performance.now() - startTime, files: [], success: false };
	}
}

function printBuildSummary(result: BuildResult, verbose: boolean): void {
	if (!result.success) {
		console.fail(picocolors.red(`Build failed in ${prettyMs(result.duration)}`));
		return;
	}

	const jsFiles = result.files.filter((file) => file.path.endsWith(".js"));
	const dtsFiles = result.files.filter((file) => file.path.endsWith(".d.ts"));
	const mapFiles = result.files.filter((file) => file.path.endsWith(".js.map"));
	const totalSize = result.files.reduce((sum, file) => sum + file.size, 0);

	console.log("");
	console.success(picocolors.green(picocolors.bold("Build completed successfully!")));
	console.log("");

	if (verbose) {
		console.info(picocolors.bold("Output files:"));
		for (const file of result.files) {
			const color = file.path.endsWith(".js")
				? picocolors.cyan
				: file.path.endsWith(".d.ts")
					? picocolors.yellow
					: picocolors.gray;
			console.log(`  ${color(file.path)} ${picocolors.gray(`(${prettyBytes(file.size)})`)}`);
		}
		console.log("");
	}

	console.info(picocolors.bold("Summary:"));
	console.log(`  ${picocolors.cyan("JS:")} ${jsFiles.length} files`);
	console.log(`  ${picocolors.yellow("Declarations:")} ${dtsFiles.length} files`);
	if (mapFiles.length > 0) {
		console.log(`  ${picocolors.gray("Sourcemaps:")} ${mapFiles.length} files`);
	}
	console.log(`  ${picocolors.magenta("Total size:")} ${prettyBytes(totalSize)}`);
	console.log(`  ${picocolors.green("Duration:")} ${prettyMs(result.duration)}`);
}

const command = new Command()
	.name(SCRIPT_NAME)
	.version("1.0.0")
	.description("Build the ESLint plugin for distribution.")
	.option("--no-clean", "Skip cleaning dist/ before build", { default: true })
	.option("-v, --verbose", "Show detailed build output", { default: false })
	.option("-m, --minify", "Minify the output bundle", { default: false })
	.option("--no-sourcemap", "Skip generating sourcemaps", { default: true })
	.action(async ({ clean, minify, sourcemap, verbose }) => {
		const options: BuildOptions = { clean, minify, sourcemap, verbose };

		if (verbose) {
			console.info(picocolors.bold("Build configuration:"));
			console.log(`  Clean: ${clean ? picocolors.green("yes") : picocolors.gray("no")}`);
			console.log(`  Minify: ${minify ? picocolors.green("yes") : picocolors.gray("no")}`);
			console.log(`  Sourcemap: ${sourcemap ? picocolors.green("yes") : picocolors.gray("no")}`);
			console.log("");
		}

		const result = await runBuildAsync(options);
		printBuildSummary(result, verbose);

		if (!result.success) exit(1);
	});

await command.parse(Bun.argv.slice(2));
