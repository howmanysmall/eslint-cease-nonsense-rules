#!/usr/bin/env node

/**
 * Profiling script for ESLint rules.
 * Usage: npx tsx scripts/profile-rule.ts <rule-name> [iterations]
 *
 * Runs ESLint with a single rule enabled against all src/**\/*.ts files.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import tsParser from "@typescript-eslint/parser";
import type { Rule } from "eslint";
import { Linter } from "eslint";
import memoizedEffectDependencies from "../src/rules/memoized-effect-dependencies";
import noCommentedCode from "../src/rules/no-commented-code";
import noShorthandNames from "../src/rules/no-shorthand-names";
import requirePairedCalls from "../src/rules/require-paired-calls";
import useExhaustiveDependencies from "../src/rules/use-exhaustive-dependencies";
import useHookAtTopLevel from "../src/rules/use-hook-at-top-level";

const RULES_TO_PROFILE: Record<string, Rule.RuleModule> = {
	"memoized-effect-dependencies": memoizedEffectDependencies,
	"no-commented-code": noCommentedCode,
	"no-shorthand-names": noShorthandNames,
	// @ts-expect-error -- Shut up
	"require-paired-calls": requirePairedCalls as Rule.RuleModule,
	"use-exhaustive-dependencies": useExhaustiveDependencies,
	"use-hook-at-top-level": useHookAtTopLevel,
};

interface SourceFile {
	readonly content: string;
	readonly path: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

function collectTsFiles(directory: string, basePath = ""): Array<SourceFile> {
	const files: Array<SourceFile> = [];
	const entries = readdirSync(directory);

	for (const entry of entries) {
		const fullPath = join(directory, entry);
		const relativePath = basePath ? `${basePath}/${entry}` : entry;
		const stat = statSync(fullPath);

		if (stat.isDirectory()) {
			files.push(...collectTsFiles(fullPath, relativePath));
		} else if (entry.endsWith(".ts")) {
			files.push({
				content: readFileSync(fullPath, "utf8"),
				path: relativePath,
			});
		}
	}

	return files;
}

function loadSourceFiles(): ReadonlyArray<SourceFile> {
	const srcDir = join(rootDir, "src");
	return collectTsFiles(srcDir, "src");
}

function profileRule(
	ruleName: string,
	rule: Rule.RuleModule,
	files: ReadonlyArray<SourceFile>,
	iterations: number,
): void {
	const linter = new Linter();

	const config: Linter.Config = {
		languageOptions: {
			ecmaVersion: 2022,
			parser: tsParser,
			parserOptions: {
				ecmaFeatures: { jsx: true },
			},
			sourceType: "module",
		},
		plugins: {
			profile: { rules: { [ruleName]: rule } },
		},
		rules: {
			[`profile/${ruleName}`]: "error",
		},
	};

	for (let iteration = 0; iteration < iterations; iteration += 1) {
		for (const file of files) linter.verify(file.content, config, { filename: file.path });
	}
}

function main(): void {
	const [ruleName, iterationsString = "10"] = process.argv.slice(2);
	const iterations = Number.parseInt(iterationsString, 10);

	if (!ruleName) {
		console.error("Usage: npx tsx scripts/profile-rule.ts <rule-name> [iterations]");
		console.error("Available rules:", Object.keys(RULES_TO_PROFILE).join(", "));
		process.exit(1);
	}

	const rule = RULES_TO_PROFILE[ruleName];
	if (rule === undefined) {
		console.error(`Unknown rule: ${ruleName}`);
		console.error("Available rules:", Object.keys(RULES_TO_PROFILE).join(", "));
		process.exit(1);
	}

	const files = loadSourceFiles();
	console.error(`Profiling ${ruleName} over ${files.length} files, ${iterations} iterations...`);

	profileRule(ruleName, rule, files, iterations);

	console.error("Done.");
}

main();
