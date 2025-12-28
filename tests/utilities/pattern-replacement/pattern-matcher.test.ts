import { describe, expect, it } from "bun:test";
import type { TSESTree } from "@typescript-eslint/types";
import { AST_NODE_TYPES } from "@typescript-eslint/types";
import {
	buildPatternIndex,
	canSafelySubstitute,
	captureParameter,
	evaluateConditions,
	matchParameters,
	resolveCallee,
} from "../../../src/utilities/pattern-replacement/pattern-matcher";
import { parsePattern } from "../../../src/utilities/pattern-replacement/pattern-parser";

describe("buildPatternIndex", () => {
	it("should index patterns by type and name", () => {
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
		const node = {
			callee: { name: "Vector2", type: "Identifier" },
			type: "NewExpression",
		};
		const result = resolveCallee(node as never);
		expect(result).toEqual({ kind: "constructor", typeName: "Vector2" });
	});

	it("should resolve CallExpression with MemberExpression callee", () => {
		const node = {
			callee: {
				computed: false,
				object: { name: "UDim2", type: "Identifier" },
				property: { name: "fromScale", type: "Identifier" },
				type: "MemberExpression",
			},
			type: "CallExpression",
		};
		const result = resolveCallee(node as never);
		expect(result).toEqual({
			kind: "staticMethod",
			methodName: "fromScale",
			typeName: "UDim2",
		});
	});

	it("should return unknown for CallExpression with ChainExpression", () => {
		const node = {
			callee: {
				expression: {
					computed: false,
					object: { name: "UDim2", type: "Identifier" },
					property: { name: "fromScale", type: "Identifier" },
					type: "MemberExpression",
				},
				type: "ChainExpression",
			},
			type: "CallExpression",
		};
		const result = resolveCallee(node as never);
		expect(result).toEqual({
			kind: "staticMethod",
			methodName: "fromScale",
			typeName: "UDim2",
		});
	});

	it("should return unknown for unsupported expression types", () => {
		const node = {
			callee: { type: "Literal", value: 42 },
			type: "CallExpression",
		};
		const result = resolveCallee(node as never);
		expect(result).toEqual({ kind: "unknown" });
	});

	it("should return unknown for computed member access", () => {
		const node = {
			callee: {
				computed: true,
				object: { name: "UDim2", type: "Identifier" },
				property: { name: "fromScale", type: "Identifier" },
				type: "MemberExpression",
			},
			type: "CallExpression",
		};
		const result = resolveCallee(node as never);
		expect(result).toEqual({ kind: "unknown" });
	});

	it("should return unknown for non-identifier object in member expression", () => {
		const node = {
			callee: {
				computed: false,
				object: { type: "Literal", value: 42 },
				property: { name: "fromScale", type: "Identifier" },
				type: "MemberExpression",
			},
			type: "CallExpression",
		};
		const result = resolveCallee(node as never);
		expect(result).toEqual({ kind: "unknown" });
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
		const node: TSESTree.Literal = { type: AST_NODE_TYPES.Literal, value: 42 } as never;
		const result = captureParameter(node, mockSourceCode as never);
		expect(result.expressionKey).toBe("literal:42");
		expect(result.constValue).toBe(42);
		expect(result.isComplex).toBe(false);
	});

	it("should capture identifier", () => {
		const node: TSESTree.Identifier = { name: "foo", type: AST_NODE_TYPES.Identifier } as never;
		const result = captureParameter(node, mockSourceCode as never);
		expect(result.expressionKey).toBe("id:foo");
		expect(result.isComplex).toBe(false);
	});

	it("should capture undefined identifier", () => {
		const node: TSESTree.Identifier = { name: "undefined", type: AST_NODE_TYPES.Identifier } as never;
		const result = captureParameter(node, mockSourceCode as never);
		expect(result.expressionKey).toBe("undefined");
	});

	it("should capture complex expression", () => {
		const node: TSESTree.CallExpression = { type: AST_NODE_TYPES.CallExpression } as never;
		const result = captureParameter(node, mockSourceCode as never);
		expect(result.expressionKey).toBe("complex:complex");
		expect(result.isComplex).toBe(true);
	});

	it("should capture constant expression", () => {
		const node: TSESTree.UnaryExpression = {
			argument: { type: AST_NODE_TYPES.Literal, value: 5 },
			operator: "-",
			type: AST_NODE_TYPES.UnaryExpression,
		} as never;
		const mockSC = {
			getText: (): string => "-5",
		};
		const result = captureParameter(node, mockSC as never);
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
		const pattern = parsePattern("new Vector2(0, 0)", "zero", undefined);
		const args: Array<TSESTree.Literal> = [
			{ type: AST_NODE_TYPES.Literal, value: 0 } as never,
			{ type: AST_NODE_TYPES.Literal, value: 0 } as never,
		];
		const result = matchParameters(pattern.parameters, args, mockSourceCode as never);
		expect(result).not.toBeUndefined();
	});

	it("should match capture arguments", () => {
		const pattern = parsePattern("new Vector2($x, $y)", "fromXY($x, $y)", undefined);
		const args: Array<TSESTree.Literal> = [
			{ type: AST_NODE_TYPES.Literal, value: 1 } as never,
			{ type: AST_NODE_TYPES.Literal, value: 2 } as never,
		];
		const result = matchParameters(pattern.parameters, args, mockSourceCode as never);
		expect(result).not.toBeUndefined();
		expect(result?.get("x")?.constValue).toBe(1);
		expect(result?.get("y")?.constValue).toBe(2);
	});

	it("should match optional arguments when present", () => {
		const pattern = parsePattern("new Vector2($x, 0?)", "fromX($x)", undefined);
		const args: Array<TSESTree.Literal> = [
			{ type: AST_NODE_TYPES.Literal, value: 1 } as never,
			{ type: AST_NODE_TYPES.Literal, value: 0 } as never,
		];
		const result = matchParameters(pattern.parameters, args, mockSourceCode as never);
		expect(result).not.toBeUndefined();
	});

	it("should match optional arguments when missing", () => {
		const pattern = parsePattern("new Vector2($x, 0?)", "fromX($x)", undefined);
		const args: Array<TSESTree.Literal> = [{ type: AST_NODE_TYPES.Literal, value: 1 } as never];
		const result = matchParameters(pattern.parameters, args, mockSourceCode as never);
		expect(result).not.toBeUndefined();
	});

	it("should match wildcard arguments", () => {
		const pattern = parsePattern("new Vector2(_, _)", "copy", undefined);
		const args: Array<TSESTree.Literal> = [
			{ type: AST_NODE_TYPES.Literal, value: 1 } as never,
			{ type: AST_NODE_TYPES.Literal, value: 2 } as never,
		];
		const result = matchParameters(pattern.parameters, args, mockSourceCode as never);
		expect(result).not.toBeUndefined();
	});

	it("should fail when argument count is wrong", () => {
		const pattern = parsePattern("new Vector2(0, 0)", "zero", undefined);
		const args: Array<TSESTree.Literal> = [{ type: AST_NODE_TYPES.Literal, value: 0 } as never];
		const result = matchParameters(pattern.parameters, args, mockSourceCode as never);
		expect(result).toBeUndefined();
	});

	it("should fail when literal value does not match", () => {
		const pattern = parsePattern("new Vector2(0, 0)", "zero", undefined);
		const args: Array<TSESTree.Literal> = [
			{ type: AST_NODE_TYPES.Literal, value: 1 } as never,
			{ type: AST_NODE_TYPES.Literal, value: 0 } as never,
		];
		const result = matchParameters(pattern.parameters, args, mockSourceCode as never);
		expect(result).toBeUndefined();
	});

	it("should fail when captures have different values", () => {
		const pattern = parsePattern("new Vector2($x, $x)", "square($x)", undefined);
		const args: Array<TSESTree.Literal> = [
			{ type: AST_NODE_TYPES.Literal, value: 1 } as never,
			{ type: AST_NODE_TYPES.Literal, value: 2 } as never,
		];
		const result = matchParameters(pattern.parameters, args, mockSourceCode as never);
		expect(result).toBeUndefined();
	});

	it("should handle undefined arguments", () => {
		const pattern = parsePattern("new Vector2(0, 0)", "zero", undefined);
		const args: Array<TSESTree.Identifier> = [
			{ name: "undefined", type: AST_NODE_TYPES.Identifier } as never,
			{ type: AST_NODE_TYPES.Literal, value: 0 } as never,
		];
		const result = matchParameters(pattern.parameters, args, mockSourceCode as never);
		expect(result).toBeUndefined();
	});

	it("should handle wildcard missing argument", () => {
		const pattern = parsePattern("new Vector2(_)", "copy", undefined);
		const args: Array<TSESTree.Identifier> = [{ name: "undefined", type: AST_NODE_TYPES.Identifier } as never];
		const result = matchParameters(pattern.parameters, args, mockSourceCode as never);
		expect(result).toBeUndefined();
	});
});

