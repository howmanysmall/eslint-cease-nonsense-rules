import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { getHeavyFiles } from "../../scripts/test-shard-plan";

const CI_YAML = readFileSync(".github/workflows/ci.yaml", "utf8");
const CHECKS_YAML = readFileSync(".github/workflows/checks.yaml", "utf8");
const RELEASE_YAML = readFileSync(".github/workflows/release.yaml", "utf8");
const LOCAL_CI_SH = readFileSync("scripts/local-ci.sh", "utf8");
const HEAVY_FILES = getHeavyFiles();

describe("checks-workflow-sharding", () => {
	it("runs repository validation in one job", () => {
		expect.assertions(1);
		expect(CHECKS_YAML).not.toContain("matrix.name");
	});

	it("test job normal shard matrix is [1, 2, 3, 4, 5, 6, 7, 8]", () => {
		expect.assertions(1);
		expect(CHECKS_YAML).toMatch(/shard:\s+\[1,\s*2,\s*3,\s*4,\s*5,\s*6,\s*7,\s*8\]/u);
	});

	it("the test matrix keeps fail-fast disabled", () => {
		expect.assertions(1);
		const failFastMatches = [...CHECKS_YAML.matchAll(/fail-fast:\s+false/gu)];
		expect(failFastMatches).toHaveLength(1);
	});

	it("does not launch dedicated heavy-test runners", () => {
		expect.assertions(1);
		expect(CHECKS_YAML).not.toContain("test-heavy:");
	});

	it("old grep filter blocking orphaned test files is removed", () => {
		expect.assertions(1);
		expect(CHECKS_YAML).not.toContain("grep -v -E");
	});

	it("normal shard step uses the --normal-lane manifest CLI flag", () => {
		expect.assertions(1);
		expect(CHECKS_YAML).toContain("--normal-lane");
	});

	it("uses compact Vitest reporting in CI", () => {
		expect.assertions(1);
		expect(CHECKS_YAML).toContain("--reporter github-actions --reporter dot");
	});

	it("manifest heavy file list has exactly one entry", () => {
		expect.assertions(1);
		expect(HEAVY_FILES).toHaveLength(1);
	});

	it("runs every manifest heavy file on an existing test runner", () => {
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
	it("does not rerun CI checks for a tag already validated on main", () => {
		expect.assertions(1);
		expect(RELEASE_YAML).not.toContain("uses: ./.github/workflows/checks.yaml");
	});

	it("waits for the matching main-branch CI run before publishing", () => {
		expect.assertions(2);
		expect(RELEASE_YAML).toContain('gh run list --workflow ci.yaml --commit "$GITHUB_SHA"');
		expect(RELEASE_YAML).toContain('gh run watch "$CI_RUN_ID" --exit-status');
	});

	it("does not explicitly build before pnpm runs prepublishOnly", () => {
		expect.assertions(1);
		expect(RELEASE_YAML).not.toContain("name: Build");
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
