import { describe, expect, it } from "bun:test";
import { parseArgs, parsePattern, parseReplacement } from "../../../src/utilities/pattern-replacement/pattern-parser";

describe("parseArgs", () => {
	it("should parse literal number", () => {
		const args = parseArgs("1, 2");
		expect(args).toEqual([
			{ kind: "literal", value: 1 },
			{ kind: "literal", value: 2 },
		]);
	});

	it("should parse optional with ?", () => {
		const args = parseArgs("0?");
		expect(args).toEqual([{ kind: "optional", value: 0 }]);
	});

	it("should parse capture with $", () => {
		const args = parseArgs("$x, $y");
		expect(args).toEqual([
			{ kind: "capture", name: "x" },
			{ kind: "capture", name: "y" },
		]);
	});

	it("should parse wildcard _", () => {
		const args = parseArgs("$x, _");
		expect(args).toEqual([{ kind: "capture", name: "x" }, { kind: "wildcard" }]);
	});

	it("should parse mixed args", () => {
		const args = parseArgs("$x, 0?, 1");
		expect(args).toEqual([
			{ kind: "capture", name: "x" },
			{ kind: "optional", value: 0 },
			{ kind: "literal", value: 1 },
		]);
	});

	it("should handle empty args", () => {
		const args = parseArgs("");
		expect(args).toEqual([]);
	});

	it("should parse negative numbers", () => {
		const args = parseArgs("-1, -0.5");
		expect(args).toEqual([
			{ kind: "literal", value: -1 },
			{ kind: "literal", value: -0.5 },
		]);
	});
});

describe("parseReplacement", () => {
	it("should parse simple identifier", () => {
		const result = parseReplacement("zero");
		expect(result).toEqual({ kind: "identifier", name: "zero" });
	});

	it("should parse static access", () => {
		const result = parseReplacement("Vector2.zero");
		expect(result).toEqual({ kind: "staticAccess", prop: "zero", typeName: "Vector2" });
	});

	it("should parse function call", () => {
		const result = parseReplacement("fromX($x)");
		expect(result).toEqual({ args: ["$x"], kind: "call", name: "fromX" });
	});

	it("should parse function call with multiple args", () => {
		const result = parseReplacement("combine($x, $y)");
		expect(result).toEqual({ args: ["$x", "$y"], kind: "call", name: "combine" });
	});

	it("should parse function call with literal args", () => {
		const result = parseReplacement("scale(2)");
		expect(result).toEqual({ args: ["2"], kind: "call", name: "scale" });
	});
});

describe("parsePattern", () => {
	it("should parse constructor pattern", () => {
		const result = parsePattern("new Vector2(0, 0)", "Vector2.zero", undefined);
		expect(result.type).toBe("constructor");
		expect(result.typeName).toBe("Vector2");
		expect(result.methodName).toBeUndefined();
		expect(result.args).toHaveLength(2);
	});

	it("should parse static method pattern", () => {
		const result = parsePattern("UDim2.fromScale(1, 1)", "oneScale", undefined);
		expect(result.type).toBe("staticMethod");
		expect(result.typeName).toBe("UDim2");
		expect(result.methodName).toBe("fromScale");
	});

	it("should parse conditions from when clause", () => {
		const result = parsePattern("new Vector2($x, $x)", "fromUniform($x)", { x: "!= 0" });
		expect(result.conditions.get("x")).toBe("!= 0");
	});

	it("should throw on invalid pattern", () => {
		expect(() => parsePattern("invalid", "something", undefined)).toThrow("Invalid pattern: invalid");
	});
});
