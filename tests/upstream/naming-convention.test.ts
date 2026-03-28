import { dirname } from "node:path";
import parser from "@typescript-eslint/parser";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { fileURLToPath } from "bun";

import rule from "../../src/rules/naming-convention";
import { invalid, valid } from "./naming-convention/cases";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Add ignoreDestructured: false to every test case so upstream ESLint tests
// run against the rule's original behavior. The rule defaults to
// ignoreDestructured: true, but the upstream tests were written for the
// original (non-ignoring) behavior.
function withDestructuredSetting<T extends { options: unknown[] }>(cases: readonly T[]): T[] {
	return cases.map((c) => ({
		...c,
		options: [...c.options, { ignoreDestructured: false }],
	})) as T[];
}

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser,
		parserOptions: {
			projectService: {
				allowDefaultProject: ["*.ts", "*.tsx"],
				maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 64,
			},
			tsconfigRootDir: __dirname,
		},
		sourceType: "module",
	},
});

// @ts-expect-error -- Stupid.
ruleTester.run("naming-convention", rule, {
	invalid: withDestructuredSetting(invalid),
	valid: withDestructuredSetting(valid),
});
