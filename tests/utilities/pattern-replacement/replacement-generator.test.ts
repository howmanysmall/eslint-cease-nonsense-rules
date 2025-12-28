import { describe, expect, it } from "bun:test";
import {
	generateReplacement,
	getReplacementIdentifier,
} from "../../../src/utilities/pattern-replacement/replacement-generator";
import type { CapturedValue, ParsedReplacement } from "../../../src/utilities/pattern-replacement/pattern-types";

describe("getReplacementIdentifier", () => {
	it("should return name for identifier replacement", () => {
		const replacement: ParsedReplacement = { kind: "identifier", name: "zero" };
		expect(getReplacementIdentifier(replacement)).toBe("zero");
	});

	it("should return name for call replacement", () => {
		const replacement: ParsedReplacement = { args: ["$x"], kind: "call", name: "fromX" };
		expect(getReplacementIdentifier(replacement)).toBe("fromX");
	});

	it("should return undefined for static access", () => {
		const replacement: ParsedReplacement = { kind: "staticAccess", prop: "zero", typeName: "Vector2" };
		expect(getReplacementIdentifier(replacement)).toBeUndefined();
	});
});

describe("generateReplacement", () => {
	it("should generate identifier replacement", () => {
		const replacement: ParsedReplacement = { kind: "identifier", name: "zero" };
		const captures = new Map<string, CapturedValue>();
		expect(generateReplacement(replacement, captures)).toBe("zero");
	});

	it("should generate static access replacement", () => {
		const replacement: ParsedReplacement = { kind: "staticAccess", prop: "zero", typeName: "Vector2" };
		const captures = new Map<string, CapturedValue>();
		expect(generateReplacement(replacement, captures)).toBe("Vector2.zero");
	});

	it("should generate call replacement with captures", () => {
		const replacement: ParsedReplacement = { args: ["$x"], kind: "call", name: "fromX" };
		const captures = new Map<string, CapturedValue>([
			["x", { constValue: 0.5, exprKey: "literal:0.5", isComplex: false, node: {} as never, sourceText: "0.5" }],
		]);
		expect(generateReplacement(replacement, captures)).toBe("fromX(0.5)");
	});

	it("should generate call replacement with multiple captures", () => {
		const replacement: ParsedReplacement = { args: ["$x", "$y"], kind: "call", name: "combine" };
		const captures = new Map<string, CapturedValue>([
			["x", { constValue: 1, exprKey: "literal:1", isComplex: false, node: {} as never, sourceText: "1" }],
			["y", { constValue: 2, exprKey: "literal:2", isComplex: false, node: {} as never, sourceText: "2" }],
		]);
		expect(generateReplacement(replacement, captures)).toBe("combine(1, 2)");
	});

	it("should generate call replacement with literal args", () => {
		const replacement: ParsedReplacement = { args: ["2"], kind: "call", name: "scale" };
		const captures = new Map<string, CapturedValue>();
		expect(generateReplacement(replacement, captures)).toBe("scale(2)");
	});

	it("should preserve identifier source text", () => {
		const replacement: ParsedReplacement = { args: ["$x"], kind: "call", name: "fromX" };
		const captures = new Map<string, CapturedValue>([
			["x", { exprKey: "id:myVar", isComplex: false, node: {} as never, sourceText: "myVar" }],
		]);
		expect(generateReplacement(replacement, captures)).toBe("fromX(myVar)");
	});

	it("should throw error when capture is missing", () => {
		const replacement: ParsedReplacement = { args: ["$x"], kind: "call", name: "fromX" };
		const captures = new Map<string, CapturedValue>();
		expect(() => generateReplacement(replacement, captures)).toThrow("Missing capture: x");
	});

	it("should handle mixed literal and capture args", () => {
		const replacement: ParsedReplacement = { args: ["$x", "10", "$y"], kind: "call", name: "clamp" };
		const captures = new Map<string, CapturedValue>([
			["x", { constValue: 5, exprKey: "literal:5", isComplex: false, node: {} as never, sourceText: "5" }],
			["y", { constValue: 15, exprKey: "literal:15", isComplex: false, node: {} as never, sourceText: "15" }],
		]);
		expect(generateReplacement(replacement, captures)).toBe("clamp(5, 10, 15)");
	});
});
