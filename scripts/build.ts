#!/usr/bin/env bun

import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import { cwd, exit, platform } from "node:process";
import { Command } from "@jsr/cliffy__command";
import { type } from "arktype";
import console from "consola";
import { bold, cyan, gray, green, magenta, red, yellow } from "picocolors";
import prettyBytes from "pretty-bytes";
import prettyMs from "pretty-ms";
import buildMetadata from "./plugins/build-metadata";

if (typeof Bun === "undefined") {
	const installScript =
		platform === "win32"
			? `${gray("`")}${green("powershell")} ${yellow("-c")} ${cyan('"irm bun.sh/install.ps1 | iex"')}${gray("`")}`
			: `${gray("`")}${green("curl")} ${yellow("-fsSL")} ${cyan("https://bun.sh/install")} ${magenta("|")} ${green("bash")}${gray("`")}`;
	console.fail(red("This script must be run with Bun."));
	console.fail(`Please install Bun using ${installScript}`);
	exit(1);
}

const scriptPath = import.meta.path;
const SCRIPT_NAME = basename(scriptPath, extname(scriptPath));
const CRITICAL_FILES = ["dist/index.js", "dist/oxfmt-worker.js"];
type BuildRelatedMessage = BuildMessage | ResolveMessage;

const isPosition = type({
	column: "number",
	file: "string",
	length: "number",
	line: "number",
	lineText: "string",
	namespace: "string",
});

const isMessageLevel = type('"error" | "warning" | "info" | "debug" | "verbose"');
const isBuffer = type.unknown.narrow((data, context): data is Buffer => {
	if (typeof Buffer !== "undefined" && Buffer.isBuffer(data)) return true;
	return context.reject("Buffer");
});
const isBuildMessageType = type({
	level: isMessageLevel,
	message: "string",
	name: "'BuildMessage'",
	position: isPosition.or("null"),
}).readonly();
const isResolveMessageType = type({
	code: "string",
	importKind:
		'"entry_point" | "stmt" | "require" | "import" | "dynamic" | "require_resolve" | "at" | "at_conditional" | "url" | "internal"',
	level: isMessageLevel,
	message: "string",
	name: "'ResolveMessage'",
	position: isPosition.or("null"),
	referrer: "string",
	specifier: "string",
}).readonly();
const isShellErrorType = type({
	exitCode: "number.integer",
	message: "string",
	stderr: isBuffer,
	stdout: isBuffer,
}).readonly();
type ShellError = typeof isShellErrorType.infer;

function isBuildMessage(object: unknown): object is BuildMessage {
	return !(isBuildMessageType(object) instanceof type.errors);
}
function isResolveMessage(object: unknown): object is ResolveMessage {
	return !(isResolveMessageType(object) instanceof type.errors);
}
function isBuildRelatedMessage(object: unknown): object is BuildRelatedMessage {
	return isBuildMessage(object) || isResolveMessage(object);
}
function isShellError(object: unknown): object is ShellError {
	return !(isShellErrorType(object) instanceof type.errors);
}

const DIST_DIR = "./dist";
const ENTRY_POINTS = ["./src/index.ts", "./src/oxfmt-worker.ts"];
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

function formatBuildMessage(buildRelatedMessage: BuildRelatedMessage): string {
	const parts = new Array<string>();
	let size = 0;

	if (buildRelatedMessage.position) {
		const { file, line, column, lineText, length } = buildRelatedMessage.position;
		const relativePath = file.replace(`${cwd()}/`, "");

		parts[size++] = `${cyan(relativePath)}:${yellow(String(line))}:${yellow(String(column))}`;
		parts[size++] = `${gray(String(line))} | ${lineText}`;

		const padding = " ".repeat(String(line).length + 3 + column - 1);
		const underline = "^".repeat(Math.max(1, length ?? 1));
		parts[size++] = `${padding}${red(underline)}`;
	}

	parts[size] = `${red("error:")} ${buildRelatedMessage.message}`;
	return parts.join("\n");
}

async function cleanDistDirectory(verbose: boolean): Promise<void> {
	if (existsSync(DIST_DIR)) {
		if (verbose) console.info(`Removing ${cyan(DIST_DIR)}...`);
		await fs.rm(DIST_DIR, { recursive: true });
	}
}

