#!/usr/bin/env nub

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import nodePath from "node:path";
import { argv, cwd, env, exit } from "node:process";
import { Command } from "@cliffy/command";
import console from "consola";
import { bold, cyan, gray, green, magenta, red, yellow } from "picocolors";
import prettyBytes from "pretty-bytes";
import prettyMilliseconds from "pretty-ms";
import { build } from "tsdown";

import { readDeclarationBundlerPaths } from "./utilities/declaration-bundler-paths";
import {
	getStaleDeclarationSupportPaths,
	normalizeDeclarationSupportPaths,
} from "./utilities/declaration-support-cache";

const scriptPath = new URL(import.meta.url).pathname;
const SCRIPT_NAME = nodePath.basename(scriptPath, nodePath.extname(scriptPath));
const DIST_DIRECTORY = nodePath.resolve(".", "dist");
const SOURCE_DIRECTORY = nodePath.resolve(".", "src");
const TSCONFIG_PATHS_FILE = nodePath.resolve(".", "tsconfig.paths.json");
const ENTRY_POINTS = ["./src/index.ts", "./src/oxfmt-worker.ts"];
const CRITICAL_FILES = ["dist/index.js", "dist/oxfmt-worker.js", "dist/index.d.ts", "dist/oxfmt-worker.d.ts"];
const EXTERNAL_PACKAGES = [
	"@typescript-eslint/utils",
	"@typescript-eslint/parser",
	"@typescript-eslint/types",
	"eslint",
	"typescript",
	"oxfmt",
	"oxc-resolver",
	"oxc-parser",
];
const DECLARATION_CACHE_KEY = createHash("sha1").update(cwd()).digest("hex").slice(0, 12);
const DECLARATION_CACHE_DIRECTORY = nodePath.resolve(tmpdir(), `${SCRIPT_NAME}-${DECLARATION_CACHE_KEY}`);
const DECLARATION_CACHE_MANIFEST_PATH = nodePath.resolve(DECLARATION_CACHE_DIRECTORY, "support-manifest.json");
const DECLARATION_CACHE_OUTPUT_DIRECTORY = nodePath.resolve(DECLARATION_CACHE_DIRECTORY, "out");
const DECLARATION_CACHE_BUILD_INFO_PATH = nodePath.resolve(DECLARATION_CACHE_DIRECTORY, "tsgo.tsbuildinfo");

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

interface CommandOutput {
	readonly exitCode: number | null;
	readonly stderr: string;
	readonly stdout: string;
}

function getJavaScriptMinifyLabel(minify: boolean): string {
	return minify ? green("yes") : gray("no");
}

async function cleanDistanceDirectoryAsync(verbose: boolean): Promise<void> {
	if (verbose) console.info(`Removing ${cyan(DIST_DIRECTORY)}...`);
	await rm(DIST_DIRECTORY, { force: true, recursive: true });
}

function createDeclarationEmitFlags(outputDirectory: string, buildInfoPath: string): ReadonlyArray<string> {
	return [
		"--allowJs",
		"false",
		"--declaration",
		"--emitDeclarationOnly",
		"--exactOptionalPropertyTypes",
		"--forceConsistentCasingInFileNames",
		"--isolatedModules",
		"--lib",
		"ES2023",
		"--module",
		"ES2022",
		"--moduleDetection",
		"force",
		"--moduleResolution",
		"Bundler",
		"--incremental",
		"--noFallthroughCasesInSwitch",
		"--noImplicitAny",
		"--noImplicitOverride",
		"--noImplicitReturns",
		"--noImplicitThis",
		"--noUncheckedIndexedAccess",
		"--noUncheckedSideEffectImports",
		"--noUnusedLocals",
		"--noUnusedParameters",
		"--outDir",
		outputDirectory,
		"--resolveJsonModule",
		"false",
		"--rootDir",
		"src",
		"--skipLibCheck",
		"--strict",
		"--target",
		"es2023",
		"--tsBuildInfoFile",
		buildInfoPath,
		"--types",
		"node",
		"--useUnknownInCatchVariables",
		"--verbatimModuleSyntax",
		"--declarationMap",
		"false",
		"--sourceMap",
		"false",
	];
}

