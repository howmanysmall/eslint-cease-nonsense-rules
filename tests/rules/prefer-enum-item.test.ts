import { describe } from "bun:test";
import path from "node:path";
import tsParser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import rule from "../../src/rules/prefer-enum-item";

const fixturesDir = path.join(__dirname, "../fixtures/prefer-enum-item");

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser: tsParser,
		parserOptions: {
			ecmaFeatures: { jsx: true },
			projectService: {
				allowDefaultProject: ["*.ts", "*.tsx"],
				defaultProject: path.join(fixturesDir, "tsconfig.json"),
			},
			tsconfigRootDir: fixturesDir,
		},
		sourceType: "module",
	},
});

describe("prefer-enum-item", () => {
	// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
	ruleTester.run("prefer-enum-item", rule, {
		invalid: [
			// String literal in object property
			{
				code: `const props: ImageProps = { ScaleType: "Slice" };`,
				errors: [{ messageId: "preferEnumItem" }],
				output: `const props: ImageProps = { ScaleType: Enum.ScaleType.Slice };`,
			},
			// Number literal in object property
			{
				code: `const props: ImageProps = { ScaleType: 1 };`,
				errors: [{ messageId: "preferEnumItem" }],
				output: `const props: ImageProps = { ScaleType: Enum.ScaleType.Slice };`,
			},
			// String literal in function call
			{
				code: `setScaleType("Fit");`,
				errors: [{ messageId: "preferEnumItem" }],
				output: `setScaleType(Enum.ScaleType.Fit);`,
			},
			// Number literal in function call
			{
				code: `setScaleType(0);`,
				errors: [{ messageId: "preferEnumItem" }],
				output: `setScaleType(Enum.ScaleType.Stretch);`,
			},
			// Variable assignment with string
			{
				code: `const x: Enum.ScaleType = "Stretch";`,
				errors: [{ messageId: "preferEnumItem" }],
				output: `const x: Enum.ScaleType = Enum.ScaleType.Stretch;`,
			},
		],
		valid: [
			// Correct enum usage
			{ code: `const props: ImageProps = { ScaleType: Enum.ScaleType.Slice };` },
			// Non-enum string (no contextual enum type)
			{ code: `const name: string = "Slice";` },
			// Non-enum number
			{ code: `const count: number = 1;` },
			// Enum.Value usage
			{ code: `const props: ImageProps = { ScaleType: Enum.ScaleType.Slice.Value };` },
		],
	});
});
