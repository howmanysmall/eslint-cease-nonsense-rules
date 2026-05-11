import { describe, expect, it, vi } from "vitest";
import { parse } from "@typescript-eslint/parser";
import { AST_NODE_TYPES } from "@typescript-eslint/types";
import {
	buildPatternIndex,
	canSafelySubstitute,
	captureParameter,
	evaluateConditions,
	matchParameters,
	resolveCallee,
} from "@utilities/pattern-replacement/pattern-matcher";
import { parsePattern } from "@utilities/pattern-replacement/pattern-parser";

import type { TSESTree } from "@typescript-eslint/types";
import type { CapturedValue, WhenCondition } from "@utilities/pattern-replacement/pattern-types";

vi.setConfig({ testTimeout: 10000 });

function parseExpression(code: string): TSESTree.Expression {
	const program = parse(`const value = ${code};`, { loc: false, range: false });
	const [statement] = program.body;
	if (statement?.type !== AST_NODE_TYPES.VariableDeclaration) throw new Error(`Could not parse expression: ${code}`);

	const [declaration] = statement.declarations;
	const expression = declaration?.init;
	if (expression === null || expression === undefined) throw new Error(`Could not parse expression: ${code}`);

	return expression;
}

function parseCallableExpression(
	code: string,
): TSESTree.CallExpression | TSESTree.NewExpression | TSESTree.ChainExpression {
	const expression = parseExpression(code);
	if (
		expression.type === AST_NODE_TYPES.CallExpression ||
		expression.type === AST_NODE_TYPES.NewExpression ||
		expression.type === AST_NODE_TYPES.ChainExpression
	) {
		return expression;
	}

	throw new Error(`Expected callable expression: ${code}`);
}

function capturedValue(sourceText: string, constValue?: number): CapturedValue {
	const expressionKey = constValue === undefined ? `id:${sourceText}` : `literal:${constValue}`;
	const baseValue = {
		expressionKey,
		isComplex: false,
		node: parseExpression(sourceText),
		sourceText,
	};

	return constValue === undefined ? baseValue : { ...baseValue, constValue };
}

describe("buildPatternIndex", () => {
	it("should index patterns by type and name", () => {
		expect.assertions(2);

		const patterns = [
			parsePattern("new Vector2(0, 0)", "Vector2.zero", undefined),
			parsePattern("new Vector2($x, 0?)", "fromX($x)", undefined),
			parsePattern("UDim2.fromScale(1, 1)", "oneScale", undefined),
		];

		const index = buildPatternIndex(patterns);

		expect(index.get("constructor:Vector2")).toHaveLength(2);
		expect(index.get("staticMethod:UDim2:fromScale")).toHaveLength(1);
	});
});

describe("resolveCallee", () => {
	it("should resolve NewExpression with Identifier callee", () => {
		expect.assertions(1);

		const result = resolveCallee(parseCallableExpression("new Vector2()"));
		expect(result).toStrictEqual({ kind: "constructor", typeName: "Vector2" });
	});

	it("should resolve CallExpression with MemberExpression callee", () => {
		expect.assertions(1);

		const result = resolveCallee(parseCallableExpression("UDim2.fromScale()"));
		expect(result).toStrictEqual({
			kind: "staticMethod",
			methodName: "fromScale",
			typeName: "UDim2",
		});
	});

	it("should return unknown for CallExpression with ChainExpression", () => {
		expect.assertions(1);

		const result = resolveCallee(parseCallableExpression("UDim2?.fromScale()"));
		expect(result).toStrictEqual({
			kind: "staticMethod",
			methodName: "fromScale",
			typeName: "UDim2",
		});
	});

	it("should return unknown for unsupported expression types", () => {
		expect.assertions(1);

		const result = resolveCallee(parseCallableExpression("getValue()"));
		expect(result).toStrictEqual({ kind: "unknown" });
	});

	it("should return unknown for computed member access", () => {
		expect.assertions(1);

		const result = resolveCallee(parseCallableExpression('UDim2["fromScale"]()'));
		expect(result).toStrictEqual({ kind: "unknown" });
	});

	it("should return unknown for non-identifier object in member expression", () => {
		expect.assertions(1);

		const result = resolveCallee(parseCallableExpression("(42).fromScale()"));
		expect(result).toStrictEqual({ kind: "unknown" });
	});
});

