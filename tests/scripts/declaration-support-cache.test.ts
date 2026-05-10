import { describe, expect, it } from "vitest";

import {
	getStaleDeclarationSupportPaths,
	normalizeDeclarationSupportPaths,
} from "../../scripts/utilities/declaration-support-cache";

describe("declaration-support-cache", () => {
	it("normalizes support declaration paths deterministically", () => {
		expect.assertions(1);
		expect(normalizeDeclarationSupportPaths(["b.d.ts", "a.d.ts", "b.d.ts", "dir/c.d.ts"])).toStrictEqual([
			"a.d.ts",
			"b.d.ts",
			"dir/c.d.ts",
		]);
	}, 500);

	it("computes stale support declaration paths", () => {
		expect.assertions(1);
		expect(
			getStaleDeclarationSupportPaths(["a.d.ts", "b.d.ts", "dir/c.d.ts"], ["b.d.ts", "dir/c.d.ts"]),
		).toStrictEqual(["a.d.ts"]);
	}, 500);
});
