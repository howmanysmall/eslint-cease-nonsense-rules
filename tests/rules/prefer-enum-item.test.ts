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

// Type declarations must be inlined for RuleTester virtual files.
// Ambient declarations from types.d.ts aren't automatically resolved.
const typeDeclarations = `
interface EnumItem {
	Name: string;
	Value: number;
	EnumType: unknown;
}

declare namespace Enum {
	namespace ScaleType {
		interface Stretch extends EnumItem {
			Name: "Stretch";
			Value: 0;
			EnumType: typeof Enum.ScaleType;
		}
		const Stretch: Stretch;

		interface Slice extends EnumItem {
			Name: "Slice";
			Value: 1;
			EnumType: typeof Enum.ScaleType;
		}
		const Slice: Slice;

		interface Tile extends EnumItem {
			Name: "Tile";
			Value: 2;
			EnumType: typeof Enum.ScaleType;
		}
		const Tile: Tile;

		interface Fit extends EnumItem {
			Name: "Fit";
			Value: 3;
			EnumType: typeof Enum.ScaleType;
		}
		const Fit: Fit;

		interface Crop extends EnumItem {
			Name: "Crop";
			Value: 4;
			EnumType: typeof Enum.ScaleType;
		}
		const Crop: Crop;
	}
	type ScaleType = ScaleType.Stretch | ScaleType.Slice | ScaleType.Tile | ScaleType.Fit | ScaleType.Crop;
}

type CastsToEnum<TEnum extends EnumItem> = TEnum | TEnum["Name"] | TEnum["Value"];

interface ImageProps {
	ScaleType?: CastsToEnum<Enum.ScaleType>;
}

declare function setScaleType(value: CastsToEnum<Enum.ScaleType>): void;
`;

describe("prefer-enum-item", () => {
	// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
	ruleTester.run("prefer-enum-item", rule, {
		invalid: [
			// String literal in object property
			{
				code: `${typeDeclarations}
const props: ImageProps = { ScaleType: "Slice" };`,
				errors: [{ messageId: "preferEnumItem" }],
				output: `${typeDeclarations}
const props: ImageProps = { ScaleType: Enum.ScaleType.Slice };`,
			},
			// Number literal in object property
			{
				code: `${typeDeclarations}
const props: ImageProps = { ScaleType: 1 };`,
				errors: [{ messageId: "preferEnumItem" }],
				output: `${typeDeclarations}
const props: ImageProps = { ScaleType: Enum.ScaleType.Slice };`,
			},
			// String literal in function call
			{
				code: `${typeDeclarations}
setScaleType("Fit");`,
				errors: [{ messageId: "preferEnumItem" }],
				output: `${typeDeclarations}
setScaleType(Enum.ScaleType.Fit);`,
			},
			// Number literal in function call
			{
				code: `${typeDeclarations}
setScaleType(0);`,
				errors: [{ messageId: "preferEnumItem" }],
				output: `${typeDeclarations}
setScaleType(Enum.ScaleType.Stretch);`,
			},
			// Variable assignment with string
			{
				code: `${typeDeclarations}
const x: Enum.ScaleType = "Stretch";`,
				errors: [{ messageId: "preferEnumItem" }],
				output: `${typeDeclarations}
const x: Enum.ScaleType = Enum.ScaleType.Stretch;`,
			},
		],
		valid: [
			// Correct enum usage
			{
				code: `${typeDeclarations}
const props: ImageProps = { ScaleType: Enum.ScaleType.Slice };`,
			},
			// Non-enum string (no contextual enum type)
			{ code: `const name: string = "Slice";` },
			// Non-enum number
			{ code: `const count: number = 1;` },
			// Enum.Value usage
			{
				code: `${typeDeclarations}
const props: ImageProps = { ScaleType: Enum.ScaleType.Slice.Value };`,
			},
		],
	});
});