describe("captureParameter", () => {
	const mockSourceCode = {
		getText: (node: TSESTree.Expression): string => {
			if (node.type === AST_NODE_TYPES.Literal) return String(node.value);
			if (node.type === AST_NODE_TYPES.Identifier) return node.name;
			return "complex";
		},
	};

	it("should capture numeric literal", () => {
		expect.assertions(3);

		const result = captureParameter(parseExpression("42"), mockSourceCode);
		expect(result.expressionKey).toBe("literal:42");
		expect(result.constValue).toBe(42);
		expect(result.isComplex).toBe(false);
	});

	it("should capture identifier", () => {
		expect.assertions(2);

		const result = captureParameter(parseExpression("foo"), mockSourceCode);
		expect(result.expressionKey).toBe("id:foo");
		expect(result.isComplex).toBe(false);
	});

	it("should capture undefined identifier", () => {
		expect.assertions(1);

		const result = captureParameter(parseExpression("undefined"), mockSourceCode);
		expect(result.expressionKey).toBe("undefined");
	});

	it("should capture complex expression", () => {
		expect.assertions(2);

		const result = captureParameter(parseExpression("getValue()"), mockSourceCode);
		expect(result.expressionKey).toBe("complex:complex");
		expect(result.isComplex).toBe(true);
	});

	it("should capture constant expression", () => {
		expect.assertions(3);

		const mockSC = {
			getText: (): string => "-5",
		};
		const result = captureParameter(parseExpression("-5"), mockSC);
		expect(result.expressionKey).toBe("const:-5");
		expect(result.constValue).toBe(-5);
		expect(result.isComplex).toBe(false);
	});
});

describe("matchArgs", () => {
	const mockSourceCode = {
		getText: (node: TSESTree.Expression): string => {
			if (node.type === AST_NODE_TYPES.Literal) return String(node.value);
			if (node.type === AST_NODE_TYPES.Identifier) return node.name;
			return "complex";
		},
	};

	it("should match literal arguments", () => {
		expect.assertions(1);

		const pattern = parsePattern("new Vector2(0, 0)", "zero", undefined);
		const args = [parseExpression("0"), parseExpression("0")];
		const result = matchParameters(pattern.parameters, args, mockSourceCode);
		expect(result).toBeDefined();
	});

	it("should match capture arguments", () => {
		expect.assertions(3);

		const pattern = parsePattern("new Vector2($x, $y)", "fromXY($x, $y)", undefined);
		const args = [parseExpression("1"), parseExpression("2")];
		const result = matchParameters(pattern.parameters, args, mockSourceCode);
		expect(result).toBeDefined();
		expect(result?.get("x")?.constValue).toBe(1);
		expect(result?.get("y")?.constValue).toBe(2);
	});

	it("should match optional arguments when present", () => {
		expect.assertions(1);

		const pattern = parsePattern("new Vector2($x, 0?)", "fromX($x)", undefined);
		const args = [parseExpression("1"), parseExpression("0")];
		const result = matchParameters(pattern.parameters, args, mockSourceCode);
		expect(result).toBeDefined();
	});

	it("should match optional arguments when missing", () => {
		expect.assertions(1);

		const pattern = parsePattern("new Vector2($x, 0?)", "fromX($x)", undefined);
		const args = [parseExpression("1")];
		const result = matchParameters(pattern.parameters, args, mockSourceCode);
		expect(result).toBeDefined();
	});

	it("should match wildcard arguments", () => {
		expect.assertions(1);

		const pattern = parsePattern("new Vector2(_, _)", "copy", undefined);
		const args = [parseExpression("1"), parseExpression("2")];
		const result = matchParameters(pattern.parameters, args, mockSourceCode);
		expect(result).toBeDefined();
	});

	it("should fail when argument count is wrong", () => {
		expect.assertions(1);

		const pattern = parsePattern("new Vector2(0, 0)", "zero", undefined);
		const args = [parseExpression("0")];
		const result = matchParameters(pattern.parameters, args, mockSourceCode);
		expect(result).toBeUndefined();
	});

	it("should fail when literal value does not match", () => {
		expect.assertions(1);

		const pattern = parsePattern("new Vector2(0, 0)", "zero", undefined);
		const args = [parseExpression("1"), parseExpression("0")];
		const result = matchParameters(pattern.parameters, args, mockSourceCode);
		expect(result).toBeUndefined();
	});

	it("should fail when captures have different values", () => {
		expect.assertions(1);

		const pattern = parsePattern("new Vector2($x, $x)", "square($x)", undefined);
		const args = [parseExpression("1"), parseExpression("2")];
		const result = matchParameters(pattern.parameters, args, mockSourceCode);
		expect(result).toBeUndefined();
	});

	it("should handle undefined arguments", () => {
		expect.assertions(1);

		const pattern = parsePattern("new Vector2(0, 0)", "zero", undefined);
		const args = [parseExpression("undefined"), parseExpression("0")];
		const result = matchParameters(pattern.parameters, args, mockSourceCode);
		expect(result).toBeUndefined();
	});

	it("should handle wildcard missing argument", () => {
		expect.assertions(1);

		const pattern = parsePattern("new Vector2(_)", "copy", undefined);
		const args = [parseExpression("undefined")];
		const result = matchParameters(pattern.parameters, args, mockSourceCode);
		expect(result).toBeUndefined();
	});
});

