import { describe, expect, it, vi } from "vitest";
import { parseParameters, parsePattern, parseReplacement } from "$utilities/pattern-replacement/pattern-parser";

vi.setConfig({ testTimeout: 500 });

describe("parseArgs", () => {
	it("should parse literal number", () => {
		expect.assertions(1);

		const args = parseParameters("1, 2");
		expect(args).toStrictEqual([
			{ kind: "literal", value: 1 },
			{ kind: "literal", value: 2 },
		]);
	});

	it("should parse optional with ?", () => {
		expect.assertions(1);

		const args = parseParameters("0?");
		expect(args).toStrictEqual([{ kind: "optional", value: 0 }]);
	});

	it("should parse capture with $", () => {
		expect.assertions(1);

		const args = parseParameters("$x, $y");
		expect(args).toStrictEqual([
			{ kind: "capture", name: "x" },
			{ kind: "capture", name: "y" },
		]);
	});

	it("should parse wildcard _", () => {
		expect.assertions(1);

		const args = parseParameters("$x, _");
		expect(args).toStrictEqual([{ kind: "capture", name: "x" }, { kind: "wildcard" }]);
	});

	it("should parse mixed args", () => {
		expect.assertions(1);

		const args = parseParameters("$x, 0?, 1");
		expect(args).toStrictEqual([
			{ kind: "capture", name: "x" },
			{ kind: "optional", value: 0 },
			{ kind: "literal", value: 1 },
		]);
	});

	it("should handle empty args", () => {
		expect.assertions(1);

		const args = parseParameters("");
		expect(args).toStrictEqual([]);
	});

	it("should parse negative numbers", () => {
		expect.assertions(1);

		const args = parseParameters("-1, -0.5");
		expect(args).toStrictEqual([
			{ kind: "literal", value: -1 },
			{ kind: "literal", value: -0.5 },
		]);
	});
});

describe("parseReplacement", () => {
	it("should parse simple identifier", () => {
		expect.assertions(1);

		const result = parseReplacement("zero");
		expect(result).toStrictEqual({ kind: "identifier", name: "zero" });
	});

	it("should parse static access", () => {
		expect.assertions(1);

		const result = parseReplacement("Vector2.zero");
		expect(result).toStrictEqual({ kind: "staticAccess", property: "zero", typeName: "Vector2" });
	});

	it("should parse function call", () => {
		expect.assertions(1);

		const result = parseReplacement("fromX($x)");
		expect(result).toStrictEqual({ kind: "call", name: "fromX", parameters: ["$x"] });
	});

	it("should parse function call with multiple args", () => {
		expect.assertions(1);

		const result = parseReplacement("combine($x, $y)");
		expect(result).toStrictEqual({ kind: "call", name: "combine", parameters: ["$x", "$y"] });
	});

	it("should parse function call with literal args", () => {
		expect.assertions(1);

		const result = parseReplacement("scale(2)");
		expect(result).toStrictEqual({ kind: "call", name: "scale", parameters: ["2"] });
	});
});

describe("parsePattern", () => {
	it("should parse constructor pattern", () => {
		expect.assertions(4);

		const result = parsePattern("new Vector2(0, 0)", "Vector2.zero", undefined);
		expect(result.type).toBe("constructor");
		expect(result.typeName).toBe("Vector2");
		expect(result.methodName).toBeUndefined();
		expect(result.parameters).toHaveLength(2);
	});

	it("should parse static method pattern", () => {
		expect.assertions(3);

		const result = parsePattern("UDim2.fromScale(1, 1)", "oneScale", undefined);
		expect(result.type).toBe("staticMethod");
		expect(result.typeName).toBe("UDim2");
		expect(result.methodName).toBe("fromScale");
	});

	it("should parse conditions from when clause", () => {
		expect.assertions(1);

		const result = parsePattern("new Vector2($x, $x)", "fromUniform($x)", { x: "!= 0" });
		expect(result.conditions.get("x")).toBe("!= 0");
	});

	it("should throw on invalid pattern", () => {
		expect.assertions(1);

		expect(() => parsePattern("invalid", "something", undefined)).toThrow("Invalid pattern: invalid");
	});
});
