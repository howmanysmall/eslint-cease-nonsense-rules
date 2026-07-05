import { describe, expect, it } from "vitest";
import { __testingResolveWorkerPath, formatSync, terminateWorker } from "$oxfmt-sync";

function withTerminatedWorker<Result>(run: () => Result): Result {
	try {
		return run();
	} finally {
		terminateWorker();
	}
}

describe("oxfmt-sync", () => {
	it("formats basic TypeScript code", () => {
		expect.assertions(1);
		withTerminatedWorker(() => {
			const result = formatSync("test.ts", "const x=1", { useTabs: true });
			expect(result).toBe("const x = 1;\n");
		});
	}, 1000);

	it("formats code with correct indentation", () => {
		expect.assertions(1);
		withTerminatedWorker(() => {
			const result = formatSync("test.ts", "function foo() {\nreturn 42;\n}", { useTabs: true });
			expect(result).toBe("function foo() {\n\treturn 42;\n}\n");
		});
	}, 1000);

	it("handles already formatted code", () => {
		expect.assertions(1);
		withTerminatedWorker(() => {
			const formatted = "const x = 1;\n";
			const result = formatSync("test.ts", formatted, { useTabs: true });
			expect(result).toBe(formatted);
		});
	}, 1000);

	it("formats TSX files", () => {
		expect.assertions(1);
		withTerminatedWorker(() => {
			const result = formatSync("component.tsx", "const el=<div></div>", { useTabs: true });
			expect(result).toBe("const el = <div></div>;\n");
		});
	}, 1000);

	it("formats JavaScript files", () => {
		expect.assertions(1);
		withTerminatedWorker(() => {
			const result = formatSync("script.js", "var x=1", { useTabs: true });
			expect(result).toBe("var x = 1;\n");
		});
	}, 1000);

	it("respects formatting options", () => {
		expect.assertions(1);
		withTerminatedWorker(() => {
			const result = formatSync("test.ts", "const x = 1", { semi: false, useTabs: true });
			expect(result).toBe("const x = 1\n");
		});
	}, 1000);

	it("throws if it cannot resolve the worker path", () => {
		expect.assertions(1);
		expect(() => __testingResolveWorkerPath(new URL("file:///tmp/oxfmt-sync.test.ts"), () => false)).toThrow(Error);
	}, 1000);

	it("prefers the built worker when both files exist", () => {
		expect.assertions(2);
		const existingPaths = new Set<string>(["/tmp/oxfmt-worker.js", "/tmp/oxfmt-worker.ts"]);
		const result = __testingResolveWorkerPath(new URL("file:///tmp/oxfmt-sync.test.ts"), (path): boolean =>
			existingPaths.has(path),
		);
		expect(result.pathname.endsWith("oxfmt-worker.js")).toBe(true);
		expect(result.pathname.endsWith("oxfmt-worker.ts")).toBe(false);
	}, 1000);

	it("terminates the worker idempotently", () => {
		expect.assertions(1);
		formatSync("test.ts", "const x=1", { useTabs: true });
		terminateWorker();
		terminateWorker();
		expect(true).toBe(true);
	}, 1000);
});