describe("evaluateConditions", () => {
	it("should pass when condition is met", () => {
		expect.assertions(1);

		const conditions = new Map<string, WhenCondition>([["x", "!= 0"]]);
		const captures = new Map<string, CapturedValue>([["x", capturedValue("1", 1)]]);
		expect(evaluateConditions(conditions, captures)).toBe(true);
	});

	it("should fail when condition is not met", () => {
		expect.assertions(1);

		const conditions = new Map<string, WhenCondition>([["x", "!= 0"]]);
		const captures = new Map<string, CapturedValue>([["x", capturedValue("0", 0)]]);
		expect(evaluateConditions(conditions, captures)).toBe(false);
	});

	it("should fail when constValue is undefined", () => {
		expect.assertions(1);

		const conditions = new Map<string, WhenCondition>([["x", "!= 0"]]);
		const captures = new Map<string, CapturedValue>([["x", capturedValue("foo")]]);
		expect(evaluateConditions(conditions, captures)).toBe(false);
	});

	it("should handle == operator", () => {
		expect.assertions(1);

		const conditions = new Map<string, WhenCondition>([["x", "== 5"]]);
		const captures = new Map<string, CapturedValue>([["x", capturedValue("5", 5)]]);
		expect(evaluateConditions(conditions, captures)).toBe(true);
	});

	it("should handle > operator", () => {
		expect.assertions(1);

		const conditions = new Map<string, WhenCondition>([["x", "> 5"]]);
		const captures = new Map<string, CapturedValue>([["x", capturedValue("10", 10)]]);
		expect(evaluateConditions(conditions, captures)).toBe(true);
	});

	it("should handle < operator", () => {
		expect.assertions(1);

		const conditions = new Map<string, WhenCondition>([["x", "< 5"]]);
		const captures = new Map<string, CapturedValue>([["x", capturedValue("3", 3)]]);
		expect(evaluateConditions(conditions, captures)).toBe(true);
	});

	it("should handle >= operator", () => {
		expect.assertions(1);

		const conditions = new Map<string, WhenCondition>([["x", ">= 5"]]);
		const captures = new Map<string, CapturedValue>([["x", capturedValue("5", 5)]]);
		expect(evaluateConditions(conditions, captures)).toBe(true);
	});

	it("should handle <= operator", () => {
		expect.assertions(1);

		const conditions = new Map<string, WhenCondition>([["x", "<= 5"]]);
		const captures = new Map<string, CapturedValue>([["x", capturedValue("5", 5)]]);
		expect(evaluateConditions(conditions, captures)).toBe(true);
	});

	it("should return true when no conditions", () => {
		expect.assertions(1);

		const conditions = new Map<string, WhenCondition>();
		const captures = new Map<string, CapturedValue>([["x", capturedValue("1", 1)]]);
		expect(evaluateConditions(conditions, captures)).toBe(true);
	});
});

describe("canSafelySubstitute", () => {
	it("should return true for simple captures", () => {
		expect.assertions(1);

		const captures = new Map<string, CapturedValue>([["x", capturedValue("1", 1)]]);
		expect(canSafelySubstitute(captures)).toBe(true);
	});

	it("should return false for complex captures", () => {
		expect.assertions(1);

		const captures = new Map<string, CapturedValue>([
			[
				"x",
				{
					expressionKey: "complex:getX()",
					isComplex: true,
					node: parseExpression("getX()"),
					sourceText: "getX()",
				},
			],
		]);
		expect(canSafelySubstitute(captures)).toBe(false);
	});

	it("should return true for empty captures", () => {
		expect.assertions(1);

		const captures = new Map<string, CapturedValue>();
		expect(canSafelySubstitute(captures)).toBe(true);
	});
});