async function collectDeclarationPathsAsync(sourceDirectory: string): Promise<ReadonlyArray<string>> {
	const paths = new Array<string>();

	async function walk(directory: string): Promise<void> {
		const entries = await readdir(directory, { withFileTypes: true });
		await Promise.all(
			entries.map(async (entry): Promise<void> => {
				const path = nodePath.resolve(directory, entry.name);
				if (entry.isDirectory()) {
					await walk(path);
					return;
				}
				if (entry.isFile() && path.endsWith(".d.ts")) paths.push(path.replace(`${sourceDirectory}/`, ""));
			}),
		);
	}

	await walk(sourceDirectory);
	return normalizeDeclarationSupportPaths(paths);
}

async function readJsonFileAsync(path: string): Promise<unknown> {
	try {
		return JSON.parse(await readFile(path, "utf8"));
	} catch {
		return undefined;
	}
}

async function readDeclarationSupportManifestAsync(manifestPath: string): Promise<ReadonlyArray<string>> {
	const manifest = await readJsonFileAsync(manifestPath);
	if (!Array.isArray(manifest) || !manifest.every((entry) => typeof entry === "string")) return [];
	return normalizeDeclarationSupportPaths(manifest);
}

async function syncSourceDeclarationFilesAsync(
	sourceDirectory: string,
	targetDirectory: string,
	manifestPath: string,
): Promise<void> {
	const relativePaths = await collectDeclarationPathsAsync(sourceDirectory);
	const previousPaths = await readDeclarationSupportManifestAsync(manifestPath);
	const stalePaths = getStaleDeclarationSupportPaths(previousPaths, relativePaths);
	const targetDirectories = new Set(
		relativePaths.map((relativePath) => nodePath.dirname(nodePath.resolve(targetDirectory, relativePath))),
	);

	await Promise.all([
		...stalePaths.map(async (relativePath): Promise<void> => {
			await rm(nodePath.resolve(targetDirectory, relativePath), { force: true });
		}),
		...[...targetDirectories].map(async (directoryPath): Promise<void> => {
			await mkdir(directoryPath, { recursive: true });
		}),
	]);

	await Promise.all(
		relativePaths.map(async (relativePath): Promise<void> => {
			await writeFile(
				nodePath.resolve(targetDirectory, relativePath),
				await readFile(nodePath.resolve(sourceDirectory, relativePath)),
			);
		}),
	);

	await writeFile(manifestPath, JSON.stringify(relativePaths));
}

async function getCommandOutputAsync(command: string, parameters: ReadonlyArray<string>): Promise<CommandOutput> {
	return new Promise((_resolve, reject) => {
		const childProcess = spawn(command, [...parameters], {
			stdio: ["ignore", "pipe", "pipe"],
		});
		const stderrChunks = new Array<Buffer>();
		const stdoutChunks = new Array<Buffer>();

		childProcess.stdout.on("data", (chunk: Buffer) => {
			stdoutChunks.push(chunk);
		});
		childProcess.stderr.on("data", (chunk: Buffer) => {
			stderrChunks.push(chunk);
		});
		childProcess.on("error", reject);
		childProcess.on("close", (exitCode) => {
			_resolve({
				exitCode,
				stderr: Buffer.concat(stderrChunks).toString().trim(),
				stdout: Buffer.concat(stdoutChunks).toString().trim(),
			});
		});
	});
}

async function runCommandAsync(command: string, parameters: ReadonlyArray<string>, verbose: boolean): Promise<void> {
	if (verbose) console.log(`Calling ${cyan(command)} ${parameters.join(" ")}`);

	const output = await getCommandOutputAsync(command, parameters);
	if (output.exitCode === 0) return;

	if (output.stderr.length > 0) console.error(output.stderr);
	if (output.stdout.length > 0) console.log(output.stdout);
	throw new Error(`${command} failed with exit code ${output.exitCode ?? "unknown"}`);
}

