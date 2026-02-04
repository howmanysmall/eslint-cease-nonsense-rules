import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import babelParser from "@babel/eslint-parser";
import tsParser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import vueParser from "vue-eslint-parser";

import rule from "../../src/rules/prevent-abbreviations";
import { shardCases } from "../utilities/shard-cases";

type Variant = "default" | "babel" | "typescript" | "vue";

interface LanguageOptions {
	readonly globals?: Record<string, "readonly" | "writable" | "off">;
	readonly parser?: unknown;
	readonly parserOptions?: Record<string, unknown>;
}

interface TesterOptions {
	readonly languageOptions?: LanguageOptions;
}

type UpstreamValidCase =
	| string
	| {
			readonly code: string;
			readonly filename?: string;
			readonly languageOptions?: LanguageOptions;
			readonly options?: ReadonlyArray<Record<string, unknown>>;
	  };

interface UpstreamInvalidCase {
	readonly code: string;
	readonly errors?: number | ReadonlyArray<Record<string, unknown>>;
	readonly filename?: string;
	readonly languageOptions?: LanguageOptions;
	readonly options?: ReadonlyArray<Record<string, unknown>>;
	readonly output?: string;
}

interface CollectedTests {
	readonly variant: Variant;
	readonly tests: {
		readonly testerOptions?: TesterOptions;
		readonly valid: ReadonlyArray<UpstreamValidCase>;
		readonly invalid: ReadonlyArray<UpstreamInvalidCase>;
	};
}

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
	if (variant === "babel") return babelParser;
	if (variant === "vue") return vueParser;
	return tsParser;
}

const PARSER_MARKER_PATTERN = /\/\*\s*(babel|typescript)\s*\*\//gu;

function stripParserMarkers(code: string): string {
	const withoutMarkers = code.replace(PARSER_MARKER_PATTERN, "");
	return withoutMarkers.trim().length === 0 ? "" : withoutMarkers;
}

function normalizeValidCase(testCase: UpstreamValidCase): UpstreamValidCase {
	if (typeof testCase === "string") {
		return stripParserMarkers(testCase);
	}

	return {
		...testCase,
		code: stripParserMarkers(testCase.code),
	};
}

function normalizeInvalidCase(testCase: UpstreamInvalidCase): UpstreamInvalidCase {
	const code = stripParserMarkers(testCase.code);
	const output = typeof testCase.output === "string" ? stripParserMarkers(testCase.output) : undefined;

	if (typeof output === "string" && output === code) {
		const { output: _output, ...rest } = testCase;
		return {
			...rest,
			code,
		};
	}

	return {
		...testCase,
		code,
		...(typeof output === "string" ? { output } : {}),
	};
}

function getDefaultParserOptions(variant: Variant): Record<string, unknown> {
	if (variant === "babel") {
		return {
			requireConfigFile: false,
		};
	}

	return {};
}

const casesPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "prevent-abbreviations.cases.json");
const collected: unknown = JSON.parse(readFileSync(casesPath, "utf8"));

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
	const baseParserOptions = {
		...getDefaultParserOptions(group.variant),
		...baseOptions.parserOptions,
	};
	const baseLanguageOptions: LanguageOptions = {
		...baseOptions,
		parser,
		parserOptions: baseParserOptions,
	};

	for (const testCase of group.tests.valid) {
		const normalizedCase = normalizeValidCase(testCase);
		if (typeof normalizedCase === "string") {
			valid.push({ code: normalizedCase, languageOptions: baseLanguageOptions });
			continue;
		}

		valid.push({
			...normalizedCase,
			languageOptions: {
				...baseLanguageOptions,
				...normalizedCase.languageOptions,
				parserOptions: {
					...baseParserOptions,
					...normalizedCase.languageOptions?.parserOptions,
				},
			},
		});
	}

	for (const testCase of group.tests.invalid) {
		const normalizedCase = normalizeInvalidCase(testCase);
		invalid.push({
			...normalizedCase,
			languageOptions: {
				...baseLanguageOptions,
				...normalizedCase.languageOptions,
				parserOptions: {
					...baseParserOptions,
					...normalizedCase.languageOptions?.parserOptions,
				},
			},
		});
	}
}

ruleTester.run("prevent-abbreviations", rule, { invalid: shardCases(invalid), valid: shardCases(valid) });
