import { describe, setDefaultTimeout } from "bun:test";
import { join } from "node:path";
import tsParser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import rule from "../../src/rules/prefer-enum-item";

// Type-aware tests have cold-start overhead from TypeScript project service initialization
setDefaultTimeout(30_000);

const fixturesDir = join(__dirname, "../fixtures/prefer-enum-item");

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser: tsParser,
		parserOptions: {
			ecmaFeatures: { jsx: true },
			projectService: {
				allowDefaultProject: ["*.ts", "*.tsx"],
				defaultProject: join(fixturesDir, "tsconfig.json"),
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

// Enum with non-literal Name/Value types (for edge case coverage)
declare namespace Enum {
	namespace NonLiteralEnum {
		interface Item extends EnumItem {
			Name: string;  // Non-literal
			Value: number; // Non-literal
			EnumType: typeof Enum.NonLiteralEnum;
		}
		const Item: Item;
	}
	type NonLiteralEnum = NonLiteralEnum.Item;
}

declare function setNonLiteral(value: Enum.NonLiteralEnum | string | number): void;
`;

describe("prefer-enum-item", () => {
	// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
	ruleTester.run("prefer-enum-item", rule, {
		invalid: [
			// JSX attribute with string literal
			{
				code: `${typeDeclarations}
declare const Image: (props: ImageProps) => unknown;
<Image ScaleType="Slice" />;`,
				errors: [{ messageId: "preferEnumItem" }],
				output: `${typeDeclarations}
declare const Image: (props: ImageProps) => unknown;
<Image ScaleType={Enum.ScaleType.Slice} />;`,
			},
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
			{
				code: `${typeDeclarations}
setScaleType("Fit");`,
				errors: [{ messageId: "preferEnumItem" }],
				options: [{ performanceMode: true }],
				output: `${typeDeclarations}
setScaleType(Enum.ScaleType.Fit);`,
			},
			{
				code: `${typeDeclarations}
setScaleType("Fit");
setScaleType("Fit");`,
				errors: [{ messageId: "preferEnumItem" }, { messageId: "preferEnumItem" }],
				options: [{ performanceMode: true }],
				output: `${typeDeclarations}
setScaleType(Enum.ScaleType.Fit);
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
			// Single enum member type (non-union contextual type)
			{
				code: `${typeDeclarations}
const specific: Enum.ScaleType.Slice = "Slice";`,
				errors: [{ messageId: "preferEnumItem" }],
				output: `${typeDeclarations}
const specific: Enum.ScaleType.Slice = Enum.ScaleType.Slice;`,
			},
			// Number with fixNumericToValue option
			{
				code: `${typeDeclarations}
const props: ImageProps = { ScaleType: 1 };`,
				errors: [{ messageId: "preferEnumItem" }],
				options: [{ fixNumericToValue: true }],
				output: `${typeDeclarations}
const props: ImageProps = { ScaleType: Enum.ScaleType.Slice.Value };`,
			},
		],
		valid: [
			// Correct enum usage
			{
				code: `${typeDeclarations}
const props: ImageProps = { ScaleType: Enum.ScaleType.Slice };`,
			},
			// String that doesn't match any enum Name (no error, just not recognized)
			{
				code: `${typeDeclarations}
const props: ImageProps = { ScaleType: "InvalidName" };`,
			},
			// Non-enum string (no contextual enum type)
			{ code: `const name: string = "Slice";` },
			// Non-enum number
			{ code: `const count: number = 1;` },
			// Boolean literal (not string or number)
			{ code: `const flag: boolean = true;` },
			// Non-literal enum type (Name/Value are string/number, not specific literals)
			{
				code: `${typeDeclarations}
setNonLiteral("anything");`,
			},
			// Enum.Value usage
			{
				code: `${typeDeclarations}
const props: ImageProps = { ScaleType: Enum.ScaleType.Slice.Value };`,
			},
			// Variable without type annotation (exercises VariableDeclarator skip path)
			{ code: `const x = "Slice";` },
			// Variable with non-Enum type annotation
			{ code: `const x: string = "Slice";` },
			{
				code: `const x: string = "Slice";`,
				options: [{ performanceMode: true }],
			},
		],
	});
});
