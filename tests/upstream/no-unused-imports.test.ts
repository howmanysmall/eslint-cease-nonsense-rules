import parser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";

import rule from "../../src/rules/no-unused-imports";
import casesJs from "./no-unused-imports/cases-js";
import casesTs from "./no-unused-imports/cases-ts";

type UpstreamValidCase = {
	readonly code: string;
	readonly options?: ReadonlyArray<Record<string, unknown>>;
};

type UpstreamInvalidCase = {
	readonly code: string;
	readonly errors: ReadonlyArray<string>;
	readonly output: string;
	readonly options?: ReadonlyArray<Record<string, unknown>>;
};

type UpstreamCases = {
	readonly valid: ReadonlyArray<UpstreamValidCase>;
	readonly invalid: ReadonlyArray<UpstreamInvalidCase>;
};

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser,
		sourceType: "module",
	},
});

function toInvalidCases(cases: UpstreamCases): ReadonlyArray<UpstreamInvalidCase & { errors: ReadonlyArray<{ messageId: string }> }> {
	return cases.invalid.map((testCase) => ({
		...testCase,
		errors: testCase.errors.map(() => ({ messageId: "unusedImport" })),
	}));
}

const invalid = [...toInvalidCases(casesJs), ...toInvalidCases(casesTs)];
const valid = [...casesJs.valid, ...casesTs.valid];

ruleTester.run("no-unused-imports", rule, { invalid, valid });
