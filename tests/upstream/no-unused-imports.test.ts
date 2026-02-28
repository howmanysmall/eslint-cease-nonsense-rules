import parser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";

import rule from "../../src/rules/no-unused-imports";
import casesJs from "./no-unused-imports/cases-js";
import casesTs from "./no-unused-imports/cases-ts";

interface UpstreamValidCase {
	readonly code: string;
	readonly options?: ReadonlyArray<Record<string, unknown>>;
}

interface UpstreamInvalidCase {
	readonly code: string;
	readonly errors: ReadonlyArray<string>;
	readonly options?: ReadonlyArray<Record<string, unknown>>;
	readonly output: string;
}

interface UpstreamCases {
	readonly invalid: ReadonlyArray<UpstreamInvalidCase>;
	readonly valid: ReadonlyArray<UpstreamValidCase>;
}

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser,
		sourceType: "module",
	},
});

function toInvalidCases(
	cases: UpstreamCases,
): ReadonlyArray<UpstreamInvalidCase & { errors: ReadonlyArray<{ messageId: string }> }> {
	// @ts-expect-error - The types for RuleTester are very broken and don't allow for the actual structure of the test cases.
	return cases.invalid.map((testCase) => ({
		...testCase,
		errors: testCase.errors.map(() => ({ messageId: "unusedImport" })),
	}));
}

function getValidCaseKey(testCase: UpstreamValidCase): string {
	const optionsKey = testCase.options ? JSON.stringify(testCase.options) : "";
	return `${testCase.code}|${optionsKey}`;
}

function dedupeValidCases(cases: ReadonlyArray<UpstreamValidCase>): ReadonlyArray<UpstreamValidCase> {
	const seen = new Set<string>();
	const unique: Array<UpstreamValidCase> = [];

	for (const testCase of cases) {
		const key = getValidCaseKey(testCase);
		if (seen.has(key)) continue;
		seen.add(key);
		unique.push(testCase);
	}

	return unique;
}

const invalid = [...toInvalidCases(casesJs), ...toInvalidCases(casesTs)];
const valid = dedupeValidCases([...casesJs.valid, ...casesTs.valid]);

// @ts-expect-error - The types for RuleTester are very broken and don't allow for the actual structure of the test cases.
ruleTester.run("no-unused-imports", rule, { invalid, valid });
