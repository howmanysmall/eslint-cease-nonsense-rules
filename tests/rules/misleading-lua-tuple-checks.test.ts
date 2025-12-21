import { describe } from "bun:test";
import tsParser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import path from "node:path";
import rule from "../../src/rules/misleading-lua-tuple-checks";

const fixturesDir = path.join(__dirname, "../fixtures");

const TYPE_DECLARATIONS = `
declare type LuaTuple<T extends Array<unknown>> = T & { readonly __LuaTuple?: never };
declare function pcall<T extends Array<unknown>>(callback: () => T): LuaTuple<[boolean, ...T]>;
declare function getLuaTuple(): LuaTuple<[string, number]>;
declare function getRegularArray(): [string, number];
declare function getEitherTuple(): LuaTuple<[string]> | LuaTuple<[number]>;
declare function getLuaTupleArray(): Array<LuaTuple<[string, number]>>;
declare function getIntersectionArray(): Array<LuaTuple<[string]>> & { extra: boolean };
declare let globalResult: LuaTuple<[boolean]>;
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
			{
				code: `${TYPE_DECLARATIONS}
const result = getEitherTuple();
if (result) {
	console.log("success");
}`,
				errors: [
					{ messageId: "lua-tuple-declaration" },
					{ messageId: "misleading-lua-tuple-check" },
				],
				output: `${TYPE_DECLARATIONS}
const [result] = getEitherTuple();
if (result[0]) {
	console.log("success");
}`,
			},
			{
				code: `${TYPE_DECLARATIONS}
const result: LuaTuple<[string, number]> = getLuaTuple();`,
				errors: [{ messageId: "lua-tuple-declaration" }],
				output: `${TYPE_DECLARATIONS}
const [result]: LuaTuple<[string, number]> = getLuaTuple();`,
			},
			{
				code: `${TYPE_DECLARATIONS}
globalResult = pcall(() => [true]);`,
				errors: [{ messageId: "lua-tuple-declaration" }],
				output: `${TYPE_DECLARATIONS}
[globalResult] = pcall(() => [true]);`,
			},
			{
				code: `${TYPE_DECLARATIONS}
for (const item of getLuaTupleArray()) {
	console.log(item);
}`,
				errors: [{ messageId: "lua-tuple-declaration" }],
				output: `${TYPE_DECLARATIONS}
for (const [item] of getLuaTupleArray()) {
	console.log(item);
}`,
			},
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
			{
				code: `${TYPE_DECLARATIONS}
const result = pcall(() => [1]);
const check = false || result;`,
				errors: [
					{ messageId: "lua-tuple-declaration" },
					{ messageId: "lua-tuple-declaration" },
					{ messageId: "misleading-lua-tuple-check" },
				],
				output: `${TYPE_DECLARATIONS}
const [result] = pcall(() => [1]);
const [check] = false || result[0];`,
			},
			{
				code: `${TYPE_DECLARATIONS}
const a = pcall(() => [1]);
const b = pcall(() => [2]);
const check = a && b;`,
				errors: [
					{ messageId: "lua-tuple-declaration" },
					{ messageId: "lua-tuple-declaration" },
					{ messageId: "lua-tuple-declaration" },
					{ messageId: "misleading-lua-tuple-check" },
					{ messageId: "misleading-lua-tuple-check" },
				],
				output: `${TYPE_DECLARATIONS}
const [a] = pcall(() => [1]);
const [b] = pcall(() => [2]);
const [check] = a[0] && b[0];`,
			},
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
			{
				code: `${TYPE_DECLARATIONS}
const result = getLuaTuple();`,
				errors: [{ messageId: "lua-tuple-declaration" }],
				output: `${TYPE_DECLARATIONS}
const [result] = getLuaTuple();`,
			},
			{
				code: `${TYPE_DECLARATIONS}
let result = getLuaTuple();`,
				errors: [{ messageId: "lua-tuple-declaration" }],
				output: `${TYPE_DECLARATIONS}
let [result] = getLuaTuple();`,
			},
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
			`${TYPE_DECLARATIONS}
const [success] = pcall(() => [1]);
if (success) {
	console.log("success");
}`,
			`${TYPE_DECLARATIONS}
const [success] = pcall(() => [1]);
const value = success ? "yes" : "no";`,
			`${TYPE_DECLARATIONS}
const [success] = pcall(() => [1]);
const check = success && true;`,
			`${TYPE_DECLARATIONS}
const [success, value] = getLuaTuple();`,
			`${TYPE_DECLARATIONS}
const [result] = getLuaTuple();`,
			`${TYPE_DECLARATIONS}
const result = getRegularArray();
if (result) {
	console.log("success");
}`,
			`${TYPE_DECLARATIONS}
const result = getRegularArray();`,
			`${TYPE_DECLARATIONS}
const [success, data] = pcall(() => [1]);
console.log(success);`,
			`${TYPE_DECLARATIONS}
const [success, data] = pcall(() => [{ value: 1 }]);
if (success) {
	console.log(data);
}`,
			`${TYPE_DECLARATIONS}
declare function getMaybeResult(): LuaTuple<[string, number]> | undefined;
const result = getMaybeResult();
if (result) {
	console.log("got result");
}`,
			`${TYPE_DECLARATIONS}
declare function getResultOrError(): LuaTuple<[string, number]> | string;
const result = getResultOrError();
if (result) {
	console.log("got result");
}`,
			`${TYPE_DECLARATIONS}
let result: LuaTuple<[string, number]>;`,
		],
	});
});
