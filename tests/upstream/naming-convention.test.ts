import parser from "@typescript-eslint/parser";
import { RuleTester } from "@typescript-eslint/rule-tester";

import rule from "../../src/rules/naming-convention";
import { invalid, valid } from "./naming-convention/cases";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser,
		parserOptions: {
			projectService: {
				allowDefaultProject: ["*.ts", "*.tsx"],
				"maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING": 64,
			},
			tsconfigRootDir: __dirname,
		},
		sourceType: "module",
	},
});

ruleTester.run("naming-convention", rule, { invalid, valid });
