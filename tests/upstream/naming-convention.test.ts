import { dirname } from "node:path";
import parser from "@typescript-eslint/parser";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { fileURLToPath } from "bun";
import rule from "../../src/rules/naming-convention";
import { invalid, valid } from "./naming-convention/cases";

const __dirname = dirname(fileURLToPath(import.meta.url));

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
ruleTester.run("naming-convention", rule, { invalid, valid });