async function generateBundledDeclarationsAsync(verbose: boolean): Promise<void> {
	const declarationBundlerPromise = import("./utilities/declaration-bundler");

	await mkdir(DECLARATION_CACHE_OUTPUT_DIRECTORY, { recursive: true });

	const flags = createDeclarationEmitFlags(DECLARATION_CACHE_OUTPUT_DIRECTORY, DECLARATION_CACHE_BUILD_INFO_PATH);
	await runCommandAsync("tsgo", flags, verbose);
	await syncSourceDeclarationFilesAsync(
		SOURCE_DIRECTORY,
		DECLARATION_CACHE_OUTPUT_DIRECTORY,
		DECLARATION_CACHE_MANIFEST_PATH,
	);
	const declarationBundlerPaths = readDeclarationBundlerPaths(
		TSCONFIG_PATHS_FILE,
		nodePath.basename(SOURCE_DIRECTORY),
	);

	const { bundleDeclarationEntryPoint, createDeclarationBundlerProgram } = await declarationBundlerPromise;
	const bundledEntrypoints = [
		{ entryFileName: "index.d.ts", outputFileName: nodePath.resolve(DIST_DIRECTORY, "index.d.ts") },
		{ entryFileName: "oxfmt-worker.d.ts", outputFileName: nodePath.resolve(DIST_DIRECTORY, "oxfmt-worker.d.ts") },
	];
	const program = createDeclarationBundlerProgram({
		compilerOptions: {
			baseUrl: DECLARATION_CACHE_OUTPUT_DIRECTORY,
			paths: declarationBundlerPaths,
		},
		entryFilePaths: bundledEntrypoints.map(({ entryFileName }) =>
			nodePath.resolve(DECLARATION_CACHE_OUTPUT_DIRECTORY, entryFileName),
		),
	});

	await Promise.all(
		bundledEntrypoints.map(async ({ entryFileName, outputFileName }): Promise<void> => {
			const bundledDeclaration = bundleDeclarationEntryPoint({
				entryFilePath: nodePath.resolve(DECLARATION_CACHE_OUTPUT_DIRECTORY, entryFileName),
				program,
			});
			await writeFile(outputFileName, bundledDeclaration);
		}),
	);
}

async function writeBuildMetadataAsync(): Promise<void> {
	const output = await getCommandOutputAsync("git", ["rev-parse", "HEAD"]);
	const commit = output.exitCode === 0 ? output.stdout : "unknown";
	const metadata = {
		commit,
		time: new Date().toISOString(),
		version: env.npm_package_version ?? "unknown",
	};

	await writeFile(nodePath.resolve(DIST_DIRECTORY, "build-metadata.json"), JSON.stringify(metadata, undefined, 2));
}

async function getOutputFilesAsync(directory: string): Promise<ReadonlyArray<OutputFile>> {
	const resolvedDirectory = nodePath.resolve(directory);

	async function walk(walkDirectory: string): Promise<ReadonlyArray<OutputFile>> {
		const entries = await readdir(walkDirectory, { withFileTypes: true });
		const results = await Promise.all(
			entries.map(async (entry): Promise<ReadonlyArray<OutputFile>> => {
				const fullPath = nodePath.resolve(walkDirectory, entry.name);
				if (entry.isDirectory()) return walk(fullPath);
				if (!entry.isFile()) return [];

				const stats = await stat(fullPath);
				return [{ path: fullPath.replace(`${resolvedDirectory}/`, ""), size: stats.size }];
			}),
		);
		return results.flat();
	}

	return [...(await walk(directory))].toSorted((left, right) => left.path.localeCompare(right.path));
}

