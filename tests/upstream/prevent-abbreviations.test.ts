import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import tsParser from "@typescript-eslint/parser";
import babelParser from "@babel/eslint-parser";
import vueParser from "vue-eslint-parser";
import { RuleTester } from "eslint";

import rule from "../../src/rules/prevent-abbreviations";

type Variant = "default" | "babel" | "typescript" | "vue";

type LanguageOptions = {
	readonly globals?: Record<string, "readonly" | "writable" | "off">;
	readonly parser?: unknown;
	readonly parserOptions?: Record<string, unknown>;
};

type TesterOptions = {
	readonly languageOptions?: LanguageOptions;
};

type UpstreamValidCase = string | {
	readonly code: string;
	readonly filename?: string;
	readonly languageOptions?: LanguageOptions;
	readonly options?: ReadonlyArray<Record<string, unknown>>;
};

type UpstreamInvalidCase = {
	readonly code: string;
	readonly errors?: number | ReadonlyArray<Record<string, unknown>>;
	readonly filename?: string;
	readonly languageOptions?: LanguageOptions;
	readonly options?: ReadonlyArray<Record<string, unknown>>;
	readonly output?: string;
};

type CollectedTests = {
	readonly variant: Variant;
	readonly tests: {
		readonly testerOptions?: TesterOptions;
		readonly valid: ReadonlyArray<UpstreamValidCase>;
		readonly invalid: ReadonlyArray<UpstreamInvalidCase>;
	};
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object";
}

function isCollectedTests(value: unknown): value is ReadonlyArray<CollectedTests> {
	if (!Array.isArray(value)) return false;
	return value.every((entry) => {
		if (!isRecord(entry)) return false;
		if (typeof entry.variant !== "string") return false;
		if (!isRecord(entry.tests)) return false;
		if (!Array.isArray(entry.tests.valid)) return false;
		if (!Array.isArray(entry.tests.invalid)) return false;
		return true;
	});
}

function getParserForVariant(variant: Variant): unknown {
	switch (variant) {
		case "babel":
			return babelParser;
		case "vue":
			return vueParser;
		case "typescript":
		case "default":
		default:
			return tsParser;
	}
}

const casesPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "prevent-abbreviations.cases.json");
const rawCases = JSON.parse(readFileSync(casesPath, "utf8"));
const collected: unknown = rawCases;

if (!isCollectedTests(collected)) {
	throw new Error("Prevent-abbreviations cases payload has unexpected shape");
}

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser: tsParser,
		sourceType: "module",
	},
});

const valid: Array<UpstreamValidCase> = [];
const invalid: Array<UpstreamInvalidCase> = [];

for (const group of collected) {
	const baseOptions = group.tests.testerOptions?.languageOptions ?? {};
	const parser = getParserForVariant(group.variant);
	const baseLanguageOptions: LanguageOptions = {
		...baseOptions,
		parser,
	};

	for (const testCase of group.tests.valid) {
		if (typeof testCase === "string") {
			valid.push({ code: testCase, languageOptions: baseLanguageOptions });
			continue;
		}

		valid.push({
			...testCase,
			languageOptions: {
				...baseLanguageOptions,
				...testCase.languageOptions,
			},
		});
	}

	for (const testCase of group.tests.invalid) {
		invalid.push({
			...testCase,
			languageOptions: {
				...baseLanguageOptions,
				...testCase.languageOptions,
			},
		});
	}
}

ruleTester.run("prevent-abbreviations", rule, { invalid, valid });
