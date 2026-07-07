import { describe, expect, it } from "vitest";

import {
	collectAllTestsAsync,
	getHeavyFiles,
	selectNormalShardFilesAsync,
	verifyAssignment,
} from "../../scripts/test-shard-plan";

const TESTS_ROOT = "tests";
const TOTAL_NORMAL_SHARDS = 8;
const SHARD_INDICES: ReadonlyArray<number> = [1, 2, 3, 4, 5, 6, 7, 8];

async function gatherAllNormalShardsAsync(): Promise<ReadonlyArray<ReadonlyArray<string>>> {
	return Promise.all(
		SHARD_INDICES.map(async (shardIndex) => selectNormalShardFilesAsync(shardIndex, TOTAL_NORMAL_SHARDS)),
	);
}

describe("test-shard-plan", () => {
	it("collectAllTestsAsync returns a sorted array of .test.ts paths", async () => {
		expect.hasAssertions();
		const files = await collectAllTestsAsync(TESTS_ROOT);

		expect(files.length).toBeGreaterThan(0);

		for (const file of files) {
			expect(file).toMatch(/\.test\.ts$/u);
		}

		const sortedCopy = [...files].toSorted();
		expect(files).toStrictEqual(sortedCopy);
	});

	it("getHeavyFiles returns exactly the upstream prevent-abbreviations test", () => {
		expect.assertions(1);
		expect(getHeavyFiles()).toStrictEqual(["tests/upstream/prevent-abbreviations.test.ts"]);
	});

	it("union of all 8 normal shards covers all tests except heavy files", async () => {
		expect.hasAssertions();
		const [allFiles, shardSets] = await Promise.all([
			collectAllTestsAsync(TESTS_ROOT),
			gatherAllNormalShardsAsync(),
		]);
		const heavySet = new Set(getHeavyFiles());

		const union = new Set(shardSets.flat());
		const expected = new Set(allFiles.filter((file) => !heavySet.has(file)));

		expect(union).toStrictEqual(expected);
	});

	it("tests/rules/prevent-abbreviations.test.ts appears in exactly one normal shard", async () => {
		expect.hasAssertions();
		const target = "tests/rules/prevent-abbreviations.test.ts";
		const shardSets = await gatherAllNormalShardsAsync();
		const containingShards = shardSets.filter((files) => files.includes(target));

		expect(containingShards).toHaveLength(1);
	});

	it("tests/rules/naming-convention.test.ts appears in exactly one normal shard", async () => {
		expect.hasAssertions();
		const target = "tests/rules/naming-convention.test.ts";
		const shardSets = await gatherAllNormalShardsAsync();
		const containingShards = shardSets.filter((files) => files.includes(target));

		expect(containingShards).toHaveLength(1);
	});

	it("heavy files do not appear in any normal shard", async () => {
		expect.hasAssertions();
		const heavySet = new Set(getHeavyFiles());
		const shardSets = await gatherAllNormalShardsAsync();

		for (const shardFiles of shardSets) {
			for (const file of shardFiles) {
				expect(heavySet.has(file)).toBe(false);
			}
		}
	});

	it("verifyAssignment reports no missing files across normal shards plus heavy set", async () => {
		expect.hasAssertions();
		const [allFiles, shardSets] = await Promise.all([
			collectAllTestsAsync(TESTS_ROOT),
			gatherAllNormalShardsAsync(),
		]);
		const heavyFiles = getHeavyFiles();

		const result = verifyAssignment(allFiles, shardSets, heavyFiles);

		expect(result.success).toBe(true);
		expect(result.issues).toHaveLength(0);
	});
});
