import { describe, expect, it, vi } from "vitest";
import { generateReplacement, getReplacementIdentifier } from "$utilities/pattern-replacement/replacement-generator";
import { AST_NODE_TYPES } from "@typescript-eslint/types";

import type { CapturedValue, ParsedReplacement } from "$utilities/pattern-replacement/pattern-types";
import type { TSESTree } from "@typescript-eslint/types";

vi.setConfig({ testTimeout: 10000 });

describe("pattern-replacement utilities", () => {
	describe("getReplacementIdentifier", () => {
		it("should return identifier name for identifier replacement", () => {
			expect.assertions(1);
			const replacement: ParsedReplacement = {
				kind: "identifier",
				name: "Vector2.zero",
			};
			expect(getReplacementIdentifier(replacement)).toBe("Vector2.zero");
		});

		it("should return function name for call replacement", () => {
			expect.assertions(1);
			const replacement: ParsedReplacement = {
				kind: "call",
				name: "fromX",
				parameters: [],
			};
			expect(getReplacementIdentifier(replacement)).toBe("fromX");
		});

		it("should return undefined for static access replacement", () => {
			expect.assertions(1);
			const replacement: ParsedReplacement = {
				kind: "staticAccess",
				property: "zero",
				typeName: "Vector2",
			};
			expect(getReplacementIdentifier(replacement)).toBeUndefined();
		});
	});

	describe("generateReplacement", () => {
		it("should generate identifier replacement", () => {
			expect.assertions(1);
			const replacement: ParsedReplacement = {
				kind: "identifier",
				name: "Vector2.zero",
			};
			const captures = new Map<string, CapturedValue>();
			expect(generateReplacement(replacement, captures)).toBe("Vector2.zero");
		});

		it("should generate static access replacement", () => {
			expect.assertions(1);
			const replacement: ParsedReplacement = {
				kind: "staticAccess",
				property: "zero",
				typeName: "Vector2",
			};
			const captures = new Map<string, CapturedValue>();
			expect(generateReplacement(replacement, captures)).toBe("Vector2.zero");
		});

		it("should generate call replacement with literal args", () => {
			expect.assertions(1);
			const replacement: ParsedReplacement = {
				kind: "call",
				name: "fromValues",
				parameters: ["1", "2"],
			};
			const captures = new Map<string, CapturedValue>();
			expect(generateReplacement(replacement, captures)).toBe("fromValues(1, 2)");
		});

		it("should generate call replacement with captured args", () => {
			expect.assertions(1);
			const replacement: ParsedReplacement = {
				kind: "call",
				name: "fromValues",
				parameters: ["$x", "$y"],
			};
			// @ts-expect-error - We only need the properties used by generateReplacement, so we can mock the node with a partial
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
				["x", { constValue: 5, expressionKey: "literal:5", isComplex: false, node: mockNode, sourceText: "5" }],
				[
					"y",
					{ constValue: 10, expressionKey: "literal:10", isComplex: false, node: mockNode, sourceText: "10" },
				],
			]);
			expect(generateReplacement(replacement, captures)).toBe("fromValues(5, 10)");
		});

		it("should throw error for missing capture", () => {
			expect.assertions(1);
			const replacement: ParsedReplacement = {
				kind: "call",
				name: "fromX",
				parameters: ["$x"],
			};
			const captures = new Map<string, CapturedValue>();
			expect(() => generateReplacement(replacement, captures)).toThrow("Missing capture: x");
		});

		it("should throw error for unknown replacement kind", () => {
			expect.assertions(1);
			const captures = new Map<string, CapturedValue>();
			expect(() =>
				generateReplacement(
					{
						// @ts-expect-error - We are intentionally testing an invalid replacement kind, so we can mock it with a partial
						kind: "unknown",
					},
					captures,
				),
			).toThrow("Unknown replacement kind: unknown");
		});
	});
});
