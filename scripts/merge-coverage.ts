#!/usr/bin/env bun

import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { argv, cwd } from "node:process";
import { Command, ValidationError } from "@cliffy/command";
import { type } from "arktype";

const isV8FunctionCoverage = type({
	"[string]": "unknown",
	functionName: "string",
	isBlockCoverage: "boolean",
	ranges: type({
		"[string]": "unknown",
		count: "number % 1",
		endOffset: "number % 1",
		startOffset: "number % 1",
	})
		.readonly()
		.array()
		.readonly(),
}).readonly();

const isV8ScriptCoverage = type({
	"[string]": "unknown",
	functions: isV8FunctionCoverage.array().readonly(),
	scriptId: "string",
	url: "string",
}).readonly();
type V8ScriptCoverage = typeof isV8ScriptCoverage.infer;

const isV8Coverage = type({
	"[string]": "unknown",
	result: isV8ScriptCoverage.array().readonly(),
}).readonly();
type V8Coverage = typeof isV8Coverage.infer;

async function findCoverageFilesAsync(baseDirectory: string): Promise<Array<string>> {
	try {
		const entries = await readdir(baseDirectory, { withFileTypes: true });
		const coverageFiles: Array<string> = [];

		for (const entry of entries) {
			if (!entry.isDirectory() || !entry.name.startsWith("coverage-shard-")) continue;

			const filePath = join(baseDirectory, entry.name, "coverage-final.json");
			try {
				// oxlint-disable-next-line no-await-in-loop -- File existence checks are cheap and easier to report sequentially
				const statistics = await stat(filePath);
				if (statistics.size > 0) coverageFiles.push(filePath);
			} catch {
				// Missing shard output is ignored; absent coverage is handled by the caller.
			}
		}

		return coverageFiles;
	} catch (error) {
		const error2 = new Error(
			`Failed to read directory ${baseDirectory}: ${error instanceof Error ? error.message : String(error)}`,
			{ cause: error },
		);
		Error.captureStackTrace(error2, findCoverageFilesAsync);
		throw error2;
	}
}

async function readCoverageFileAsync(filePath: string): Promise<V8Coverage> {
	try {
		const contents = await readFile(filePath, "utf8");
		const result = isV8Coverage(JSON.parse(contents));
		if (result instanceof type.errors) {
			const error = new TypeError(`Invalid V8 coverage format in ${filePath}: ${result.summary}`);
			Error.captureStackTrace(error, readCoverageFileAsync);
			throw error;
		}
		return result;
	} catch (error) {
		const error2 = new Error(
			`Failed to read coverage file ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
			{ cause: error },
		);
		Error.captureStackTrace(error2, readCoverageFileAsync);
		throw error2;
	}
}

function mergeCoverageData(coverageFiles: ReadonlyArray<V8Coverage>): V8Coverage {
	const mergedScripts = new Map<string, V8ScriptCoverage>();

	for (const coverage of coverageFiles) {
		for (const script of coverage.result) {
			const existing = mergedScripts.get(script.url);

			if (existing) {
				if (script.functions.length > existing.functions.length) mergedScripts.set(script.url, script);
			} else mergedScripts.set(script.url, script);
		}
	}

	return {
		result: [...mergedScripts.values()],
	};
}

async function writeMergedCoverageAsync(outputPath: string, coverage: V8Coverage): Promise<void> {
	try {
		await mkdir(dirname(outputPath), { recursive: true });
		await writeFile(outputPath, JSON.stringify(coverage, undefined, 2));
	} catch (error) {
		const error2 = new Error(
			`Failed to write merged coverage to ${outputPath}: ${error instanceof Error ? error.message : String(error)}`,
			{ cause: error },
		);
		Error.captureStackTrace(error2, writeMergedCoverageAsync);
		throw error2;
	}
}

const command = new Command()
	.name("merge-coverage")
	.version("0.1.0")
	.description("Merge coverage files from multiple test shards.")
	.arguments("<coverage-directory:string> <output-file:string>")
	.action(async (_, coverageDirectory, outputFile) => {
		const baseDirectory = resolve(cwd(), coverageDirectory);
		const outputPath = resolve(cwd(), outputFile);

		console.log(`Searching for coverage files in ${baseDirectory}...`);
		const coverageFiles = await findCoverageFilesAsync(baseDirectory);

		if (coverageFiles.length === 0) throw new ValidationError("No coverage files found to merge");

		console.log(`Found ${coverageFiles.length} coverage files`);

		const coverageData = await Promise.all(coverageFiles.map(readCoverageFileAsync));

		console.log("Merging coverage data...");
		const merged = mergeCoverageData(coverageData);

		console.log(`Writing merged coverage to ${outputPath}...`);
		await writeMergedCoverageAsync(outputPath, merged);

		console.log(`Successfully merged ${coverageFiles.length} coverage files`);
		console.log(`Total scripts covered: ${merged.result.length}`);
	});

await command.parse(argv.slice(2));
