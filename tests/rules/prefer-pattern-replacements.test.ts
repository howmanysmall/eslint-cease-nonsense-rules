import { describe } from "bun:test";
import parser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import rule from "../../src/rules/prefer-pattern-replacements";
import { pattern } from "../../src/utilities/pattern-replacement";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser,
		sourceType: "module",
	},
});

describe("prefer-pattern-replacements", () => {
	// @ts-expect-error -- this thing is dumb.
	ruleTester.run("prefer-pattern-replacements", rule, {
		invalid: [
			{
				code: "const x = new Vector2(0, 0);",
				errors: [{ messageId: "preferReplacement" }],
				options: [{ patterns: [pattern({ match: "new Vector2(0, 0)", replacement: "Vector2.zero" })] }],
				output: "const x = Vector2.zero;",
			},
			{
				code: "const x = new Vector2(1 * 2, 2 * 3);",
				errors: [{ messageId: "preferReplacement" }],
				options: [{ patterns: [pattern({ match: "new Vector2($x, $y)", replacement: "fromValues($x, $y)" })] }],
				output: "const x = fromValues(1 * 2, 2 * 3);",
			},
			{
				code: "const x = new Vector2(1 + 2, 2 - 1);",
				errors: [{ messageId: "preferReplacement" }],
				options: [{ patterns: [pattern({ match: "new Vector2($x, $y)", replacement: "fromValues($x, $y)" })] }],
				output: "const x = fromValues(1 + 2, 2 - 1);",
			},
			{
				code: "const x = new Vector2(10 / 2, 2 * 3);",
				errors: [{ messageId: "preferReplacement" }],
				options: [{ patterns: [pattern({ match: "new Vector2($x, $y)", replacement: "fromValues($x, $y)" })] }],
				output: "const x = fromValues(10 / 2, 2 * 3);",
			},
			{
				code: "const x = new Vector2(+5, -3);",
				errors: [{ messageId: "preferReplacement" }],
				options: [{ patterns: [pattern({ match: "new Vector2($x, $y)", replacement: "fromValues($x, $y)" })] }],
				output: "const x = fromValues(+5, -3);",
			},
			{
				code: "const x = UDim2.fromScale(2, 2);",
				errors: [{ messageId: "preferReplacement" }],
				options: [
					{
						patterns: [
							pattern({
								match: "UDim2.fromScale($x, $x)",
								replacement: "scale($x)",
								when: { x: "> 0" },
							}),
						],
					},
				],
				output: "const x = scale(2);",
			},
			{
				code: "const x = UDim2.fromScale(2, 2);",
				errors: [{ messageId: "preferReplacement" }],
				options: [
					{
						patterns: [
							pattern({
								match: "UDim2.fromScale($x, $x)",
								replacement: "scale($x)",
								when: { x: ">= 2" },
							}),
						],
					},
				],
				output: "const x = scale(2);",
			},
			{
				code: "const x = UDim2.fromScale(-1, -1);",
				errors: [{ messageId: "preferReplacement" }],
				options: [
					{
						patterns: [
							pattern({
								match: "UDim2.fromScale($x, $x)",
								replacement: "scale($x)",
								when: { x: "< 0" },
							}),
						],
					},
				],
				output: "const x = scale(-1);",
			},
			{
				code: "const x = UDim2.fromScale(-1, -1);",
				errors: [{ messageId: "preferReplacement" }],
				options: [
					{
						patterns: [
							pattern({
								match: "UDim2.fromScale($x, $x)",
								replacement: "scale($x)",
								when: { x: "<= -1" },
							}),
						],
					},
				],
				output: "const x = scale(-1);",
			},
			{
				code: "const x = UDim2.fromScale(0, 0);",
				errors: [{ messageId: "preferReplacement" }],
				options: [
					{
						patterns: [
							pattern({
								match: "UDim2.fromScale($x, $x)",
								replacement: "scale($x)",
								when: { x: "== 0" },
							}),
						],
					},
				],
				output: "const x = scale(0);",
			},
			{
				code: "const x = UDim2.fromScale(1, 1);",
				errors: [{ messageId: "preferReplacement" }],
				options: [{ patterns: [pattern({ match: "UDim2.fromScale(1, 1)", replacement: "oneScale" })] }],
				output: "const x = oneScale;",
			},
			{
				code: "const x = new Vector2(0.5, 0);",
				errors: [{ messageId: "preferReplacement" }],
				options: [{ patterns: [pattern({ match: "new Vector2($x, 0)", replacement: "fromX($x)" })] }],
				output: "const x = fromX(0.5);",
			},
			{
				code: "const x = new Vector2(0.5);",
				errors: [{ messageId: "preferReplacement" }],
				options: [{ patterns: [pattern({ match: "new Vector2($x, 0?)", replacement: "fromX($x)" })] }],
				output: "const x = fromX(0.5);",
			},
			{
				code: "const x = new Vector2(0.5, 0);",
				errors: [{ messageId: "preferReplacement" }],
				options: [{ patterns: [pattern({ match: "new Vector2($x, 0?)", replacement: "fromX($x)" })] }],
				output: "const x = fromX(0.5);",
			},
			{
				code: "const x = UDim2.fromScale(0.5, 0.5);",
				errors: [{ messageId: "preferReplacement" }],
				options: [{ patterns: [pattern({ match: "UDim2.fromScale($x, $x)", replacement: "scale($x)" })] }],
				output: "const x = scale(0.5);",
			},
			{
				code: "const x = new Vector2(1 - 1, 2 - 2);",
				errors: [{ messageId: "preferReplacement" }],
				options: [{ patterns: [pattern({ match: "new Vector2(0, 0)", replacement: "Vector2.zero" })] }],
				output: "const x = Vector2.zero;",
			},
			{
				code: "const x = UDim2.fromScale(1.5, 1.5);",
				errors: [{ messageId: "preferReplacement" }],
				options: [
					{
						patterns: [
							pattern({
								match: "UDim2.fromScale($x, $x)",
								replacement: "scale($x)",
								when: { x: "!= 0" },
							}),
						],
					},
				],
				output: "const x = scale(1.5);",
			},
			{
				code: "const x = UDim2.fromScale(myVar, myVar);",
				errors: [{ messageId: "preferReplacement" }],
				options: [{ patterns: [pattern({ match: "UDim2.fromScale($x, $x)", replacement: "scale($x)" })] }],
				output: "const x = scale(myVar);",
			},
			{
				code: "const x = new Vector2(-0, -0);",
				errors: [{ messageId: "preferReplacement" }],
				options: [{ patterns: [pattern({ match: "new Vector2(0, 0)", replacement: "Vector2.zero" })] }],
				output: "const x = Vector2.zero;",
			},
			{
				code: "const x = new Vector2(5, anyValue);",
				errors: [{ messageId: "preferReplacement" }],
				options: [{ patterns: [pattern({ match: "new Vector2(5, _)", replacement: "fromFive()" })] }],
				output: "const x = fromFive();",
			},
			{
				code: "const x = Vector2?.create(1, 2);",
				errors: [{ messageId: "preferReplacement" }],
				options: [{ patterns: [pattern({ match: "Vector2.create($x, $y)", replacement: "vec($x, $y)" })] }],
				output: "const x = vec(1, 2);",
			},
			{
				code: "const x = (new Vector2(0, 0) as TSAsExpression);",
				errors: [{ messageId: "preferReplacement" }],
				options: [{ patterns: [pattern({ match: "new Vector2(0, 0)", replacement: "Vector2.zero" })] }],
				output: "const x = (Vector2.zero as TSAsExpression);",
			},
			{
				code: "const x = (new Vector2(0, 0))!;",
				errors: [{ messageId: "preferReplacement" }],
				options: [{ patterns: [pattern({ match: "new Vector2(0, 0)", replacement: "Vector2.zero" })] }],
				output: "const x = (Vector2.zero)!;",
			},
			{
				code: "const x = new Vector2(value, undefined);",
				errors: [{ messageId: "preferReplacement" }],
				options: [{ patterns: [pattern({ match: "new Vector2($x, 0?)", replacement: "fromX($x)" })] }],
				output: "const x = fromX(value);",
			},
			{
				code: "const x = new Vector2(0, 0);",
				errors: [{ messageId: "preferReplacement" }],
				options: [
					{
						patterns: [
							pattern({ match: "new Vector2(1, 1)", replacement: "Vector2.one" }),
							pattern({ match: "new Vector2(0, 0)", replacement: "Vector2.zero" }),
						],
					},
				],
				output: "const x = Vector2.zero;",
			},
			{
				code: "const x = new Vector2((0 as number), 0);",
				errors: [{ messageId: "preferReplacement" }],
				options: [{ patterns: [pattern({ match: "new Vector2(0, 0)", replacement: "Vector2.zero" })] }],
				output: "const x = Vector2.zero;",
			},
			{
				code: "const x = new Vector2(0!, 0);",
				errors: [{ messageId: "preferReplacement" }],
				options: [{ patterns: [pattern({ match: "new Vector2(0, 0)", replacement: "Vector2.zero" })] }],
				output: "const x = Vector2.zero;",
			},
			{
				code: "const x = new Vector2(1, 2);",
				errors: [{ messageId: "preferReplacement" }],
				options: [{ patterns: [pattern({ match: "new Vector2($x, $y)", replacement: "fromValues($x, 0)" })] }],
				output: "const x = fromValues(1, 0);",
			},
			{
				code: 'import { centerScale } from "udim2-utilities"; const x = UDim2.fromScale(0.5, 0.5);',
				errors: [{ messageId: "preferReplacement" }],
				options: [
					{
						patterns: [
							pattern({ match: "UDim2.fromScale(0.5, 0.5)", replacement: "centerScale" }),
						],
					},
				],
				output: 'import { centerScale } from "udim2-utilities"; const x = centerScale;',
			},
			{
				code: "const scale = 5; const x = UDim2.fromScale(1.2, 1.2);",
				errors: [{ data: { conflict: "scale", replacement: "scale(1.2)" }, messageId: "skippedDueToConflict" }],
				options: [{ patterns: [pattern({ match: "UDim2.fromScale($x, $x)", replacement: "scale($x)" })] }],
			},
			{
				code: "const center = 5; const x = new Vector2(0.5, 0.5);",
				errors: [
					{
						data: { original: "new Vector2(0.5, 0.5)", replacement: "fromEqual(0.5)" },
						messageId: "preferReplacement",
					},
					{
						data: { conflict: "center", replacement: "center" },
						messageId: "skippedDueToConflict",
					},
				],
				options: [
					{
						patterns: [
							pattern({ match: "new Vector2(0.5, 0.5)", replacement: "center" }),
							pattern({ match: "new Vector2($x, $x)", replacement: "fromEqual($x)" }),
						],
					},
				],
				output: "const center = 5; const x = fromEqual(0.5);",
			},
		],
		valid: [
			{
				code: "const x = new Vector2(0, 0);",
				options: [{ patterns: [] }],
			},
			{
				code: "const x = new Vector2(1, 1);",
				options: [{ patterns: [pattern({ match: "new Vector2(0, 0)", replacement: "Vector2.zero" })] }],
			},
			{
				code: "const x = UDim2.fromScale(0.5, 0.6);",
				options: [{ patterns: [pattern({ match: "UDim2.fromScale($x, $x)", replacement: "scale($x)" })] }],
			},
			{
				code: "const x = UDim2.fromScale(0, 0);",
				options: [
					{
						patterns: [
							pattern({
								match: "UDim2.fromScale($x, $x)",
								replacement: "scale($x)",
								when: { x: "!= 0" },
							}),
						],
					},
				],
			},
			{
				code: "const x = new Vector2(getX(), getX());",
				options: [{ patterns: [pattern({ match: "new Vector2($x, $x)", replacement: "fromUniform($x)" })] }],
			},
			{
				code: "const x = new Vector2(0, 0, 0);",
				options: [{ patterns: [pattern({ match: "new Vector2(0, 0)", replacement: "Vector2.zero" })] }],
			},
			{
				code: "const x = (new Vector2(1, 1) as Vector2);",
				options: [{ patterns: [pattern({ match: "new Vector2(0, 0)", replacement: "Vector2.zero" })] }],
			},
		],
	});
});
