import type { InvalidTestCase, ValidTestCase } from "@typescript-eslint/rule-tester";

import { selectorTypeToMessageString } from "../../../../src/rules/naming-convention-utils";

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
	snake_case: {
		invalid: ["UPPER_CASE", "SNAKE_case_UNSTRICT", "strictCamelCase", "StrictPascalCase"],
		valid: ["snake_case", "lower"],
	},
	strictCamelCase: {
		invalid: ["snake_case", "UPPER_CASE", "UPPER", "StrictPascalCase", "camelCaseUNSTRICT"],
		valid: ["strictCamelCase", "lower"],
	},
	StrictPascalCase: {
		invalid: ["snake_case", "UPPER_CASE", "UPPER", "strictCamelCase", "PascalCaseUNSTRICT"],
		valid: ["StrictPascalCase", "Pascal", "I18n"],
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

type Cases = Array<{ code: ReadonlyArray<string>; options: Record<string, unknown> }>;

const validCases: Array<RuleValidCase> = [];
const invalidCases: Array<RuleInvalidCase> = [];

export function getNamingConventionCases(): { invalid: Array<RuleInvalidCase>; valid: Array<RuleValidCase> } {
	return {
		invalid: [...invalidCases],
		valid: [...validCases],
	};
}

function createValidTestCases(cases: Cases): Array<RuleValidCase> {
	return cases.flatMap((test) =>
		Object.entries(formatTestNames).flatMap(([formatLoose, names]) =>
			names.valid.flatMap((name) => {
				const format = [formatLoose];
				const createCase = (preparedName: string, options: Record<string, unknown>): RuleValidCase => ({
					code: `// ${JSON.stringify(options)}\n${test.code
						.map((code) => code.replaceAll(REPLACE_REGEX, preparedName))
						.join("\n")}`,
					options: [{ ...options, filter: IGNORED_FILTER }],
				});

				return [
					createCase(name, { ...test.options, format }),
					createCase(name, { ...test.options, format, leadingUnderscore: "forbid" }),
					createCase(`_${name}`, { ...test.options, format, leadingUnderscore: "require" }),
					createCase(`__${name}`, { ...test.options, format, leadingUnderscore: "requireDouble" }),
					createCase(`_${name}`, { ...test.options, format, leadingUnderscore: "allow" }),
					createCase(name, { ...test.options, format, leadingUnderscore: "allow" }),
					createCase(`__${name}`, { ...test.options, format, leadingUnderscore: "allowDouble" }),
					createCase(name, { ...test.options, format, leadingUnderscore: "allowDouble" }),
					createCase(`_${name}`, { ...test.options, format, leadingUnderscore: "allowSingleOrDouble" }),
					createCase(name, { ...test.options, format, leadingUnderscore: "allowSingleOrDouble" }),
					createCase(`__${name}`, { ...test.options, format, leadingUnderscore: "allowSingleOrDouble" }),
					createCase(name, { ...test.options, format, trailingUnderscore: "forbid" }),
					createCase(`${name}_`, { ...test.options, format, trailingUnderscore: "require" }),
					createCase(`${name}__`, { ...test.options, format, trailingUnderscore: "requireDouble" }),
					createCase(`${name}_`, { ...test.options, format, trailingUnderscore: "allow" }),
					createCase(name, { ...test.options, format, trailingUnderscore: "allow" }),
					createCase(`${name}__`, { ...test.options, format, trailingUnderscore: "allowDouble" }),
					createCase(name, { ...test.options, format, trailingUnderscore: "allowDouble" }),
					createCase(`${name}_`, { ...test.options, format, trailingUnderscore: "allowSingleOrDouble" }),
					createCase(name, { ...test.options, format, trailingUnderscore: "allowSingleOrDouble" }),
					createCase(`${name}__`, { ...test.options, format, trailingUnderscore: "allowSingleOrDouble" }),
					createCase(`MyPrefix${name}`, { ...test.options, format, prefix: ["MyPrefix"] }),
					createCase(`MyPrefix2${name}`, {
						...test.options,
						format,
						prefix: ["MyPrefix1", "MyPrefix2"],
					}),
					createCase(`${name}MySuffix`, { ...test.options, format, suffix: ["MySuffix"] }),
					createCase(`${name}MySuffix2`, {
						...test.options,
						format,
						suffix: ["MySuffix1", "MySuffix2"],
					}),
				];
			}),
		),
	);
}

function createInvalidTestCases(cases: Cases): Array<RuleInvalidCase> {
	const newCases: Array<RuleInvalidCase> = [];

	for (const test of cases) {
		for (const [formatLoose, names] of Object.entries(formatTestNames)) {
			const format = [formatLoose];
			for (const name of names.invalid) {
				const createCase = (
					preparedName: string,
					options: Record<string, unknown>,
					messageId: string,
					data: Record<string, unknown> = {},
				): RuleInvalidCase => {
					const selector = test.options.selector;
					const selectors = Array.isArray(selector) ? selector : [selector];
					const errorsTemplate = selectors.map((selectorName) => ({
						messageId,
						...(selectorName !== "default" &&
						selectorName !== "variableLike" &&
						selectorName !== "memberLike" &&
						selectorName !== "typeLike" &&
						selectorName !== "property" &&
						selectorName !== "method" &&
						selectorName !== "accessor"
							? {
								data: {
									name: preparedName,
									type: selectorTypeToMessageString(selectorName),
									...data,
								},
							}
							: {}),
					}));

					const errors: Array<{ data?: { name: string; type: string }; messageId: string }> = [];
					for (const codeEntry of test.code) {
						void codeEntry;
						errors.push(...errorsTemplate);
					}

					return {
						code: `// ${JSON.stringify(options)}\n${test.code
							.map((code) => code.replaceAll(REPLACE_REGEX, preparedName))
							.join("\n")}`,
						errors,
						options: [{ ...options, filter: IGNORED_FILTER }],
					};
				};

				const prefixSingle = ["MyPrefix"];
				const prefixMulti = ["MyPrefix1", "MyPrefix2"];
				const suffixSingle = ["MySuffix"];
				const suffixMulti = ["MySuffix1", "MySuffix2"];

				newCases.push(
					createCase(name, { ...test.options, format }, "doesNotMatchFormat", {
						formats: format.join(", "),
					}),
					createCase(`_${name}`, { ...test.options, format, leadingUnderscore: "forbid" }, "unexpectedUnderscore", {
						position: "leading",
					}),
					createCase(name, { ...test.options, format, leadingUnderscore: "require" }, "missingUnderscore", {
						count: "one",
						position: "leading",
					}),
					createCase(name, { ...test.options, format, leadingUnderscore: "requireDouble" }, "missingUnderscore", {
						count: "two",
						position: "leading",
					}),
					createCase(`_${name}`, { ...test.options, format, leadingUnderscore: "requireDouble" }, "missingUnderscore", {
						count: "two",
						position: "leading",
					}),
					createCase(`${name}_`, { ...test.options, format, trailingUnderscore: "forbid" }, "unexpectedUnderscore", {
						position: "trailing",
					}),
					createCase(name, { ...test.options, format, trailingUnderscore: "require" }, "missingUnderscore", {
						count: "one",
						position: "trailing",
					}),
					createCase(name, { ...test.options, format, trailingUnderscore: "requireDouble" }, "missingUnderscore", {
						count: "two",
						position: "trailing",
					}),
					createCase(`${name}_`, { ...test.options, format, trailingUnderscore: "requireDouble" }, "missingUnderscore", {
						count: "two",
						position: "trailing",
					}),
					createCase(name, { ...test.options, format, prefix: prefixSingle }, "missingAffix", {
						affixes: prefixSingle.join(", "),
						position: "prefix",
					}),
					createCase(name, { ...test.options, format, prefix: prefixMulti }, "missingAffix", {
						affixes: prefixMulti.join(", "),
						position: "prefix",
					}),
					createCase(name, { ...test.options, format, suffix: suffixSingle }, "missingAffix", {
						affixes: suffixSingle.join(", "),
						position: "suffix",
					}),
					createCase(name, { ...test.options, format, suffix: suffixMulti }, "missingAffix", {
						affixes: suffixMulti.join(", "),
						position: "suffix",
					}),
				);
			}
		}
	}

	return newCases;
}

export function createTestCases(cases: Cases): void {
	validCases.push(...createValidTestCases(cases));
	invalidCases.push(...createInvalidTestCases(cases));
}
