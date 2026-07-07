import { describe, expect, it } from "vitest";

import {
	collectAllTests,
	getHeavyFiles,
	selectNormalShardFiles,
	verifyAssignment,
} from "../../scripts/test-shard-plan";

function toSortedCopy(values: ReadonlyArray<string>): Array<string> {
	return [...values].toSorted();
}

function countOccurrences(values: ReadonlyArray<string>, target: string): number {
	return values.filter((value) => value === target).length;
}

describe("scripts/test-shard-plan", () => {
	it("collectAllTests('tests') returns a recursively discovered sorted list", () => {
		expect.assertions(1);
		const allFiles = collectAllTests("tests");

		expect(allFiles).toStrictEqual(toSortedCopy(allFiles));
	});

	it.each([
		"tests/rules/prevent-abbreviations.test.ts",
		"tests/rules/naming-convention.test.ts",
		"tests/upstream/prevent-abbreviations.test.ts",
	])("collectAllTests('tests') includes %s", (filePath: string) => {
		expect.assertions(1);
		const allFiles = collectAllTests("tests");

		expect(allFiles).toContain(filePath);
	});

	it("getHeavyFiles() returns the exact heavy file list", () => {
		expect.assertions(1);
		expect(getHeavyFiles()).toStrictEqual(["tests/upstream/prevent-abbreviations.test.ts"]);
	});

	it("selectNormalShardFiles() uses deterministic modulo assignment and excludes only heavy files", () => {
		expect.hasAssertions();
		const totalShards = 8;
		const allFiles = collectAllTests("tests");
		const heavyFiles = getHeavyFiles();
		const heavySet = new Set(heavyFiles);
		const normalFiles = allFiles.filter((file: string) => !heavySet.has(file));

		for (let shardIndex = 1; shardIndex <= totalShards; shardIndex += 1) {
			const shardFiles = selectNormalShardFiles(shardIndex, totalShards, allFiles, heavyFiles);
			const expectedShardFiles = normalFiles.filter(
				(_: string, index: number) => index % totalShards === shardIndex - 1,
			);

			expect(shardFiles).toStrictEqual(expectedShardFiles);
			expect(shardFiles).toStrictEqual(toSortedCopy(shardFiles));
			expect(shardFiles).not.toContain("tests/upstream/prevent-abbreviations.test.ts");
		}
	});

	it("normal shards cover every non-heavy file exactly once across all eight shards", () => {
		expect.assertions(4);
		const totalShards = 8;
		const allFiles = collectAllTests("tests");
		const heavyFiles = getHeavyFiles();
		const normalShardSets = Array.from({ length: totalShards }, (_, shardOffset) =>
			selectNormalShardFiles(shardOffset + 1, totalShards, allFiles, heavyFiles),
		);
		const normalUnion = normalShardSets.flat();
		const heavySet = new Set(heavyFiles);
		const expectedNormalFiles = allFiles.filter((file: string) => !heavySet.has(file));

		expect(normalUnion.toSorted()).toStrictEqual(expectedNormalFiles);
		expect(normalUnion).not.toContain("tests/upstream/prevent-abbreviations.test.ts");
		expect(countOccurrences(normalUnion, "tests/rules/prevent-abbreviations.test.ts")).toBe(1);
		expect(countOccurrences(normalUnion, "tests/rules/naming-convention.test.ts")).toBe(1);
	});

	it.each(["tests/rules/prevent-abbreviations.test.ts", "tests/rules/naming-convention.test.ts"])(
		"%s appears in exactly one normal shard",
		(filePath: string) => {
			expect.assertions(1);
			const totalShards = 8;
			const allFiles = collectAllTests("tests");
			const heavyFiles = getHeavyFiles();
			const normalShardSets = Array.from({ length: totalShards }, (_, shardOffset) =>
				selectNormalShardFiles(shardOffset + 1, totalShards, allFiles, heavyFiles),
			);
			const appearances = normalShardSets.flat().filter((file: string) => file === filePath).length;

			expect(appearances).toBe(1);
		},
	);

	it("verifyAssignment() accepts the full normal shard union plus the heavy set", () => {
		expect.assertions(1);
		const totalShards = 8;
		const allFiles = collectAllTests("tests");
		const heavyFiles = getHeavyFiles();
		const normalShardSets = Array.from({ length: totalShards }, (_, shardOffset) =>
			selectNormalShardFiles(shardOffset + 1, totalShards, allFiles, heavyFiles),
		);

		expect(verifyAssignment(allFiles, normalShardSets, heavyFiles)).toStrictEqual({
			issues: [],
			success: true,
		});
	});
});
