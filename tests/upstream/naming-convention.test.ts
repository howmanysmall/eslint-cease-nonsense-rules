import parser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";

import rule from "../../src/rules/naming-convention";
import { invalid, valid } from "./naming-convention/cases";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser,
		parserOptions: {
			projectService: {
				allowDefaultProject: ["*.ts"],
			},
			tsconfigRootDir: __dirname,
		},
		sourceType: "module",
	},
});

ruleTester.run("naming-convention", rule, { invalid, valid });
