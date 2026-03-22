import { describe, expect, it } from "bun:test";

import {
	getStaleDeclarationSupportPaths,
	normalizeDeclarationSupportPaths,
} from "../../scripts/utilities/declaration-support-cache";

describe("declaration-support-cache", () => {
	it("normalizes support declaration paths deterministically", () => {
		expect(normalizeDeclarationSupportPaths(["b.d.ts", "a.d.ts", "b.d.ts", "dir/c.d.ts"])).toEqual([
			"a.d.ts",
			"b.d.ts",
			"dir/c.d.ts",
		]);
	});

	it("computes stale support declaration paths", () => {
		expect(getStaleDeclarationSupportPaths(["a.d.ts", "b.d.ts", "dir/c.d.ts"], ["b.d.ts", "dir/c.d.ts"])).toEqual([
			"a.d.ts",
		]);
	});
});
