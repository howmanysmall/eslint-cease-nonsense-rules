#!/usr/bin/env bun

import { resolve } from "node:path";
import { Command, ValidationError } from "@jsr/cliffy__command";

const MATCH_TEST = new Bun.Glob("**/*.test.ts");

async function collectUnitTestsAsync(cwd: string): Promise<[paths: ReadonlyArray<string>, size: number]> {
	const unitTests = new Array<string>();
	let size = 0;

	for await (const path of MATCH_TEST.scan({ cwd, onlyFiles: true })) unitTests[size++] = resolve(cwd, path);
	return [unitTests, size];
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
	// Use round-robin distribution for better load balancing
	// Shard index is 1-based, so we convert to 0-based for modulo arithmetic
	return allFiles.filter((_, index) => index % totalShards === shardIndex - 1);
}

const command = new Command()
	.name("shard-tests")
	.version("0.1.0")
	.description("Shard unit tests for parallel execution.")
	.arguments("<shard-index:integer> <total-shards:integer>")
	.action(async (_, shardIndex, totalShards) => {
		const cwd = resolve(process.cwd(), "tests");
		const [unitTests, size] = await collectUnitTestsAsync(cwd);

		validateShardArgumentsOrThrow(shardIndex, totalShards, size);

		const shardFiles = selectShardFiles(unitTests, shardIndex, totalShards);

		// Output space-separated file paths to stdout
		// Some shards may be empty if totalShards > test file count
		if (shardFiles.length > 0) console.log(shardFiles.join(" "));
	});

await command.parse(Bun.argv.slice(2));
