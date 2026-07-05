import { describe, expect, it } from "vitest";
import { __testingResolveWorkerPath } from "@oxfmt-sync";

describe("oxfmt-sync coverage", () => {
	it("resolves the TypeScript worker when JavaScript output is missing", () => {
		expect.assertions(2);
		const result = __testingResolveWorkerPath(new URL("file:///tmp/oxfmt-sync.test.ts"), (path): boolean =>
			path.endsWith("oxfmt-worker.ts"),
		);
		expect(result.pathname.endsWith("oxfmt-worker.ts")).toBe(true);
		expect(result.pathname.endsWith("oxfmt-worker.js")).toBe(false);
	}, 1000);

	it("throws when neither JavaScript nor TypeScript worker files exist", () => {
		expect.assertions(1);
		expect(() =>
			__testingResolveWorkerPath(new URL("file:///tmp/oxfmt-sync.test.ts"), (): boolean => false),
		).toThrow(Error);
	}, 1000);
});
