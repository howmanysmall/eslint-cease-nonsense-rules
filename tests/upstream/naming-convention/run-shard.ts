import rule from "@rules/naming-convention";
import parser from "@typescript-eslint/parser";
import { RuleTester } from "@typescript-eslint/rule-tester";

import { invalid, valid } from "./cases";

const testDirectory = new URL(".", import.meta.url).pathname;

function partitionForShard<TestCase>(
	cases: ReadonlyArray<TestCase>,
	shardIndex: number,
	totalShards: number,
): Array<TestCase> {
	const result: Array<TestCase> = [];
	for (let index = shardIndex; index < cases.length; index += totalShards) {
		result.push(cases[index] as TestCase);
	}
	return result;
}

export function runNamingConventionShard(shardIndex: number, totalShards: number): void {
	const ruleTester = new RuleTester({
		languageOptions: {
			ecmaVersion: 2022,
			parser,
			parserOptions: {
				projectService: {
					allowDefaultProject: ["*.ts", "*.tsx"],
					maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 64,
				},
				tsconfigRootDir: testDirectory,
			},
			sourceType: "module",
		},
	});

	const invalidShard = partitionForShard(invalid, shardIndex, totalShards);
	const validShard = partitionForShard(valid, shardIndex, totalShards);

	// @ts-expect-error -- Upstream typing mismatch with @typescript-eslint/rule-tester.
	ruleTester.run("naming-convention", rule, {
		invalid: invalidShard,
		valid: validShard,
	});
}
