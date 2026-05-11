#!/usr/bin/env bun

import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { argv, cwd } from "node:process";
import { Command, ValidationError } from "@cliffy/command";

async function collectUnitTestsAsync(rootDirectory: string): Promise<ReadonlyArray<string>> {
	const unitTests = new Array<string>();

	async function walk(directory: string): Promise<void> {
		const entries = await readdir(directory, { withFileTypes: true });
		await Promise.all(
			entries.map(async (entry): Promise<void> => {
				const path = resolve(directory, entry.name);
				if (entry.isDirectory()) {
					await walk(path);
					return;
				}
				if (entry.isFile() && path.endsWith(".test.ts")) unitTests.push(path);
			}),
		);
	}

	await walk(rootDirectory);
	return unitTests.toSorted();
}

function validateShardArgumentsOrThrow(shardIndex: number, totalShards: number, testFileCount: number): void {
	if (shardIndex < 1) throw new ValidationError(`shard-index must be >= 1, got ${shardIndex}`);
	if (shardIndex > totalShards) {
		throw new ValidationError(`shard-index (${shardIndex}) cannot exceed total-shards (${totalShards})`);
	}
	if (totalShards < 1) throw new ValidationError(`total-shards must be >= 1, got ${totalShards}`);
	if (testFileCount === 0) throw new ValidationError("No test files found in tests/ directory");
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
		const rootDirectory = resolve(cwd(), "tests");
		const unitTests = await collectUnitTestsAsync(rootDirectory);

		validateShardArgumentsOrThrow(shardIndex, totalShards, unitTests.length);

		const shardFiles = selectShardFiles(unitTests, shardIndex, totalShards);
		if (shardFiles.length > 0) console.log(shardFiles.join(" "));
	});

await command.parse(argv.slice(2));