async function runBuildAsync(options: BuildOptions): Promise<BuildResult> {
	const startTime = performance.now();

	try {
		if (options.clean) {
			if (options.verbose) console.start("Cleaning dist directory...");
			await cleanDistanceDirectoryAsync(options.verbose);
			if (options.verbose) console.success("Cleaned dist directory");
		}
		await mkdir(DIST_DIRECTORY, { recursive: true });

		if (options.verbose) {
			console.start("Building with tsdown...");
			console.info(`  Entry points: ${cyan(ENTRY_POINTS.join(", "))}`);
			console.info(`  Minify: ${getJavaScriptMinifyLabel(options.minify)}`);
			console.info(`  Sourcemap: ${options.sourcemap ? green("yes") : gray("no")}`);
			console.info(`  Declarations: ${cyan("custom bundle")}`);
		}

		await Promise.all([
			build({
				clean: false,
				deps: {
					neverBundle: [...EXTERNAL_PACKAGES],
				},
				dts: false,
				entry: ENTRY_POINTS,
				fixedExtension: false,
				format: ["esm"],
				minify: options.minify,
				outDir: DIST_DIRECTORY,
				outputOptions: {
					entryFileNames: "[name].js",
				},
				platform: "node",
				sourcemap: options.sourcemap,
				tsconfig: "./tsconfig.json",
			}),
			generateBundledDeclarationsAsync(options.verbose),
		]);
		await writeBuildMetadataAsync();

		for (const file of CRITICAL_FILES) {
			if (!existsSync(file)) {
				console.error(`Critical file missing: ${red(file)}`);
				return { duration: performance.now() - startTime, files: [], success: false };
			}
		}

		return {
			duration: performance.now() - startTime,
			files: await getOutputFilesAsync(DIST_DIRECTORY),
			success: true,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`${red("error:")} ${message}`);

		return { duration: performance.now() - startTime, files: [], success: false };
	}
}

function printBuildSummary(result: BuildResult, verbose: boolean): void {
	if (!result.success) {
		console.fail(red(`Build failed in ${prettyMilliseconds(result.duration)}`));
		return;
	}

	const jsFiles = result.files.filter(({ path }) => path.endsWith(".js"));
	const dtsFiles = result.files.filter(({ path }) => path.endsWith(".d.ts"));
	const mapFiles = result.files.filter(({ path }) => path.endsWith(".js.map"));
	const totalSize = result.files.reduce((sum, file) => sum + file.size, 0);

	console.log("");
	console.success(green(bold("Build completed successfully!")));
	console.log("");

	if (verbose) {
		console.info(bold("Output files:"));
		for (const { path, size } of result.files) {
			const color = path.endsWith(".js") ? cyan : path.endsWith(".d.ts") ? yellow : gray;
			console.log(`  ${color(path)} ${gray(`(${prettyBytes(size)})`)}`);
		}
		console.log("");
	}

	console.info(bold("Summary:"));
	console.log(`  ${cyan("JS:")} ${jsFiles.length} files`);
	console.log(`  ${yellow("Declarations:")} ${dtsFiles.length} files`);
	if (mapFiles.length > 0) console.log(`  ${gray("Sourcemaps:")} ${mapFiles.length} files`);
	console.log(`  ${magenta("Total size:")} ${prettyBytes(totalSize)}`);
	console.log(`  ${green("Duration:")} ${prettyMilliseconds(result.duration)}`);
}

const command = new Command()
	.name(SCRIPT_NAME)
	.version("1.0.0")
	.description("Build the ESLint plugin for distribution.")
	.option("--no-clean", "Skip cleaning dist/ before build", { default: true })
	.option("-v, --verbose", "Show detailed build output", { default: false })
	.option("-m, --minify", "Aggressively minify identifiers and syntax", { default: false })
	.option("--sourcemap", "Generate sourcemaps", { default: false })
	.action(async ({ clean, minify, sourcemap, verbose }) => {
		const options: BuildOptions = { clean, minify, sourcemap, verbose };

		if (verbose) {
			console.info(bold("Build configuration:"));
			console.log(`  Clean: ${clean ? green("yes") : gray("no")}`);
			console.log(`  Minify: ${getJavaScriptMinifyLabel(minify)}`);
			console.log(`  Sourcemap: ${sourcemap ? green("yes") : gray("no")}`);
			console.log("");
		}

		const result = await runBuildAsync(options);
		printBuildSummary(result, verbose);

		if (!result.success) exit(1);
	});

await command.parse(argv.slice(2));
