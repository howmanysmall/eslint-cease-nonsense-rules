import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { getHeavyFiles } from "../../scripts/test-shard-plan";

const CI_YAML = readFileSync(".github/workflows/ci.yaml", "utf8");
const CHECKS_YAML = readFileSync(".github/workflows/checks.yaml", "utf8");
const RELEASE_YAML = readFileSync(".github/workflows/release.yaml", "utf8");
const LOCAL_CI_SH = readFileSync("scripts/local-ci.sh", "utf8");
const HEAVY_FILES = getHeavyFiles();

describe("checks-workflow-sharding", () => {
	it("neither test nor test-heavy job has a needs: validate declaration", () => {
		expect.assertions(1);
		expect(CHECKS_YAML).not.toMatch(/^\s+needs:\s+validate\s*$/mu);
	});

	it("test job normal shard matrix is [1, 2, 3, 4, 5, 6, 7, 8]", () => {
		expect.assertions(1);
		expect(CHECKS_YAML).toMatch(/shard:\s+\[1,\s*2,\s*3,\s*4,\s*5,\s*6,\s*7,\s*8\]/u);
	});

	it("both test matrices keep fail-fast: false", () => {
		expect.assertions(1);
		const failFastMatches = [...CHECKS_YAML.matchAll(/fail-fast:\s+false/gu)];
		expect(failFastMatches.length).toBeGreaterThanOrEqual(2);
	});

	it("test-heavy job matrix case_shard is [1, 2, 3, 4]", () => {
		expect.assertions(1);
		expect(CHECKS_YAML).toMatch(/case_shard:\s+\[1,\s*2,\s*3,\s*4\]/u);
	});

	it("old grep filter blocking orphaned test files is removed", () => {
		expect.assertions(1);
		expect(CHECKS_YAML).not.toContain("grep -v -E");
	});

	it("normal shard step uses the --normal-lane manifest CLI flag", () => {
		expect.assertions(1);
		expect(CHECKS_YAML).toContain("--normal-lane");
	});

	it("manifest heavy file list has exactly one entry", () => {
		expect.assertions(1);
		expect(HEAVY_FILES).toHaveLength(1);
	});

	it("test-heavy matrix file section contains all manifest heavy files", () => {
		expect.hasAssertions();
		for (const file of HEAVY_FILES) expect(CHECKS_YAML).toContain(file);
	});
});

describe("ci-workflow-sharding", () => {
	it("delegates checks to the reusable checks workflow", () => {
		expect.assertions(1);
		expect(CI_YAML).toContain("uses: ./.github/workflows/checks.yaml");
	});
});

describe("release-workflow-sharding", () => {
	it("delegates checks to the reusable checks workflow after release validation", () => {
		expect.assertions(1);
		expect(RELEASE_YAML).toMatch(
			/checks:\s+needs:\s+validate-release\s+uses: \.\/\.github\/workflows\/checks\.yaml/u,
		);
	});
});

describe("local-ci-sharding", () => {
	it("local-ci.sh sharded mode uses --normal-lane manifest CLI flag", () => {
		expect.assertions(1);
		expect(LOCAL_CI_SH).toContain("--normal-lane");
	});

	it("local-ci.sh defines HEAVY_TEST_SHARDS with default 4 when unset", () => {
		expect.assertions(1);
		expect(LOCAL_CI_SH).toContain("HEAVY_TEST_SHARDS:-4");
	});

	it("local-ci.sh runs manifest heavy files with TEST_CASE_SHARD env variable", () => {
		expect.assertions(1);
		expect(LOCAL_CI_SH).toContain("TEST_CASE_SHARD");
	});
});
