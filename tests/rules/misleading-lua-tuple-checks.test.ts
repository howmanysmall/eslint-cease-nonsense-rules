import { describe, setDefaultTimeout } from "bun:test";
import { join } from "node:path";
import tsParser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import rule from "../../src/rules/misleading-lua-tuple-checks";

// Type-aware tests have cold-start overhead from TypeScript project service initialization
setDefaultTimeout(30_000);

const fixturesDir = join(__dirname, "../fixtures/misleading-lua-tuple-checks");

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser: tsParser,
		parserOptions: {
			ecmaFeatures: { jsx: true },
			projectService: {
				allowDefaultProject: ["*.ts", "*.tsx"],
				defaultProject: join(fixturesDir, "tsconfig.json"),
			},
			tsconfigRootDir: fixturesDir,
		},
		sourceType: "module",
	},
});

// Type declarations must be inlined for RuleTester virtual files.
const typeDeclarations = `
declare type LuaTuple<T extends unknown[]> = T & { readonly LUA_TUPLE: never };
declare function getLuaTuple(): LuaTuple<[boolean, string]>;
declare function getNonLuaTuple(): [boolean, string];
declare function getIterableLuaTuple(): IterableFunction<LuaTuple<[boolean, string]>>;
declare type IterableFunction<T> = () => T;
declare function getLuaTupleAlias(): LuaTuple<[number]>;
type MyLuaTuple = LuaTuple<[string]>;
declare function getMyLuaTuple(): MyLuaTuple;
`;

