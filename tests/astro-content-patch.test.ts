import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ASTRO_PATCH_FILE_URL = new URL("../patches/astro@6.1.1.patch", import.meta.url);
const TYPED_ANY_PATTERN = /:\s*any\b|\bany\[\]|=>\s*any\b|=\s*any\b/u;

function getAddedPatchLines(patchText: string): Array<string> {
	return patchText
		.split("\n")
		.filter((line) => line.startsWith("+") && !line.startsWith("+++"))
		.map((line) => line.slice(1));
}

function readPatchFile(): string {
	return readFileSync(fileURLToPath(ASTRO_PATCH_FILE_URL), "utf8");
}

describe("astro content patch", () => {
	it("commits an Astro fallback type patch without explicit typed any", () => {
		expect.assertions(3);
		const patchText = readPatchFile();

		expect(patchText).toContain("diff --git a/types/content.d.ts b/types/content.d.ts");
		expect(patchText).toContain("title?: string;");

		const addedLines = getAddedPatchLines(patchText);
		const typedAnyLines = addedLines.filter((line) => TYPED_ANY_PATTERN.test(line));

		expect(typedAnyLines).toStrictEqual([]);
	}, 1000);
});
