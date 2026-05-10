import { afterAll, describe, expect, it } from "vitest";
import { __testingResolveWorkerPath, formatSync, terminateWorker } from "@oxfmt-sync";

describe("oxfmt-sync", () => {
	afterAll(() => {
		terminateWorker();
	});

	it("formats basic TypeScript code", () => {
		expect.assertions(1);
		const result = formatSync("test.ts", "const x=1", { useTabs: true });
		expect(result).toBe("const x = 1;\n");
	}, 1000);

	it("formats code with correct indentation", () => {
		expect.assertions(1);
		const result = formatSync("test.ts", "function foo() {\nreturn 42;\n}", { useTabs: true });
		expect(result).toBe("function foo() {\n\treturn 42;\n}\n");
	}, 1000);

	it("handles already formatted code", () => {
		expect.assertions(1);
		const formatted = "const x = 1;\n";
		const result = formatSync("test.ts", formatted, { useTabs: true });
		expect(result).toBe(formatted);
	}, 1000);

	it("formats TSX files", () => {
		expect.assertions(1);
		const result = formatSync("component.tsx", "const el=<div></div>", { useTabs: true });
		expect(result).toBe("const el = <div></div>;\n");
	}, 1000);

	it("formats JavaScript files", () => {
		expect.assertions(1);
		const result = formatSync("script.js", "var x=1", { useTabs: true });
		expect(result).toBe("var x = 1;\n");
	}, 1000);

	it("respects formatting options", () => {
		expect.assertions(1);
		const result = formatSync("test.ts", "const x = 1", { semi: false, useTabs: true });
		expect(result).toBe("const x = 1\n");
	}, 1000);

	it("throws if it cannot resolve the worker path", () => {
		expect.assertions(1);
		expect(() => __testingResolveWorkerPath(new URL("file:///tmp/oxfmt-sync.test.ts"), () => false)).toThrow();
	}, 1000);
});
