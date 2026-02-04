import type { InvalidTestCase, ValidTestCase } from "@typescript-eslint/rule-tester";

import { selectorTypeToMessageString } from "../../../../src/utilities/naming-convention-utilities";

type RuleOptions = ReadonlyArray<Record<string, unknown>>;

type RuleInvalidCase = InvalidTestCase<string, RuleOptions>;

type RuleValidCase = ValidTestCase<RuleOptions>;

type FormatTestNames = Record<string, Record<"invalid" | "valid", ReadonlyArray<string>>>;

export const formatTestNames: FormatTestNames = {
	camelCase: {
		invalid: ["snake_case", "UPPER_CASE", "UPPER", "StrictPascalCase"],
		valid: ["strictCamelCase", "lower", "camelCaseUNSTRICT"],
	},
	PascalCase: {
		invalid: ["snake_case", "UPPER_CASE", "strictCamelCase"],
		valid: ["StrictPascalCase", "Pascal", "I18n", "PascalCaseUNSTRICT", "UPPER"],
	},
	StrictPascalCase: {
		invalid: ["snake_case", "UPPER_CASE", "UPPER", "strictCamelCase", "PascalCaseUNSTRICT"],
		valid: ["StrictPascalCase", "Pascal", "I18n"],
	},
	snake_case: {
		invalid: ["UPPER_CASE", "SNAKE_case_UNSTRICT", "strictCamelCase", "StrictPascalCase"],
		valid: ["snake_case", "lower"],
	},
	strictCamelCase: {
		invalid: ["snake_case", "UPPER_CASE", "UPPER", "StrictPascalCase", "camelCaseUNSTRICT"],
		valid: ["strictCamelCase", "lower"],
	},
	UPPER_CASE: {
		invalid: ["lower", "snake_case", "SNAKE_case_UNSTRICT", "strictCamelCase", "StrictPascalCase"],
		valid: ["UPPER_CASE", "UPPER"],
	},
};

const REPLACE_REGEX = /%/gu;
const IGNORED_FILTER = {
	match: false,
	regex: /.gnored/.source,
};

export type Cases = Array<{ code: ReadonlyArray<string>; options: Record<string, unknown> }>;

export interface NamingConventionCases {
	invalid: Array<RuleInvalidCase>;
	valid: Array<RuleValidCase>;
}

interface TestContext {
	code: ReadonlyArray<string>;
	options: Record<string, unknown>;
}

const EXCLUDED_SELECTORS = new Set([
	"default",
	"variableLike",
	"memberLike",
	"typeLike",
	"property",
	"method",
	"accessor",
]);

function buildValidCase(
	preparedName: string,
	options: Record<string, unknown>,
	testCode: ReadonlyArray<string>,
): RuleValidCase {
	return {
		code: `// ${JSON.stringify(options)}\n${testCode
			.map((codeItem) => codeItem.replaceAll(REPLACE_REGEX, preparedName))
			.join("\n")}`,
		options: [{ ...options, filter: IGNORED_FILTER }],
	};
}

function buildInvalidCase(
	preparedName: string,
	options: Record<string, unknown>,
	messageId: string,
	data: Record<string, unknown>,
	context: TestContext,
): RuleInvalidCase {
	const { selector } = context.options;
	const selectors: Array<unknown> = Array.isArray(selector) ? selector : [selector];
	const errors: Array<{ data?: { name: string; type: string }; messageId: string }> = [];

	for (const _codeEntry of context.code) {
		for (const selectorName of selectors) {
			if (typeof selectorName === "string" && !EXCLUDED_SELECTORS.has(selectorName)) {
				errors.push({
					data: {
						name: preparedName,
						type: selectorTypeToMessageString(selectorName),
						...data,
					},
					messageId,
				});
			} else {
				errors.push({ messageId });
			}
		}
	}

	return {
		code: `// ${JSON.stringify(options)}\n${context.code
			.map((codeItem) => codeItem.replaceAll(REPLACE_REGEX, preparedName))
			.join("\n")}`,
		errors,
		options: [{ ...options, filter: IGNORED_FILTER }],
	};
}

export function processTestCases(cases: Cases): NamingConventionCases {
	return {
		invalid: createInvalidTestCases(cases),
		valid: createValidTestCases(cases),
	};
}

