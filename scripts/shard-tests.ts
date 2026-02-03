#!/usr/bin/env bun

import { resolve } from "node:path";
import { Command } from "@jsr/cliffy__command";

const MATCH_TEST = new Bun.Glob("**/*.test.ts");

async function collectUnitTestsAsync(cwd: string): Promise<[paths: ReadonlyArray<string>, size: number]> {
	const unitTests = new Array<string>();
	let size = 0;

	for await (const path of MATCH_TEST.scan({ cwd, onlyFiles: true })) unitTests[size++] = resolve(cwd, path);
	return [unitTests, size];
}

const command = new Command()
	.name("shard-tests")
	.version("0.1.0")
	.description("Shard unit tests for parallel execution.")
	.arguments("<shard-index:integer> <total-shards:integer>")
	.action(async (_, shardIndex, totalShards) => {
		const cwd = resolve(process.cwd(), "tests");
		const [unitTests, size] = await collectUnitTestsAsync(cwd);

		console.log(shardIndex, totalShards, size, unitTests);
	});

await command.parse(Bun.argv.slice(2));
