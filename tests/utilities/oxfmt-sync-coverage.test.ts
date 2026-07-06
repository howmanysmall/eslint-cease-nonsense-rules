import { describe, expect, it } from "vitest";
import {
	__testingAssertFormatWaitCompleted,
	__testingReadFormatResponse,
	__testingResolveWorkerPath,
} from "$oxfmt-sync";

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

	it("reads successful worker responses", () => {
		expect.assertions(1);
		expect(__testingReadFormatResponse({ message: { code: "const value = 1;\n" } })).toBe("const value = 1;\n");
	});

	it("rejects missing worker responses", () => {
		expect.assertions(1);
		expect(() => __testingReadFormatResponse(undefined)).toThrow("No response received from oxfmt worker");
	});

	it("rejects invalid worker responses", () => {
		expect.assertions(1);
		expect(() => __testingReadFormatResponse({ message: { code: 1 } })).toThrow(
			"Invalid response received from oxfmt worker",
		);
	});

	it("rejects worker error responses", () => {
		expect.assertions(1);
		expect(() => __testingReadFormatResponse({ message: { error: "format failed" } })).toThrow("format failed");
	});

	it("rejects worker responses without formatted code", () => {
		expect.assertions(1);
		expect(() => __testingReadFormatResponse({ message: {} })).toThrow("Oxfmt returned undefined code");
	});

	it("accepts completed wait results", () => {
		expect.assertions(2);
		expect(() => {
			__testingAssertFormatWaitCompleted("ok");
		}).not.toThrow();
		expect(() => {
			__testingAssertFormatWaitCompleted("not-equal");
		}).not.toThrow();
	});

	it("rejects timed-out wait results", () => {
		expect.assertions(1);
		expect(() => {
			__testingAssertFormatWaitCompleted("timed-out");
		}).toThrow("Oxfmt timed out after 30000ms");
	});
});
