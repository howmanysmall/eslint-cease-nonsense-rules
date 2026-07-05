import { describe, expect, it, vi } from "vitest";
import { parse } from "@typescript-eslint/parser";
import { AST_NODE_TYPES } from "@typescript-eslint/types";
import { evaluateConstant, normalizeZero } from "$utilities/pattern-replacement/constant-folder";

import type { TSESTree } from "@typescript-eslint/types";

function parseExpression(code: string): TSESTree.Expression {
	const program = parse(`const value = ${code};`, { loc: false, range: false });
	const [statement] = program.body;
	if (statement?.type !== AST_NODE_TYPES.VariableDeclaration) {
		const error = new Error(`Could not parse expression: ${code}`);
		Error.captureStackTrace(error, parseExpression);
		throw error;
	}

	const [declaration] = statement.declarations;
	const expression = declaration?.init;
	if (expression === null || expression === undefined) {
		const error = new Error(`Could not parse expression: ${code}`);
		Error.captureStackTrace(error, parseExpression);
		throw error;
	}

	return expression;
}

vi.setConfig({ testTimeout: 500 });

describe("normalizeZero", () => {
	it("should convert -0 to 0", () => {
		expect.assertions(2);

		expect(normalizeZero(-0)).toBe(0);
		expect(Object.is(normalizeZero(-0), 0)).toBe(true);
	});

	it("should leave positive zero unchanged", () => {
		expect.assertions(1);

		expect(normalizeZero(0)).toBe(0);
	});

	it("should leave other numbers unchanged", () => {
		expect.assertions(3);

		expect(normalizeZero(1)).toBe(1);
		expect(normalizeZero(-1)).toBe(-1);
		expect(normalizeZero(0.5)).toBe(0.5);
	});
});

describe("evaluateConstant", () => {
	it("should return undefined for non-constant expressions", () => {
		expect.assertions(1);

		expect(evaluateConstant(parseExpression("foo"))).toBeUndefined();
	});

	it("should evaluate numeric literals", () => {
		expect.assertions(1);

		expect(evaluateConstant(parseExpression("42"))).toBe(42);
	});

	it("should evaluate negative literals", () => {
		expect.assertions(1);

		expect(evaluateConstant(parseExpression("-5"))).toBe(-5);
	});

	it("should evaluate positive unary operator", () => {
		expect.assertions(1);

		expect(evaluateConstant(parseExpression("+5"))).toBe(5);
	});

	it("should reject unsupported unary operators", () => {
		expect.assertions(1);

		expect(evaluateConstant(parseExpression("!5"))).toBeUndefined();
	});

	it("should normalize -0 in literals", () => {
		expect.assertions(2);

		const negZero = parseExpression("-0");
		expect(evaluateConstant(negZero)).toBe(0);
		expect(Object.is(evaluateConstant(negZero), -0)).toBe(false);
	});

	it("should evaluate binary addition", () => {
		expect.assertions(1);

		expect(evaluateConstant(parseExpression("1 + 2"))).toBe(3);
	});

	it("should evaluate binary subtraction", () => {
		expect.assertions(1);

		expect(evaluateConstant(parseExpression("5 - 3"))).toBe(2);
	});

	it("should evaluate binary multiplication", () => {
		expect.assertions(1);

		expect(evaluateConstant(parseExpression("4 * 3"))).toBe(12);
	});

	it("should evaluate binary division", () => {
		expect.assertions(1);

		expect(evaluateConstant(parseExpression("10 / 2"))).toBe(5);
	});

	it("should reject unsupported binary operators", () => {
		expect.assertions(1);

		expect(evaluateConstant(parseExpression("10 % 3"))).toBeUndefined();
	});

	it("should reject NaN results", () => {
		expect.assertions(1);

		expect(evaluateConstant(parseExpression("0 / 0"))).toBeUndefined();
	});

	it("should reject Infinity results", () => {
		expect.assertions(1);

		expect(evaluateConstant(parseExpression("1 / 0"))).toBeUndefined();
	});

	it("should unwrap TSAsExpression", () => {
		expect.assertions(1);

		expect(evaluateConstant(parseExpression("42 as number"))).toBe(42);
	});

	it("should unwrap TSNonNullExpression", () => {
		expect.assertions(1);

		expect(evaluateConstant(parseExpression("42!"))).toBe(42);
	});
});
