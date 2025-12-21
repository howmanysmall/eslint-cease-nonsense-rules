import { describe } from "bun:test";
import tsParser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import path from "node:path";
import rule from "../../src/rules/misleading-lua-tuple-checks";

const fixturesDir = path.join(__dirname, "../fixtures");

// Type declarations to prepend to each test
const TYPE_DECLARATIONS = `
declare type LuaTuple<T extends Array<unknown>> = T & { readonly __LuaTuple?: never };
declare function pcall<T extends Array<unknown>>(callback: () => T): LuaTuple<[boolean, ...T]>;
declare function getLuaTuple(): LuaTuple<[string, number]>;
declare function getRegularArray(): [string, number];
`;

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser: tsParser,
		parserOptions: {
			projectService: {
				allowDefaultProject: ["*.ts"],
				defaultProject: path.join(fixturesDir, "tsconfig.json"),
			},
			tsconfigRootDir: fixturesDir,
		},
		sourceType: "module",
	},
});

describe("misleading-lua-tuple-checks", () => {
	// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
	ruleTester.run("misleading-lua-tuple-checks", rule, {
		invalid: [
			// ==========================================
			// Conditional expressions (if, while, for, do-while, ternary)
			// ==========================================

			// If statement with LuaTuple
			{
				code: `${TYPE_DECLARATIONS}
const [success] = pcall(() => [1]);
const result = pcall(() => [2]);
if (result) {
	console.log("success");
}`,
				errors: [
					{ messageId: "lua-tuple-declaration" },
					{ messageId: "misleading-lua-tuple-check" },
				],
				output: `${TYPE_DECLARATIONS}
const [success] = pcall(() => [1]);
const [result] = pcall(() => [2]);
if (result[0]) {
	console.log("success");
}`,
			},

			// While statement with LuaTuple
			{
				code: `${TYPE_DECLARATIONS}
const result = pcall(() => [true]);
while (result) {
	break;
}`,
				errors: [
					{ messageId: "lua-tuple-declaration" },
					{ messageId: "misleading-lua-tuple-check" },
				],
				output: `${TYPE_DECLARATIONS}
const [result] = pcall(() => [true]);
while (result[0]) {
	break;
}`,
			},

			// Do-while statement with LuaTuple
			{
				code: `${TYPE_DECLARATIONS}
const result = pcall(() => [true]);
do {
	break;
} while (result);`,
				errors: [
					{ messageId: "lua-tuple-declaration" },
					{ messageId: "misleading-lua-tuple-check" },
				],
				output: `${TYPE_DECLARATIONS}
const [result] = pcall(() => [true]);
do {
	break;
} while (result[0]);`,
			},

			// For statement with LuaTuple as test condition
			{
				code: `${TYPE_DECLARATIONS}
const result = pcall(() => [true]);
for (; result; ) {
	break;
}`,
				errors: [
					{ messageId: "lua-tuple-declaration" },
					{ messageId: "misleading-lua-tuple-check" },
				],
				output: `${TYPE_DECLARATIONS}
const [result] = pcall(() => [true]);
for (; result[0]; ) {
	break;
}`,
			},

			// Ternary expression with LuaTuple
			{
				code: `${TYPE_DECLARATIONS}
const result = pcall(() => [1]);
const value = result ? "yes" : "no";`,
				errors: [
					{ messageId: "lua-tuple-declaration" },
					{ messageId: "misleading-lua-tuple-check" },
				],
				output: `${TYPE_DECLARATIONS}
const [result] = pcall(() => [1]);
const value = result[0] ? "yes" : "no";`,
			},

			// ==========================================
			// Logical expressions (&&, ||)
			// ==========================================

			// Left operand of &&
			{
				code: `${TYPE_DECLARATIONS}
const result = pcall(() => [1]);
const check = result && true;`,
				errors: [
					{ messageId: "lua-tuple-declaration" },
					{ messageId: "misleading-lua-tuple-check" },
				],
				output: `${TYPE_DECLARATIONS}
const [result] = pcall(() => [1]);
const check = result[0] && true;`,
			},

			// Right operand of ||
			{
				code: `${TYPE_DECLARATIONS}
const result = pcall(() => [1]);
const check = false || result;`,
				errors: [
					// Const result
					{ messageId: "lua-tuple-declaration" },
					// Const check (result of || is LuaTuple)
					{ messageId: "lua-tuple-declaration" },
					// Result in ||
					{ messageId: "misleading-lua-tuple-check" },
				],
				output: `${TYPE_DECLARATIONS}
const [result] = pcall(() => [1]);
const [check] = false || result[0];`,
			},

			// Both operands are LuaTuple - expects 5 errors
			// (a decl, b decl, check decl because check = a && b is also LuaTuple, a check, b check)
			{
				code: `${TYPE_DECLARATIONS}
const a = pcall(() => [1]);
const b = pcall(() => [2]);
const check = a && b;`,
				errors: [
					// Const a
					{ messageId: "lua-tuple-declaration" },
					// Const b
					{ messageId: "lua-tuple-declaration" },
					// Const check (result of && is LuaTuple)
					{ messageId: "lua-tuple-declaration" },
					// A in condition
					{ messageId: "misleading-lua-tuple-check" },
					// B in condition
					{ messageId: "misleading-lua-tuple-check" },
				],
				output: `${TYPE_DECLARATIONS}
const [a] = pcall(() => [1]);
const [b] = pcall(() => [2]);
const [check] = a[0] && b[0];`,
			},

			// ==========================================
			// Unary negation (!)
			// ==========================================

			// Negation of LuaTuple
			{
				code: `${TYPE_DECLARATIONS}
const result = pcall(() => [1]);
if (!result) {
	console.log("failed");
}`,
				errors: [
					{ messageId: "lua-tuple-declaration" },
					{ messageId: "misleading-lua-tuple-check" },
				],
				output: `${TYPE_DECLARATIONS}
const [result] = pcall(() => [1]);
if (!result[0]) {
	console.log("failed");
}`,
			},

			// ==========================================
			// Variable declarations without destructuring
			// ==========================================

			// Simple variable declaration
			{
				code: `${TYPE_DECLARATIONS}
const result = getLuaTuple();`,
				errors: [{ messageId: "lua-tuple-declaration" }],
				output: `${TYPE_DECLARATIONS}
const [result] = getLuaTuple();`,
			},

			// Let declaration
			{
				code: `${TYPE_DECLARATIONS}
let result = getLuaTuple();`,
				errors: [{ messageId: "lua-tuple-declaration" }],
				output: `${TYPE_DECLARATIONS}
let [result] = getLuaTuple();`,
			},

			// Direct call in if statement
			{
				code: `${TYPE_DECLARATIONS}
if (getLuaTuple()) {
	console.log("success");
}`,
				errors: [{ messageId: "misleading-lua-tuple-check" }],
				output: `${TYPE_DECLARATIONS}
if (getLuaTuple()[0]) {
	console.log("success");
}`,
			},

			// ==========================================
			// Union types containing LuaTuple
			// ==========================================
			{
				code: `${TYPE_DECLARATIONS}
declare function getMaybeResult(): LuaTuple<[string, number]> | undefined;
const result = getMaybeResult();
if (result) {
	console.log("got result");
}`,
				errors: [
					{ messageId: "lua-tuple-declaration" },
					{ messageId: "misleading-lua-tuple-check" },
				],
				output: `${TYPE_DECLARATIONS}
declare function getMaybeResult(): LuaTuple<[string, number]> | undefined;
const [result] = getMaybeResult();
if (result[0]) {
	console.log("got result");
}`,
			},

			// ==========================================
			// Type parameter with LuaTuple constraint
			// ==========================================
			{
				code: `${TYPE_DECLARATIONS}
function process<T extends LuaTuple<[boolean, string]>>(tuple: T) {
	const result = tuple;
	if (result) {
		return result;
	}
}`,
				errors: [
					{ messageId: "lua-tuple-declaration" },
					{ messageId: "misleading-lua-tuple-check" },
				],
				output: `${TYPE_DECLARATIONS}
function process<T extends LuaTuple<[boolean, string]>>(tuple: T) {
	const [result] = tuple;
	if (result[0]) {
		return result;
	}
}`,
			},
		],
		valid: [
			// ==========================================
			// Already using destructuring in declarations
			// ==========================================

			// Destructure then use in condition
			`${TYPE_DECLARATIONS}
const [success] = pcall(() => [1]);
if (success) {
	console.log("success");
}`,

			// Index access in ternary (after proper assignment)
			`${TYPE_DECLARATIONS}
const [success] = pcall(() => [1]);
const value = success ? "yes" : "no";`,

			// Index access in logical expression
			`${TYPE_DECLARATIONS}
const [success] = pcall(() => [1]);
const check = success && true;`,

			// ==========================================
			// Already using destructuring
			// ==========================================

			// Destructured variable declaration
			`${TYPE_DECLARATIONS}
const [success, value] = getLuaTuple();`,

			// Destructured with single element
			`${TYPE_DECLARATIONS}
const [result] = getLuaTuple();`,

			// ==========================================
			// Regular arrays (not LuaTuple)
			// ==========================================

			// Regular tuple function - NOT a LuaTuple so no error
			`${TYPE_DECLARATIONS}
const result = getRegularArray();
if (result) {
	console.log("success");
}`,

			// Regular array variable declaration - NOT a LuaTuple
			`${TYPE_DECLARATIONS}
const result = getRegularArray();`,

			// ==========================================
			// LuaTuple elements accessed properly
			// ==========================================

			// Using first element via destructuring
			`${TYPE_DECLARATIONS}
const [success, data] = pcall(() => [1]);
console.log(success);`,

			// Using multiple elements via destructuring
			`${TYPE_DECLARATIONS}
const [success, data] = pcall(() => [{ value: 1 }]);
if (success) {
	console.log(data);
}`,

			// ==========================================
			// No init value
			// ==========================================

			// Variable declaration without init
			`${TYPE_DECLARATIONS}
let result: LuaTuple<[string, number]>;`,
		],
	});
});
