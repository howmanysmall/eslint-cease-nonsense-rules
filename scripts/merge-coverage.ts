#!/usr/bin/env bun

import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Command, ValidationError } from "@jsr/cliffy__command";
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

		const coverageFiles = entries
			.filter((entry) => entry.isDirectory() && entry.name.startsWith("coverage-shard-"))
			.map((entry) => join(baseDirectory, entry.name, "coverage-final.json"))
			.filter((filePath) => {
				try {
					return Bun.file(filePath).size > 0;
				} catch {
					return false;
				}
			});

		return coverageFiles;
	} catch (error) {
		throw new Error(
			`Failed to read directory ${baseDirectory}: ${error instanceof Error ? error.message : String(error)}`,
			{ cause: error },
		);
	}
}

async function readCoverageFileAsync(filePath: string): Promise<V8Coverage> {
	try {
		const result = isV8Coverage(await Bun.file(filePath).json());
		if (result instanceof type.errors) {
			throw new TypeError(`Invalid V8 coverage format in ${filePath}: ${result.summary}`);
		}
		return result;
	} catch (error) {
		throw new Error(
			`Failed to read coverage file ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
			{ cause: error },
		);
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
		await Bun.write(outputPath, JSON.stringify(coverage, undefined, 2), { createPath: true });
	} catch (error) {
		throw new Error(
			`Failed to write merged coverage to ${outputPath}: ${error instanceof Error ? error.message : String(error)}`,
			{ cause: error },
		);
	}
}

const command = new Command()
	.name("merge-coverage")
	.version("0.1.0")
	.description("Merge coverage files from multiple test shards.")
	.arguments("<coverage-directory:string> <output-file:string>")
	.action(async (_, coverageDirectory, outputFile) => {
		const baseDirectory = resolve(process.cwd(), coverageDirectory);
		const outputPath = resolve(process.cwd(), outputFile);

		console.log(`Searching for coverage files in ${baseDirectory}...`);
		const coverageFiles = await findCoverageFilesAsync(baseDirectory);

		if (coverageFiles.length === 0) throw new ValidationError("No coverage files found to merge");

		console.log(`Found ${coverageFiles.length} coverage files`);

		// oxlint-disable-next-line unicorn/no-array-callback-reference
		const coverageData = await Promise.all(coverageFiles.map(readCoverageFileAsync));

		console.log("Merging coverage data...");
		const merged = mergeCoverageData(coverageData);

		console.log(`Writing merged coverage to ${outputPath}...`);
		await writeMergedCoverageAsync(outputPath, merged);

		console.log(`Successfully merged ${coverageFiles.length} coverage files`);
		console.log(`Total scripts covered: ${merged.result.length}`);
	});

await command.parse(Bun.argv.slice(2));
