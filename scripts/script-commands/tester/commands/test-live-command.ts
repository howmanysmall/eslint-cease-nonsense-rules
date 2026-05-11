import { access, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { env, exit } from "node:process";
import { Command } from "@cliffy/command";
import { type } from "arktype";
import picocolors from "picocolors";
import prettyMilliseconds from "pretty-ms";

import { withContext } from "../logging/log-utilities";
import { isDirectorySimpleAsync } from "../utilities/fs-utilities";
import { editJsonc } from "../utilities/jsonc-utilities";
import { getCommandTextAsync, runCommandAsync } from "../utilities/process-utilities";

const log = withContext({ namespace: "tester", scope: "test-live" });
const HOME_PREFIX_REGEXP = /^~\//u;

const isBasePackageJson = type({
	dependencies: "Record<string, string>",
	devDependencies: "Record<string, string>",
	name: "string",
	version: "string",
});
type BasePackageJson = typeof isBasePackageJson.infer;

async function readPackageJsonAsync(
	filePath: string,
): Promise<readonly [basePackageJson: BasePackageJson, contents: string]> {
	const exists = await fileExistsAsync(filePath);
	if (!exists) {
		log.fail("package.json not found in the testing directory.");
		exit(1);
	}

	const stringContents = await readFile(filePath, "utf8");
	const basePackageJson = isBasePackageJson.assert(JSON.parse(stringContents));

	return [basePackageJson, stringContents];
}

interface Parameters {
	readonly livePackageJson: BasePackageJson;
	readonly livePackagePath: string;
	readonly packageContents: string;
	readonly packageFileName: string;
	readonly thisPackageJson: BasePackageJson;
	readonly useLink: boolean;
}

function sanitizeForPath(name: string): string {
	return name.replaceAll("@", "").replaceAll("/", "-");
}

function expandDirectory(directory: string): string {
	if (!directory.startsWith("~/")) return directory;
	return directory.replace(HOME_PREFIX_REGEXP, `${homedir()}/`);
}

function createPackageFileName(name: string, version: string): string {
	return `${sanitizeForPath(`${name}-${version}`)}-${Date.now()}.tgz`;
}

const isValidJson = type({
	filename: "string",
})
	.readonly()
	.array()
	.readonly();
type PackOutput = typeof isValidJson.infer;

function parsePackOutput(output: string): PackOutput {
	const trimmed = output.trim();
	const matches = [...trimmed.matchAll(/(?:^|\n)\[/gu)];
	if (matches.length === 0) {
		const error = new Error("npm pack output did not include JSON metadata.");
		Error.captureStackTrace(error, parsePackOutput);
		throw error;
	}

	const lastMatch = matches.at(-1);
	if (lastMatch?.index === undefined) {
		const error = new Error("npm pack output did not include JSON metadata.");
		Error.captureStackTrace(error, parsePackOutput);
		throw error;
	}

	const { index: start } = lastMatch;
	const jsonText = trimmed.slice(start).trim();
	const parsed = isValidJson(JSON.parse(jsonText));
	if (parsed instanceof type.errors) {
		const error = new TypeError(`Unexpected npm pack JSON payload shape - ${parsed.summary}`);
		Error.captureStackTrace(error, parsePackOutput);
		throw error;
	}

	return parsed;
}

async function fileExistsAsync(filePath: string): Promise<boolean> {
	try {
		await access(filePath);
		return true;
	} catch {
		return false;
	}
}

async function replacePackageJsonAsync({
	livePackagePath,
	livePackageJson,
	packageContents,
	packageFileName,
	thisPackageJson,
	useLink,
}: Parameters): Promise<() => Promise<void>> {
	const { name } = thisPackageJson;
	const { dependencies, devDependencies } = livePackageJson;

	const pathToUse = `file:./patches/node/${packageFileName}`;

	if (name in dependencies) dependencies[name] = useLink ? `link:${name}` : pathToUse;
	else if (name in devDependencies) devDependencies[name] = useLink ? `link:${name}` : pathToUse;
	else {
		log.fail(`Package ${name} not found in dependencies or devDependencies.`);
		exit(1);
	}

	const updated = editJsonc(packageContents, isBasePackageJson.assert, (draft) => {
		draft.dependencies = dependencies;
		draft.devDependencies = devDependencies;
		return draft;
	});

	await writeFile(livePackagePath, updated);

	return async function undoAsync(): Promise<void> {
		await writeFile(livePackagePath, packageContents);
	};
}

const testLiveCommand = new Command()
	.name("test-live")
	.version("1.2.0")
	.description("Test the package in a live game environment.")
	.option("--use-link", "Use a package manager link instead of patching package.json.", { default: false })
	.option("-c, --cache", "Cache ESLint results.")
	.option("--ci", "Enables CI mode.")
	.arguments("<directory:string>")
	.action(async ({ ci, useLink, cache }, directoryUnresolved) => {
		log.info("Starting live test...");
		const directory = resolve(expandDirectory(directoryUnresolved));
		const isDirectoryReal = await isDirectorySimpleAsync(directory);
		if (!isDirectoryReal) {
			log.fail(picocolors.red(`The directory "${picocolors.bold(directory)}" does not exist.`));
			exit(1);
		}

		const livePackagePath = resolve(directory, "package.json");
		const isLivePackageReal = await fileExistsAsync(livePackagePath);

		if (!isLivePackageReal) {
			log.fail(picocolors.red(`No package.json found in "${picocolors.bold(directory)}".`));
			exit(1);
		}

		const [thisPackageJson] = await readPackageJsonAsync(resolve(".", "package.json"));
		const [livePackageJson, packageContents] = await readPackageJsonAsync(livePackagePath);

		const packageFileName = createPackageFileName(thisPackageJson.name, thisPackageJson.version);

		const cleanupAsync = await replacePackageJsonAsync({
			livePackageJson,
			livePackagePath,
			packageContents,
			packageFileName,
			thisPackageJson,
			useLink,
		});

		await runCommandAsync("aube", ["run", "build"]);

		const nodePackages = resolve(directory, "patches", "node");
		await mkdir(nodePackages, { recursive: true });

		if (useLink) await runCommandAsync("aube", ["link"]);

		if (!useLink) {
			const output = await getCommandTextAsync("npm", [
				"pack",
				"--ignore-scripts",
				"--json",
				"--pack-destination",
				nodePackages,
			]);
			const packMetadata = parsePackOutput(output);
			const [packData] = packMetadata;
			const packedFile = packData?.filename;
			if (!packedFile) {
				log.fail("Failed to produce plugin package for live test.");
				exit(1);
			}
			await rename(resolve(nodePackages, packedFile), resolve(nodePackages, packageFileName));
		}

		try {
			const customEnvironment: NodeJS.ProcessEnv = { ...env, TIMING: "2000" };
			if (ci) customEnvironment.CI = "true";

			await runCommandAsync("aube", ["install", "--no-frozen-lockfile"], {
				cwd: directory,
				env: customEnvironment,
			});
			log.success(picocolors.green("Dependencies installed successfully."));

			const duration = await profileAsync(async () => {
				// oxlint-disable-next-line unicorn/prefer-ternary
				if (cache) {
					await runCommandAsync("aube", ["run", "eslint", "--cache", "./src"], {
						cwd: directory,
						env: customEnvironment,
					});
				} else {
					await runCommandAsync("aube", ["run", "eslint", "./src"], {
						cwd: directory,
						env: customEnvironment,
					});
				}
			});

			log.success(picocolors.green(`ESLint took ${picocolors.bold(prettyMilliseconds(duration))}.`));
		} catch (error) {
			log.error(picocolors.red(`Error running lint: ${error instanceof Error ? error.message : String(error)}`));
		} finally {
			await cleanupAsync();
		}

		const patchPath = resolve(nodePackages, packageFileName);
		if (await fileExistsAsync(patchPath)) await rm(patchPath);
	});

export default testLiveCommand;

async function profileAsync(callback: () => Promise<void>): Promise<number> {
	const startTime = performance.now();
	try {
		await callback();
	} catch (error) {
		log.fail(picocolors.red(`Error during profiling: ${error instanceof Error ? error.message : String(error)}`));
	}
	return performance.now() - startTime;
}