describe("misleading-lua-tuple-checks", () => {
	// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
	ruleTester.run("misleading-lua-tuple-checks", rule, {
		invalid: [
			// LuaTuple in if condition - should error
			{
				code: `${typeDeclarations}
if (getLuaTuple()) {
  // ...
}`,
				errors: [{ messageId: "misleadingLuaTupleCheck" }],
				output: `${typeDeclarations}
if (getLuaTuple()[0]) {
  // ...
}`,
			},
			// LuaTuple in ternary condition - should error
			{
				code: `${typeDeclarations}
const result = getLuaTuple() ? 'yes' : 'no';`,
				errors: [{ messageId: "misleadingLuaTupleCheck" }],
				output: `${typeDeclarations}
const result = getLuaTuple()[0] ? 'yes' : 'no';`,
			},
			// LuaTuple in while condition - should error
			{
				code: `${typeDeclarations}
while (getLuaTuple()) {
  // ...
}`,
				errors: [{ messageId: "misleadingLuaTupleCheck" }],
				output: `${typeDeclarations}
while (getLuaTuple()[0]) {
  // ...
}`,
			},
			// LuaTuple variable declaration without destructuring - should error
			{
				code: `${typeDeclarations}
const result = getLuaTuple();`,
				errors: [{ messageId: "luaTupleDeclaration" }],
				output: `${typeDeclarations}
const [result] = getLuaTuple();`,
			},
			// LuaTuple in do-while condition - should error
			{
				code: `${typeDeclarations}
do {
  // ...
} while (getLuaTuple());`,
				errors: [{ messageId: "misleadingLuaTupleCheck" }],
				output: `${typeDeclarations}
do {
  // ...
} while (getLuaTuple()[0]);`,
			},
			// LuaTuple in for statement condition - should error
			{
				code: `${typeDeclarations}
for (let i = 0; getLuaTuple(); i++) {
  // ...
}`,
				errors: [{ messageId: "misleadingLuaTupleCheck" }],
				output: `${typeDeclarations}
for (let i = 0; getLuaTuple()[0]; i++) {
  // ...
}`,
			},
			// LuaTuple in logical expression left side (&&)
			{
				code: `${typeDeclarations}
if (getLuaTuple() && something) {
  // ...
}`,
				errors: [{ messageId: "misleadingLuaTupleCheck" }],
				output: `${typeDeclarations}
if (getLuaTuple()[0] && something) {
  // ...
}`,
			},
			// LuaTuple in logical expression right side (&&)
			{
				code: `${typeDeclarations}
if (something && getLuaTuple()) {
  // ...
}`,
				errors: [{ messageId: "misleadingLuaTupleCheck" }],
				output: `${typeDeclarations}
if (something && getLuaTuple()[0]) {
  // ...
}`,
			},
			// LuaTuple in logical expression left side (||)
			{
				code: `${typeDeclarations}
if (getLuaTuple() || something) {
  // ...
}`,
				errors: [{ messageId: "misleadingLuaTupleCheck" }],
				output: `${typeDeclarations}
if (getLuaTuple()[0] || something) {
  // ...
}`,
			},
			// LuaTuple in logical expression right side (||)
			{
				code: `${typeDeclarations}
if (something || getLuaTuple()) {
  // ...
}`,
				errors: [{ messageId: "misleadingLuaTupleCheck" }],
				output: `${typeDeclarations}
if (something || getLuaTuple()[0]) {
  // ...
}`,
			},
			// LuaTuple in unary expression (!)
			{
				code: `${typeDeclarations}
if (!getLuaTuple()) {
  // ...
}`,
				errors: [{ messageId: "misleadingLuaTupleCheck" }],
				output: `${typeDeclarations}
if (!getLuaTuple()[0]) {
  // ...
}`,
			},
			// Assignment expression with LuaTuple
			{
				code: `${typeDeclarations}
let x;
x = getLuaTuple();`,
				errors: [{ messageId: "luaTupleDeclaration" }],
				output: `${typeDeclarations}
let x;
[x] = getLuaTuple();`,
			},
			// Variable declaration with type annotation
			{
				code: `${typeDeclarations}
const result: LuaTuple<[boolean, string]> = getLuaTuple();`,
				errors: [{ messageId: "luaTupleDeclaration" }],
				output: `${typeDeclarations}
const [result]: LuaTuple<[boolean, string]> = getLuaTuple();`,
			},
			// Assignment where left is already destructured (should error because left is not LuaTuple)
			{
				code: `${typeDeclarations}
let [x] = getLuaTuple();
x = getLuaTuple();`,
				errors: [{ messageId: "luaTupleDeclaration" }],
				output: `${typeDeclarations}
let [x] = getLuaTuple();
[x] = getLuaTuple();`,
			},
			// LogicalExpression - both sides checked by LogicalExpression visitor (not containsBoolean)
			{
				code: `${typeDeclarations}
if (getLuaTuple() && getLuaTuple()) {
  // ...
}`,
				errors: [{ messageId: "misleadingLuaTupleCheck" }, { messageId: "misleadingLuaTupleCheck" }],
				output: `${typeDeclarations}
if (getLuaTuple()[0] && getLuaTuple()[0]) {
  // ...
}`,
			},
		],
		valid: [
			// LuaTuple with [0] indexing - valid
			{
				code: `${typeDeclarations}
if (getLuaTuple()[0]) {
  // ...
}`,
			},
			// LuaTuple with array destructuring - valid
			{
				code: `${typeDeclarations}
const [result] = getLuaTuple();`,
			},
			// Non-LuaTuple types in conditions - valid
			{
				code: `${typeDeclarations}
if (getNonLuaTuple()) {
  // ...
}`,
			},
			// Non-LuaTuple variable declaration - valid
			{
				code: `${typeDeclarations}
const result = getNonLuaTuple();`,
			},
			// Do-while with [0] indexing - valid
			{
				code: `${typeDeclarations}
do {
  // ...
} while (getLuaTuple()[0]);`,
			},
			// For statement with [0] indexing - valid
			{
				code: `${typeDeclarations}
for (let i = 0; getLuaTuple()[0]; i++) {
  // ...
}`,
			},
			// Logical expression with [0] indexing - valid
			{
				code: `${typeDeclarations}
if (getLuaTuple()[0] && something) {
  // ...
}`,
			},
			{
				code: `${typeDeclarations}
if (something && getLuaTuple()[0]) {
  // ...
}`,
			},
			// Unary expression with [0] indexing - valid
			{
				code: `${typeDeclarations}
if (!getLuaTuple()[0]) {
  // ...
}`,
			},
			// Other unary operators (should not error)
			{
				code: `${typeDeclarations}
if (+getLuaTuple()) {
  // ...
}`,
			},
			// Assignment with non-Identifier left side (should not error)
			{
				code: `${typeDeclarations}
let obj = {};
obj.prop = getLuaTuple();`,
			},
			// Assignment with non-= operator (should not error)
			{
				code: `${typeDeclarations}
let x = 0;
x += getLuaTuple();`,
			},
			// VariableDeclarator with non-Identifier id (should not error)
			{
				code: `${typeDeclarations}
const [x, y] = getLuaTuple();`,
			},
			// VariableDeclarator with no init (should not error)
			{
				code: `${typeDeclarations}
let x;`,
			},
			// ForOfStatement with iterable function type
			{
				code: `${typeDeclarations}
for (const x of getIterableLuaTuple()) {
  // ...
}`,
			},
			// ForOfStatement with VariableDeclaration left side
			{
				code: `${typeDeclarations}
for (let x of getIterableLuaTuple()) {
  // ...
}`,
			},
			// Type alias/reference to LuaTuple with destructuring
			{
				code: `${typeDeclarations}
const [result] = getMyLuaTuple();`,
			},
			// Assignment with MemberExpression left (should not error)
			{
				code: `${typeDeclarations}
const obj = { prop: null };
obj.prop = getLuaTuple();`,
			},
			// Assignment with array element left (should not error)
			{
				code: `${typeDeclarations}
const arr = [null];
arr[0] = getLuaTuple();`,
			},
			// VariableDeclarator with already destructured id (should not error)
			{
				code: `${typeDeclarations}
const [x] = getLuaTuple();`,
			},
			// ForOfStatement with VariableDeclaration but non-Identifier id (should not error)
			{
				code: `${typeDeclarations}
for (let [x, y] of getIterableLuaTuple()) {
  // ...
}`,
			},
		],
	});
});
