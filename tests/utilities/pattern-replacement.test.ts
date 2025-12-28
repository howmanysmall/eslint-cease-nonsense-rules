import { describe, expect, it } from "bun:test";
import { AST_NODE_TYPES } from "@typescript-eslint/types";
import type { TSESTree } from "@typescript-eslint/types";
import { generateReplacement, getReplacementIdentifier } from "../../src/utilities/pattern-replacement";
import type { CapturedValue, ParsedReplacement } from "../../src/utilities/pattern-replacement/pattern-types";

describe("pattern-replacement utilities", () => {
	describe("getReplacementIdentifier", () => {
		it("should return identifier name for identifier replacement", () => {
			const replacement: ParsedReplacement = {
				kind: "identifier",
				name: "Vector2.zero",
			};
			expect(getReplacementIdentifier(replacement)).toBe("Vector2.zero");
		});

		it("should return function name for call replacement", () => {
			const replacement: ParsedReplacement = {
				args: [],
				kind: "call",
				name: "fromX",
			};
			expect(getReplacementIdentifier(replacement)).toBe("fromX");
		});

		it("should return undefined for static access replacement", () => {
			const replacement: ParsedReplacement = {
				kind: "staticAccess",
				prop: "zero",
				typeName: "Vector2",
			};
			expect(getReplacementIdentifier(replacement)).toBeUndefined();
		});
	});

	describe("generateReplacement", () => {
		it("should generate identifier replacement", () => {
			const replacement: ParsedReplacement = {
				kind: "identifier",
				name: "Vector2.zero",
			};
			const captures = new Map<string, CapturedValue>();
			expect(generateReplacement(replacement, captures)).toBe("Vector2.zero");
		});

		it("should generate static access replacement", () => {
			const replacement: ParsedReplacement = {
				kind: "staticAccess",
				prop: "zero",
				typeName: "Vector2",
			};
			const captures = new Map<string, CapturedValue>();
			expect(generateReplacement(replacement, captures)).toBe("Vector2.zero");
		});

		it("should generate call replacement with literal args", () => {
			const replacement: ParsedReplacement = {
				args: ["1", "2"],
				kind: "call",
				name: "fromValues",
			};
			const captures = new Map<string, CapturedValue>();
			expect(generateReplacement(replacement, captures)).toBe("fromValues(1, 2)");
		});

		it("should generate call replacement with captured args", () => {
			const replacement: ParsedReplacement = {
				args: ["$x", "$y"],
				kind: "call",
				name: "fromValues",
			};
			const mockNode: TSESTree.Literal = {
				loc: {
					end: { column: 2, line: 1 },
					start: { column: 0, line: 1 },
				},
				range: [0, 2],
				type: AST_NODE_TYPES.Literal,
				value: 5,
			};
			const captures = new Map<string, CapturedValue>([
				["x", { constValue: 5, exprKey: "literal:5", isComplex: false, node: mockNode, sourceText: "5" }],
				["y", { constValue: 10, exprKey: "literal:10", isComplex: false, node: mockNode, sourceText: "10" }],
			]);
			expect(generateReplacement(replacement, captures)).toBe("fromValues(5, 10)");
		});

		it("should throw error for missing capture", () => {
			const replacement: ParsedReplacement = {
				args: ["$x"],
				kind: "call",
				name: "fromX",
			};
			const captures = new Map<string, CapturedValue>();
			expect(() => generateReplacement(replacement, captures)).toThrow("Missing capture: x");
		});

		it("should throw error for unknown replacement kind", () => {
			const replacement = {
				kind: "unknown",
			} as unknown as ParsedReplacement;
			const captures = new Map<string, CapturedValue>();
			expect(() => generateReplacement(replacement, captures)).toThrow("Unknown replacement kind: unknown");
		});
	});
});