async function getOutputFilesAsync(directory: string): Promise<ReadonlyArray<OutputFile>> {
	const resolvedDir = resolve(directory);

	async function walk(directory: string): Promise<ReadonlyArray<OutputFile>> {
		const entries = await fs.readdir(directory, { withFileTypes: true });
		const results: ReadonlyArray<ReadonlyArray<OutputFile>> = await Promise.all(
			entries.map(async (entry): Promise<ReadonlyArray<OutputFile>> => {
				const fullPath = resolve(directory, entry.name);
				if (entry.isDirectory()) return walk(fullPath);
				if (entry.isFile()) {
					const stats = await fs.stat(fullPath);
					return [
						{
							path: fullPath.replace(`${resolvedDir}/`, ""),
							size: stats.size,
						},
					];
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
	const startTime = Bun.nanoseconds();

	try {
		if (options.clean) {
			if (options.verbose) console.start("Cleaning dist directory...");
			await cleanDistDirectory(options.verbose);
			if (options.verbose) console.success("Cleaned dist directory");
		}

		if (options.verbose) {
			console.start("Building with Bun...");
			console.info(`  Entry points: ${cyan(ENTRY_POINTS.join(", "))}`);
			console.info(`  Minify: ${options.minify ? green("yes") : gray("no")}`);
			console.info(`  Sourcemap: ${options.sourcemap ? green("yes") : gray("no")}`);
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
			for (const log of buildResult.logs) console.error(formatBuildMessage(log));
			return {
				duration: (Bun.nanoseconds() - startTime) / 1_000_000,
				files: [],
				success: false,
			};
		}

		if (options.verbose) console.success("Bun build completed");

		if (options.verbose) console.start("Generating type declarations...");
		await Bun.$`bun x --bun tsgo --emitDeclarationOnly --declaration --outDir dist`.quiet();
		if (options.verbose) console.success("Type declarations generated");

		for (const file of CRITICAL_FILES) {
			if (!existsSync(file)) {
				console.error(`Critical file missing: ${red(file)}`);
				return {
					duration: (Bun.nanoseconds() - startTime) / 1_000_000,
					files: [],
					success: false,
				};
			}
		}

		const outputFiles = await getOutputFilesAsync(DIST_DIR);
		const duration = (Bun.nanoseconds() - startTime) / 1_000_000;

		return { duration, files: outputFiles, success: true };
	} catch (error) {
		if (error instanceof AggregateError) {
			for (const aggregateError of error.errors) {
				if (isBuildRelatedMessage(aggregateError)) console.error(formatBuildMessage(aggregateError));
				else console.error(`${red("error:")} ${String(aggregateError)}`);
			}
		} else if (isShellError(error)) {
			console.error(`${red("error:")} Command failed with exit code ${error.exitCode}`);
			const stderr = error.stderr.toString().trim();
			const stdout = error.stdout.toString().trim();
			if (stderr.length > 0) console.error(stderr);
			if (stdout.length > 0) console.log(stdout);
		} else {
			const message = error instanceof Error ? error.message : String(error);
			console.error(`${red("error:")} ${message}`);
		}

		return {
			duration: (Bun.nanoseconds() - startTime) / 1_000_000,
			files: [],
			success: false,
		};
	}
}

function printBuildSummary(result: BuildResult, verbose: boolean): void {
	if (!result.success) {
		console.fail(red(`Build failed in ${prettyMs(result.duration)}`));
		return;
	}

	const jsFiles = result.files.filter((file) => file.path.endsWith(".js"));
	const dtsFiles = result.files.filter((file) => file.path.endsWith(".d.ts"));
	const mapFiles = result.files.filter((file) => file.path.endsWith(".js.map"));
	const totalSize = result.files.reduce((sum, file) => sum + file.size, 0);

	console.log("");
	console.success(green(bold("Build completed successfully!")));
	console.log("");

	if (verbose) {
		console.info(bold("Output files:"));
		for (const file of result.files) {
			const color = file.path.endsWith(".js") ? cyan : file.path.endsWith(".d.ts") ? yellow : gray;
			console.log(`  ${color(file.path)} ${gray(`(${prettyBytes(file.size)})`)}`);
		}
		console.log("");
	}

	console.info(bold("Summary:"));
	console.log(`  ${cyan("JS:")} ${jsFiles.length} files`);
	console.log(`  ${yellow("Declarations:")} ${dtsFiles.length} files`);
	if (mapFiles.length > 0) console.log(`  ${gray("Sourcemaps:")} ${mapFiles.length} files`);
	console.log(`  ${magenta("Total size:")} ${prettyBytes(totalSize)}`);
	console.log(`  ${green("Duration:")} ${prettyMs(result.duration)}`);
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
			console.info(bold("Build configuration:"));
			console.log(`  Clean: ${clean ? green("yes") : gray("no")}`);
			console.log(`  Minify: ${minify ? green("yes") : gray("no")}`);
			console.log(`  Sourcemap: ${sourcemap ? green("yes") : gray("no")}`);
			console.log("");
		}

		const result = await runBuildAsync(options);
		printBuildSummary(result, verbose);

		if (!result.success) exit(1);
	});

await command.parse(Bun.argv.slice(2));
