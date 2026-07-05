#!/usr/bin/env bun

import { readdir } from "node:fs/promises";
import nodePath from "node:path";
import { argv, cwd } from "node:process";
import { Command, ValidationError } from "@cliffy/command";

async function collectUnitTestsAsync(rootDirectory: string): Promise<ReadonlyArray<string>> {
	const unitTests = new Array<string>();

	async function walkAsync(directory: string): Promise<void> {
		const entries = await readdir(directory, { withFileTypes: true });
		await Promise.all(
			entries.map(async (entry): Promise<void> => {
				const path = nodePath.resolve(directory, entry.name);
				if (entry.isDirectory()) {
					await walkAsync(path);
					return;
				}
				if (entry.isFile() && path.endsWith(".test.ts")) unitTests.push(path);
			}),
		);
	}

	await walkAsync(rootDirectory);
	return unitTests.toSorted();
}

function validateShardArgumentsOrThrow(shardIndex: number, totalShards: number, testFileCount: number): void {
	if (shardIndex < 1) {
		const error = new ValidationError(`shard-index must be >= 1, got ${shardIndex}`);
		Error.captureStackTrace(error, validateShardArgumentsOrThrow);
		throw error;
	}
	if (shardIndex > totalShards) {
		const error = new ValidationError(`shard-index (${shardIndex}) cannot exceed total-shards (${totalShards})`);
		Error.captureStackTrace(error, validateShardArgumentsOrThrow);
		throw error;
	}
	if (totalShards < 1) {
		const error = new ValidationError(`total-shards must be >= 1, got ${totalShards}`);
		Error.captureStackTrace(error, validateShardArgumentsOrThrow);
		throw error;
	}
	if (testFileCount === 0) {
		const error = new ValidationError("No test files found in tests/ directory");
		Error.captureStackTrace(error, validateShardArgumentsOrThrow);
		throw error;
	}
}

function selectShardFiles(
	allFiles: ReadonlyArray<string>,
	shardIndex: number,
	totalShards: number,
): ReadonlyArray<string> {
	return allFiles.filter((_, index) => index % totalShards === shardIndex - 1);
}

const command = new Command()
	.name("shard-tests")
	.version("0.1.0")
	.description("Shard unit tests for parallel execution.")
	.arguments("<shard-index:integer> <total-shards:integer>")
	.action(async (_, shardIndex, totalShards) => {
		const rootDirectory = nodePath.resolve(cwd(), "tests");
		const unitTests = await collectUnitTestsAsync(rootDirectory);

		validateShardArgumentsOrThrow(shardIndex, totalShards, unitTests.length);

		const shardFiles = selectShardFiles(unitTests, shardIndex, totalShards);
		if (shardFiles.length > 0) console.log(shardFiles.join(" "));
	});

await command.parse(argv.slice(2));
