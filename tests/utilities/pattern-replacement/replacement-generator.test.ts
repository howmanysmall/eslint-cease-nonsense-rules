import { describe, expect, it, vi } from "vitest";
import { parse } from "@typescript-eslint/parser";
import { AST_NODE_TYPES } from "@typescript-eslint/types";
import { generateReplacement, getReplacementIdentifier } from "@utilities/pattern-replacement/replacement-generator";

import type { TSESTree } from "@typescript-eslint/types";

import type { CapturedValue, ParsedReplacement } from "../../../src/utilities/pattern-replacement/pattern-types";

function parseExpression(code: string): TSESTree.Expression {
	const program = parse(`const value = ${code};`, { loc: false, range: false });
	const [statement] = program.body;
	if (statement?.type !== AST_NODE_TYPES.VariableDeclaration) throw new Error(`Could not parse expression: ${code}`);

	const [declaration] = statement.declarations;
	const expression = declaration?.init;
	if (expression === null || expression === undefined) throw new Error(`Could not parse expression: ${code}`);

	return expression;
}

vi.setConfig({ testTimeout: 500 });

describe("getReplacementIdentifier", () => {
	it("should return name for identifier replacement", () => {
		expect.assertions(1);

		const replacement: ParsedReplacement = { kind: "identifier", name: "zero" };
		expect(getReplacementIdentifier(replacement)).toBe("zero");
	});

	it("should return name for call replacement", () => {
		expect.assertions(1);

		const replacement: ParsedReplacement = { kind: "call", name: "fromX", parameters: ["$x"] };
		expect(getReplacementIdentifier(replacement)).toBe("fromX");
	});

	it("should return undefined for static access", () => {
		expect.assertions(1);

		const replacement: ParsedReplacement = { kind: "staticAccess", property: "zero", typeName: "Vector2" };
		expect(getReplacementIdentifier(replacement)).toBeUndefined();
	});
});

describe("generateReplacement", () => {
	it("should generate identifier replacement", () => {
		expect.assertions(1);

		const replacement: ParsedReplacement = { kind: "identifier", name: "zero" };
		const captures = new Map<string, CapturedValue>();
		expect(generateReplacement(replacement, captures)).toBe("zero");
	});

	it("should generate static access replacement", () => {
		expect.assertions(1);

		const replacement: ParsedReplacement = { kind: "staticAccess", property: "zero", typeName: "Vector2" };
		const captures = new Map<string, CapturedValue>();
		expect(generateReplacement(replacement, captures)).toBe("Vector2.zero");
	});

	it("should generate call replacement with captures", () => {
		expect.assertions(1);

		const replacement: ParsedReplacement = { kind: "call", name: "fromX", parameters: ["$x"] };
		const captures = new Map<string, CapturedValue>([
			[
				"x",
				{
					constValue: 0.5,
					expressionKey: "literal:0.5",
					isComplex: false,
					node: parseExpression("0.5"),
					sourceText: "0.5",
				},
			],
		]);
		expect(generateReplacement(replacement, captures)).toBe("fromX(0.5)");
	});

	it("should generate call replacement with multiple captures", () => {
		expect.assertions(1);

		const replacement: ParsedReplacement = { kind: "call", name: "combine", parameters: ["$x", "$y"] };
		const captures = new Map<string, CapturedValue>([
			[
				"x",
				{
					constValue: 1,
					expressionKey: "literal:1",
					isComplex: false,
					node: parseExpression("1"),
					sourceText: "1",
				},
			],
			[
				"y",
				{
					constValue: 2,
					expressionKey: "literal:2",
					isComplex: false,
					node: parseExpression("2"),
					sourceText: "2",
				},
			],
		]);
		expect(generateReplacement(replacement, captures)).toBe("combine(1, 2)");
	});

	it("should generate call replacement with literal args", () => {
		expect.assertions(1);

		const replacement: ParsedReplacement = { kind: "call", name: "scale", parameters: ["2"] };
		const captures = new Map<string, CapturedValue>();
		expect(generateReplacement(replacement, captures)).toBe("scale(2)");
	});

	it("should preserve identifier source text", () => {
		expect.assertions(1);

		const replacement: ParsedReplacement = { kind: "call", name: "fromX", parameters: ["$x"] };
		const captures = new Map<string, CapturedValue>([
			["x", { expressionKey: "id:myVar", isComplex: false, node: parseExpression("myVar"), sourceText: "myVar" }],
		]);
		expect(generateReplacement(replacement, captures)).toBe("fromX(myVar)");
	});

	it("should throw error when capture is missing", () => {
		expect.assertions(1);

		const replacement: ParsedReplacement = { kind: "call", name: "fromX", parameters: ["$x"] };
		const captures = new Map<string, CapturedValue>();
		expect(() => generateReplacement(replacement, captures)).toThrow("Missing capture: x");
	});

	it("should handle mixed literal and capture args", () => {
		expect.assertions(1);

		const replacement: ParsedReplacement = { kind: "call", name: "clamp", parameters: ["$x", "10", "$y"] };
		const captures = new Map<string, CapturedValue>([
			[
				"x",
				{
					constValue: 5,
					expressionKey: "literal:5",
					isComplex: false,
					node: parseExpression("5"),
					sourceText: "5",
				},
			],
			[
				"y",
				{
					constValue: 15,
					expressionKey: "literal:15",
					isComplex: false,
					node: parseExpression("15"),
					sourceText: "15",
				},
			],
		]);
		expect(generateReplacement(replacement, captures)).toBe("clamp(5, 10, 15)");
	});
});
