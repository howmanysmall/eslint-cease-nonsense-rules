import { describe, expect, it } from "bun:test";
import { evaluateConstant, normalizeZero } from "../../../src/utilities/pattern-replacement/constant-folder";

describe("normalizeZero", () => {
	it("should convert -0 to 0", () => {
		expect(normalizeZero(-0)).toBe(0);
		expect(Object.is(normalizeZero(-0), 0)).toBe(true);
	});

	it("should leave positive zero unchanged", () => {
		expect(normalizeZero(0)).toBe(0);
	});

	it("should leave other numbers unchanged", () => {
		expect(normalizeZero(1)).toBe(1);
		expect(normalizeZero(-1)).toBe(-1);
		expect(normalizeZero(0.5)).toBe(0.5);
	});
});

describe("evaluateConstant", () => {
	it("should return undefined for non-constant expressions", () => {
		const identifier = { name: "foo", type: "Identifier" };
		expect(evaluateConstant(identifier as never)).toBeUndefined();
	});

	it("should evaluate numeric literals", () => {
		const literal = { type: "Literal", value: 42 };
		expect(evaluateConstant(literal as never)).toBe(42);
	});

	it("should evaluate negative literals", () => {
		const negLiteral = {
			argument: { type: "Literal", value: 5 },
			operator: "-",
			type: "UnaryExpression",
		};
		expect(evaluateConstant(negLiteral as never)).toBe(-5);
	});

	it("should evaluate positive unary operator", () => {
		const posLiteral = {
			argument: { type: "Literal", value: 5 },
			operator: "+",
			type: "UnaryExpression",
		};
		expect(evaluateConstant(posLiteral as never)).toBe(5);
	});

	it("should reject unsupported unary operators", () => {
		const notExpr = {
			argument: { type: "Literal", value: 5 },
			operator: "!",
			type: "UnaryExpression",
		};
		expect(evaluateConstant(notExpr as never)).toBeUndefined();
	});

	it("should normalize -0 in literals", () => {
		const negZero = {
			argument: { type: "Literal", value: 0 },
			operator: "-",
			type: "UnaryExpression",
		};
		expect(evaluateConstant(negZero as never)).toBe(0);
		expect(Object.is(evaluateConstant(negZero as never), -0)).toBe(false);
	});

	it("should evaluate binary addition", () => {
		const add = {
			left: { type: "Literal", value: 1 },
			operator: "+",
			right: { type: "Literal", value: 2 },
			type: "BinaryExpression",
		};
		expect(evaluateConstant(add as never)).toBe(3);
	});

	it("should evaluate binary subtraction", () => {
		const sub = {
			left: { type: "Literal", value: 5 },
			operator: "-",
			right: { type: "Literal", value: 3 },
			type: "BinaryExpression",
		};
		expect(evaluateConstant(sub as never)).toBe(2);
	});

	it("should evaluate binary multiplication", () => {
		const mul = {
			left: { type: "Literal", value: 4 },
			operator: "*",
			right: { type: "Literal", value: 3 },
			type: "BinaryExpression",
		};
		expect(evaluateConstant(mul as never)).toBe(12);
	});

	it("should evaluate binary division", () => {
		const div = {
			left: { type: "Literal", value: 10 },
			operator: "/",
			right: { type: "Literal", value: 2 },
			type: "BinaryExpression",
		};
		expect(evaluateConstant(div as never)).toBe(5);
	});

	it("should reject unsupported binary operators", () => {
		const mod = {
			left: { type: "Literal", value: 10 },
			operator: "%",
			right: { type: "Literal", value: 3 },
			type: "BinaryExpression",
		};
		expect(evaluateConstant(mod as never)).toBeUndefined();
	});

	it("should reject NaN results", () => {
		const divZero = {
			left: { type: "Literal", value: 0 },
			operator: "/",
			right: { type: "Literal", value: 0 },
			type: "BinaryExpression",
		};
		expect(evaluateConstant(divZero as never)).toBeUndefined();
	});

	it("should reject Infinity results", () => {
		const divByZero = {
			left: { type: "Literal", value: 1 },
			operator: "/",
			right: { type: "Literal", value: 0 },
			type: "BinaryExpression",
		};
		expect(evaluateConstant(divByZero as never)).toBeUndefined();
	});

	it("should unwrap TSAsExpression", () => {
		const asExpr = {
			expression: { type: "Literal", value: 42 },
			type: "TSAsExpression",
		};
		expect(evaluateConstant(asExpr as never)).toBe(42);
	});

	it("should unwrap TSNonNullExpression", () => {
		const nonNull = {
			expression: { type: "Literal", value: 42 },
			type: "TSNonNullExpression",
		};
		expect(evaluateConstant(nonNull as never)).toBe(42);
	});
});