function createValidTestCases(cases: Cases): Array<RuleValidCase> {
	const result: Array<RuleValidCase> = [];

	for (const test of cases) {
		for (const [formatLoose, names] of Object.entries(formatTestNames)) {
			for (const name of names.valid) {
				const format = [formatLoose];
				const baseOptions = { ...test.options, format };

				result.push(
					buildValidCase(name, baseOptions, test.code),
					buildValidCase(name, { ...baseOptions, leadingUnderscore: "forbid" }, test.code),
					buildValidCase(`_${name}`, { ...baseOptions, leadingUnderscore: "require" }, test.code),
					buildValidCase(`__${name}`, { ...baseOptions, leadingUnderscore: "requireDouble" }, test.code),
					buildValidCase(`_${name}`, { ...baseOptions, leadingUnderscore: "allow" }, test.code),
					buildValidCase(name, { ...baseOptions, leadingUnderscore: "allow" }, test.code),
					buildValidCase(`__${name}`, { ...baseOptions, leadingUnderscore: "allowDouble" }, test.code),
					buildValidCase(name, { ...baseOptions, leadingUnderscore: "allowDouble" }, test.code),
					buildValidCase(`_${name}`, { ...baseOptions, leadingUnderscore: "allowSingleOrDouble" }, test.code),
					buildValidCase(name, { ...baseOptions, leadingUnderscore: "allowSingleOrDouble" }, test.code),
					buildValidCase(
						`__${name}`,
						{ ...baseOptions, leadingUnderscore: "allowSingleOrDouble" },
						test.code,
					),
					buildValidCase(name, { ...baseOptions, trailingUnderscore: "forbid" }, test.code),
					buildValidCase(`${name}_`, { ...baseOptions, trailingUnderscore: "require" }, test.code),
					buildValidCase(`${name}__`, { ...baseOptions, trailingUnderscore: "requireDouble" }, test.code),
					buildValidCase(`${name}_`, { ...baseOptions, trailingUnderscore: "allow" }, test.code),
					buildValidCase(name, { ...baseOptions, trailingUnderscore: "allow" }, test.code),
					buildValidCase(`${name}__`, { ...baseOptions, trailingUnderscore: "allowDouble" }, test.code),
					buildValidCase(name, { ...baseOptions, trailingUnderscore: "allowDouble" }, test.code),
					buildValidCase(
						`${name}_`,
						{ ...baseOptions, trailingUnderscore: "allowSingleOrDouble" },
						test.code,
					),
					buildValidCase(name, { ...baseOptions, trailingUnderscore: "allowSingleOrDouble" }, test.code),
					buildValidCase(
						`${name}__`,
						{ ...baseOptions, trailingUnderscore: "allowSingleOrDouble" },
						test.code,
					),
					buildValidCase(`MyPrefix${name}`, { ...baseOptions, prefix: ["MyPrefix"] }, test.code),
					buildValidCase(
						`MyPrefix2${name}`,
						{ ...baseOptions, prefix: ["MyPrefix1", "MyPrefix2"] },
						test.code,
					),
					buildValidCase(`${name}MySuffix`, { ...baseOptions, suffix: ["MySuffix"] }, test.code),
					buildValidCase(
						`${name}MySuffix2`,
						{ ...baseOptions, suffix: ["MySuffix1", "MySuffix2"] },
						test.code,
					),
				);
			}
		}
	}

	return result;
}

function createInvalidTestCases(cases: Cases): Array<RuleInvalidCase> {
	const newCases: Array<RuleInvalidCase> = [];
	const prefixSingle = ["MyPrefix"];
	const prefixMulti = ["MyPrefix1", "MyPrefix2"];
	const suffixSingle = ["MySuffix"];
	const suffixMulti = ["MySuffix1", "MySuffix2"];

	for (const test of cases) {
		const context: TestContext = { code: test.code, options: test.options };

		for (const [formatLoose, names] of Object.entries(formatTestNames)) {
			const format = [formatLoose];

			for (const name of names.invalid) {
				const baseOptions = { ...test.options, format };

				newCases.push(
					buildInvalidCase(name, baseOptions, "doesNotMatchFormat", { formats: format.join(", ") }, context),
					buildInvalidCase(
						`_${name}`,
						{ ...baseOptions, leadingUnderscore: "forbid" },
						"unexpectedUnderscore",
						{ position: "leading" },
						context,
					),
					buildInvalidCase(
						name,
						{ ...baseOptions, leadingUnderscore: "require" },
						"missingUnderscore",
						{ count: "one", position: "leading" },
						context,
					),
					buildInvalidCase(
						name,
						{ ...baseOptions, leadingUnderscore: "requireDouble" },
						"missingUnderscore",
						{ count: "two", position: "leading" },
						context,
					),
					buildInvalidCase(
						`_${name}`,
						{ ...baseOptions, leadingUnderscore: "requireDouble" },
						"missingUnderscore",
						{ count: "two", position: "leading" },
						context,
					),
					buildInvalidCase(
						`${name}_`,
						{ ...baseOptions, trailingUnderscore: "forbid" },
						"unexpectedUnderscore",
						{ position: "trailing" },
						context,
					),
					buildInvalidCase(
						name,
						{ ...baseOptions, trailingUnderscore: "require" },
						"missingUnderscore",
						{ count: "one", position: "trailing" },
						context,
					),
					buildInvalidCase(
						name,
						{ ...baseOptions, trailingUnderscore: "requireDouble" },
						"missingUnderscore",
						{ count: "two", position: "trailing" },
						context,
					),
					buildInvalidCase(
						`${name}_`,
						{ ...baseOptions, trailingUnderscore: "requireDouble" },
						"missingUnderscore",
						{ count: "two", position: "trailing" },
						context,
					),
					buildInvalidCase(
						name,
						{ ...baseOptions, prefix: prefixSingle },
						"missingAffix",
						{ affixes: prefixSingle.join(", "), position: "prefix" },
						context,
					),
					buildInvalidCase(
						name,
						{ ...baseOptions, prefix: prefixMulti },
						"missingAffix",
						{ affixes: prefixMulti.join(", "), position: "prefix" },
						context,
					),
					buildInvalidCase(
						name,
						{ ...baseOptions, suffix: suffixSingle },
						"missingAffix",
						{ affixes: suffixSingle.join(", "), position: "suffix" },
						context,
					),
					buildInvalidCase(
						name,
						{ ...baseOptions, suffix: suffixMulti },
						"missingAffix",
						{ affixes: suffixMulti.join(", "), position: "suffix" },
						context,
					),
				);
			}
		}
	}

	return newCases;
}
