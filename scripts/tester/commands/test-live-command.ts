#!/usr/bin/env bun

import { resolve } from "node:path";
import { chdir, cwd, exit } from "node:process";
import { Command } from "@jsr/cliffy__command";
import { type } from "arktype";
import type { BunFile } from "bun";
import { $, file } from "bun";
import console from "consola";
import picocolors from "picocolors";
import { isDirectorySimpleAsync } from "../utilities/fs-utilities";

const CURRENT_WORKING_DIRECTORY = cwd();

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
		console.fail("package.json not found in the testing directory.");
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
}

function sanitizeForPath(name: string): string {
	return name.replaceAll("@", "").replaceAll("/", "-");
}

async function replacePackageJsonAsync({
	directory,
	livePackageFile,
	livePackageJson,
	packageContents,
	packageFileName,
	thisPackageJson,
}: Parameters): Promise<() => Promise<void>> {
	const { name } = thisPackageJson;
	const { dependencies, devDependencies } = livePackageJson;

	const pathToUse = `./patches/node/${packageFileName}`;

	if (name in dependencies) dependencies[name] = pathToUse;
	else if (name in devDependencies) devDependencies[name] = pathToUse;
	else {
		console.fail(`Package ${name} not found in dependencies or devDependencies.`);
		exit(1);
	}

	const newPackageJson: BasePackageJson = {
		...livePackageJson,
		dependencies,
		devDependencies,
	};

	await livePackageFile.write(JSON.stringify(newPackageJson, undefined, 2));

	return async function undoAsync(): Promise<void> {
		await livePackageFile.write(packageContents);

		chdir(directory);
		await $`bun install`.quiet();
		chdir(CURRENT_WORKING_DIRECTORY);
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
		const directory = resolve(directoryUnresolved);
		const isDirectoryReal = await isDirectorySimpleAsync(directory);
		if (!isDirectoryReal) {
			console.fail(picocolors.red(`The directory "${picocolors.bold(directory)}" does not exist.`));
			exit(1);
		}

		const livePackageFile = file(resolve(directory, "package.json"));
		const isLivePackageReal = await livePackageFile.exists();

		if (!isLivePackageReal) {
			console.fail(picocolors.red(`No package.json found in "${picocolors.bold(directory)}".`));
			exit(1);
		}

		const [thisPackageJson] = await readPackageJsonAsync(file(resolve(".", "package.json")));
		const [livePackageJson, packageContents] = await readPackageJsonAsync(livePackageFile);

		const packageFileName = sanitizeForPath(`${thisPackageJson.name}-${thisPackageJson.version}.tgz`);

		const cleanupAsync = await replacePackageJsonAsync({
			directory,
			livePackageFile,
			livePackageJson,
			packageContents,
			packageFileName,
			thisPackageJson,
		});

		await $`bun run build`.quiet();

		const nodePackages = resolve(directory, "patches", "node");
		if (useLink) await $`bun link`;
		else await $`npm pack --pack-destination ${nodePackages}`.quiet();

		try {
			chdir(directory);
			await $`bun install`.quiet();

			const customEnv: Record<string, string> = { TIMING: "2000" };
			if (ci) customEnv.CI = "true";

			const shell = $.env(customEnv);

			if (cache) await shell`cd ${directory} && time bun x --bun eslint --cache --max-warnings=0 ./src`;
			else await shell`cd ${directory} && time bun x --bun eslint --max-warnings=0 ./src`;

			chdir(CURRENT_WORKING_DIRECTORY);
		} catch (error) {
			console.error(
				picocolors.red(`Error running lint: ${error instanceof Error ? error.message : String(error)}`),
			);
		} finally {
			await cleanupAsync();
		}

		const patch = file(resolve(nodePackages, packageFileName));
		if (await patch.exists()) await patch.delete();
	});

export default testLiveCommand;