describe("evaluateConditions", () => {
	it("should pass when condition is met", () => {
		const conditions = new Map<string, string>([["x", "!= 0"]]);
		const captures = new Map([
			["x", { constValue: 1, expressionKey: "literal:1", isComplex: false, sourceText: "1" }],
		]);
		expect(evaluateConditions(conditions as never, captures as never)).toBe(true);
	});

	it("should fail when condition is not met", () => {
		const conditions = new Map<string, string>([["x", "!= 0"]]);
		const captures = new Map([
			["x", { constValue: 0, expressionKey: "literal:0", isComplex: false, sourceText: "0" }],
		]);
		expect(evaluateConditions(conditions as never, captures as never)).toBe(false);
	});

	it("should fail when constValue is undefined", () => {
		const conditions = new Map<string, string>([["x", "!= 0"]]);
		const captures = new Map([["x", { expressionKey: "id:foo", isComplex: false, sourceText: "foo" }]]);
		expect(evaluateConditions(conditions as never, captures as never)).toBe(false);
	});

	it("should handle == operator", () => {
		const conditions = new Map<string, string>([["x", "== 5"]]);
		const captures = new Map([
			["x", { constValue: 5, expressionKey: "literal:5", isComplex: false, sourceText: "5" }],
		]);
		expect(evaluateConditions(conditions as never, captures as never)).toBe(true);
	});

	it("should handle > operator", () => {
		const conditions = new Map<string, string>([["x", "> 5"]]);
		const captures = new Map([
			["x", { constValue: 10, expressionKey: "literal:10", isComplex: false, sourceText: "10" }],
		]);
		expect(evaluateConditions(conditions as never, captures as never)).toBe(true);
	});

	it("should handle < operator", () => {
		const conditions = new Map<string, string>([["x", "< 5"]]);
		const captures = new Map([
			["x", { constValue: 3, expressionKey: "literal:3", isComplex: false, sourceText: "3" }],
		]);
		expect(evaluateConditions(conditions as never, captures as never)).toBe(true);
	});

	it("should handle >= operator", () => {
		const conditions = new Map<string, string>([["x", ">= 5"]]);
		const captures = new Map([
			["x", { constValue: 5, expressionKey: "literal:5", isComplex: false, sourceText: "5" }],
		]);
		expect(evaluateConditions(conditions as never, captures as never)).toBe(true);
	});

	it("should handle <= operator", () => {
		const conditions = new Map<string, string>([["x", "<= 5"]]);
		const captures = new Map([
			["x", { constValue: 5, expressionKey: "literal:5", isComplex: false, sourceText: "5" }],
		]);
		expect(evaluateConditions(conditions as never, captures as never)).toBe(true);
	});

	it("should return true when no conditions", () => {
		const conditions = new Map<string, string>();
		const captures = new Map([
			["x", { constValue: 1, expressionKey: "literal:1", isComplex: false, sourceText: "1" }],
		]);
		expect(evaluateConditions(conditions as never, captures as never)).toBe(true);
	});
});

describe("canSafelySubstitute", () => {
	it("should return true for simple captures", () => {
		const captures = new Map([
			["x", { constValue: 1, expressionKey: "literal:1", isComplex: false, sourceText: "1" }],
		]);
		expect(canSafelySubstitute(captures as never)).toBe(true);
	});

	it("should return false for complex captures", () => {
		const captures = new Map([["x", { expressionKey: "complex:getX()", isComplex: true, sourceText: "getX()" }]]);
		expect(canSafelySubstitute(captures as never)).toBe(false);
	});

	it("should return true for empty captures", () => {
		const captures = new Map();
		expect(canSafelySubstitute(captures as never)).toBe(true);
	});
});
