import { rename } from "node:fs/promises";
import { resolve } from "node:path";
import { exit } from "node:process";
import { Command } from "@jsr/cliffy__command";
import { type } from "arktype";
import { $, env, file, nanoseconds } from "bun";
import picocolors from "picocolors";
import prettyMilliseconds from "pretty-ms";

import { withContext } from "../logging/log-utilities";
import { isDirectorySimpleAsync } from "../utilities/fs-utilities";
import { editJsonc } from "../utilities/jsonc-utilities";

import type { BunFile } from "bun";

const log = withContext({ namespace: "tester", scope: "test-live" });

const isBasePackageJson = type({
	dependencies: "Record<string, string>",
	devDependencies: "Record<string, string>",
	name: "string",
	version: "string",
});
type BasePackageJson = typeof isBasePackageJson.infer;

async function readPackageJsonAsync(
	bunFile: BunFile,
): Promise<readonly [basePackageJson: BasePackageJson, contents: string]> {
	const exists = await bunFile.exists();
	if (!exists) {
		log.fail("package.json not found in the testing directory.");
		exit(1);
	}

	const basePackageJson = await bunFile.json().then(isBasePackageJson.assert);
	const stringContents = await bunFile.text();

	return [basePackageJson, stringContents];
}

interface Parameters {
	readonly directory: string;
	readonly livePackageFile: BunFile;
	readonly livePackageJson: BasePackageJson;
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
	const home = env.HOME;
	if (!home) return directory;
	return directory.replace(/^~\//u, `${home}/`);
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
		throw new Error("npm pack output did not include JSON metadata.");
	}

	const { index: start } = matches.at(-1) as RegExpMatchArray;
	if (start === undefined) {
		throw new Error("npm pack output did not include JSON metadata.");
	}

	const jsonText = trimmed.slice(start).trim();
	const parsed = isValidJson(JSON.parse(jsonText));
	if (parsed instanceof type.errors) {
		throw new TypeError(`Unexpected npm pack JSON payload shape - ${parsed.summary}`);
	}

	return parsed;
}

async function replacePackageJsonAsync({
	directory,
	livePackageFile,
	livePackageJson,
	packageContents,
	packageFileName,
	thisPackageJson,
	useLink,
}: Parameters): Promise<() => Promise<void>> {
	const { name } = thisPackageJson;
	const { dependencies, devDependencies } = livePackageJson;

	const pathToUse = `./patches/node/${packageFileName}`;

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

	await livePackageFile.write(updated);

	return async function undoAsync(): Promise<void> {
		await livePackageFile.write(packageContents);
		await $.cwd(directory)`bun install`.quiet();
	};
}

const testLiveCommand = new Command()
	.name("test-live")
	.version("1.2.0")
	.description("Test the package in a live game environment.")
	.option("--use-link", "Use 'bun link' instead of patching package.json.", { default: false })
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

		const livePackageFile = file(resolve(directory, "package.json"));
		const isLivePackageReal = await livePackageFile.exists();

		if (!isLivePackageReal) {
			log.fail(picocolors.red(`No package.json found in "${picocolors.bold(directory)}".`));
			exit(1);
		}

		const [thisPackageJson] = await readPackageJsonAsync(file(resolve(".", "package.json")));
		const [livePackageJson, packageContents] = await readPackageJsonAsync(livePackageFile);

		const packageFileName = createPackageFileName(thisPackageJson.name, thisPackageJson.version);

		const cleanupAsync = await replacePackageJsonAsync({
			directory,
			livePackageFile,
			livePackageJson,
			packageContents,
			packageFileName,
			thisPackageJson,
			useLink,
		});

		await $`bun run build`.quiet();

		const nodePackages = resolve(directory, "patches", "node");
		await $`mkdir -p ${nodePackages}`.quiet();
		//
		if (useLink) await $`bun link`;

		if (!useLink) {
			const output = await $`npm pack --ignore-scripts --json --pack-destination ${nodePackages}`.text();
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
			const customEnv: Record<string, string> = { ...Bun.env, TIMING: "2000" };
			if (ci) customEnv.CI = "true";

			const shell = $.cwd(directory).env(customEnv);

			await shell`bun install`.quiet();
			log.success(picocolors.green("Dependencies installed successfully."));

			const duration = await profileAsync(async () => {
				// oxlint-disable-next-line unicorn/prefer-ternary
				if (cache) await shell`bun run eslint --cache ./src`;
				else await shell`bun run eslint ./src`;
			});

			log.success(picocolors.green(`ESLint took ${picocolors.bold(prettyMilliseconds(duration))}.`));
		} catch (error) {
			log.error(picocolors.red(`Error running lint: ${error instanceof Error ? error.message : String(error)}`));
		} finally {
			await cleanupAsync();
		}

		const patch = file(resolve(nodePackages, packageFileName));
		if (await patch.exists()) await patch.delete();
	});

export default testLiveCommand;

async function profileAsync(callback: () => Promise<void>): Promise<number> {
	const startTime = nanoseconds();
	try {
		await callback();
	} catch (error) {
		log.fail(picocolors.red(`Error during profiling: ${error instanceof Error ? error.message : String(error)}`));
	}
	const finishTime = nanoseconds();
	return (finishTime - startTime) / 1_000_000;
}
