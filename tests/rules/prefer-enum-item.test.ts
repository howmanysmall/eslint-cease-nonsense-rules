import nodePath from "node:path";
import { describe, vi } from "vitest";
import rule from "$rules/prefer-enum-item";
import tsParser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";

const fixturesDir = nodePath.join(import.meta.dirname, "../fixtures/prefer-enum-item");

// Type-aware tests have cold-start overhead from TypeScript project service initialization
vi.setConfig({ testTimeout: 30_000 });

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser: tsParser,
		parserOptions: {
			ecmaFeatures: { jsx: true },
			projectService: {
				allowDefaultProject: ["*.ts", "*.tsx"],
				defaultProject: nodePath.join(fixturesDir, "tsconfig.json"),
				maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 64,
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

declare class ScaleTypeConsumer {
    constructor(value: CastsToEnum<Enum.ScaleType>);
}

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

declare namespace CustomEnum {
    namespace ScaleType {
        interface Slice extends EnumItem {
            Name: "Slice";
            Value: 1;
            EnumType: typeof CustomEnum.ScaleType;
        }
        const Slice: Slice;
    }
    type ScaleType = ScaleType.Slice;
}

declare function setCustomScaleType(value: CustomEnum.ScaleType | string | number): void;

declare namespace Enum {
    namespace MissingName {
        interface Item {
            Value: 1;
        }
        const Item: Item;
    }
    type MissingName = MissingName.Item;

    namespace MissingValue {
        interface Item {
            Name: "Item";
        }
        const Item: Item;
    }
    type MissingValue = MissingValue.Item;
}

declare function setMissingName(value: Enum.MissingName | string | number): void;
declare function setMissingValue(value: Enum.MissingValue | string | number): void;
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
				code: `
import type { EnumItem } from "./types";

const props: ImageProps = { ScaleType: "Slice" };
`,
				errors: [{ messageId: "preferEnumItem" }],
				filename: nodePath.join(fixturesDir, "performance-index.ts"),
				options: [{ performanceMode: true }],
				output: `
import type { EnumItem } from "./types";

const props: ImageProps = { ScaleType: Enum.ScaleType.Slice };
`,
			},
			{
				code: `
import type { EnumItem } from "./types";

setScaleType(3);
`,
				errors: [{ messageId: "preferEnumItem" }],
				filename: nodePath.join(fixturesDir, "performance-index-call.ts"),
				options: [{ fixNumericToValue: true, performanceMode: true }],
				output: `
import type { EnumItem } from "./types";

setScaleType(Enum.ScaleType.Fit.Value);
`,
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
			{
				code: `${typeDeclarations}
const first: Enum.ScaleType = "Slice";
const second: Enum.ScaleType = "Slice";`,
				errors: [{ messageId: "preferEnumItem" }, { messageId: "preferEnumItem" }],
				options: [{ performanceMode: true }],
				output: `${typeDeclarations}
const first: Enum.ScaleType = Enum.ScaleType.Slice;
const second: Enum.ScaleType = Enum.ScaleType.Slice;`,
			},
			{
				code: `${typeDeclarations}
setScaleType("Slice");
setScaleType("Tile");
setScaleType("Crop");`,
				errors: [
					{ messageId: "preferEnumItem" },
					{ messageId: "preferEnumItem" },
					{ messageId: "preferEnumItem" },
				],
				options: [{ performanceMode: true }],
				output: `${typeDeclarations}
setScaleType(Enum.ScaleType.Slice);
setScaleType(Enum.ScaleType.Tile);
setScaleType(Enum.ScaleType.Crop);`,
			},
			{
				code: `${typeDeclarations}
interface PairProps {
    First?: CastsToEnum<Enum.ScaleType>;
    Second?: CastsToEnum<Enum.ScaleType>;
}
const props: PairProps = { First: "Slice", Second: "Tile" };`,
				errors: [{ messageId: "preferEnumItem" }, { messageId: "preferEnumItem" }],
				options: [{ performanceMode: true }],
				output: `${typeDeclarations}
interface PairProps {
    First?: CastsToEnum<Enum.ScaleType>;
    Second?: CastsToEnum<Enum.ScaleType>;
}
const props: PairProps = { First: Enum.ScaleType.Slice, Second: Enum.ScaleType.Tile };`,
			},
			// Number literal in function call
			{
				code: `${typeDeclarations}
setScaleType(0);`,
				errors: [{ messageId: "preferEnumItem" }],
				output: `${typeDeclarations}
setScaleType(Enum.ScaleType.Stretch);`,
			},
			// Constructor argument
			{
				code: `${typeDeclarations}
new ScaleTypeConsumer("Tile");`,
				errors: [{ messageId: "preferEnumItem" }],
				output: `${typeDeclarations}
new ScaleTypeConsumer(Enum.ScaleType.Tile);`,
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
			{
				code: `${typeDeclarations}
setScaleType("Crop");`,
				errors: [{ messageId: "preferEnumItem" }],
				options: [{ performanceMode: false }],
				output: `${typeDeclarations}
setScaleType(Enum.ScaleType.Crop);`,
			},
			{
				code: `${typeDeclarations}
setScaleType(2);`,
				errors: [{ messageId: "preferEnumItem" }],
				options: [{ fixNumericToValue: true, performanceMode: false }],
				output: `${typeDeclarations}
setScaleType(Enum.ScaleType.Tile.Value);`,
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
			{
				code: `${typeDeclarations}
const props: ImageProps = { ScaleType: "InvalidName" };`,
				options: [{ performanceMode: true }],
			},
			{
				code: `${typeDeclarations}
const props: ImageProps = { ScaleType: 999 };`,
				options: [{ performanceMode: true }],
			},
			{
				code: `
import type { EnumItem } from "./types";

const props: ImageProps = { ScaleType: "Nope" };
`,
				filename: nodePath.join(fixturesDir, "performance-index-skip-string.ts"),
				options: [{ performanceMode: true }],
			},
			{
				code: `
import type { EnumItem } from "./types";

const props: ImageProps = { ScaleType: 999 };
`,
				filename: nodePath.join(fixturesDir, "performance-index-skip-number.ts"),
				options: [{ performanceMode: true }],
			},
			{
				code: "const x: number = 999;",
				options: [{ performanceMode: true }],
			},
			// Non-enum string (no contextual enum type)
			{ code: `const name: string = "Slice";` },
			// Non-enum number
			{ code: "const count: number = 1;" },
			{
				code: `${typeDeclarations}
const props = { ScaleType: "Slice" };`,
			},
			// Boolean literal (not string or number)
			{ code: "const flag: boolean = true;" },
			// Non-literal enum type (Name/Value are string/number, not specific literals)
			{
				code: `${typeDeclarations}
setNonLiteral("anything");`,
			},
			{
				code: `${typeDeclarations}
setCustomScaleType("Slice");`,
			},
			{
				code: `${typeDeclarations}
setMissingName("Item");
setMissingValue(1);`,
			},
			// Regression: union contextual type should still resolve enum lookup safely
			{
				code: `${typeDeclarations}
declare function someFunction(value: Enum.ScaleType | string): void;
someFunction("InvalidName");`,
			},
			// Enum.Value usage
			{
				code: `${typeDeclarations}
const props: ImageProps = { ScaleType: Enum.ScaleType.Slice.Value };`,
			},
			// Variable without type annotation (exercises VariableDeclarator skip path)
			{ code: `const x = "Slice";` },
			{ code: `type Label = "Slice";` },
			{ code: `let x: string;` },
			{ code: `const { x }: { x: string } = { x: "Slice" };` },
			// Variable with non-Enum type annotation
			{ code: `const x: string = "Slice";` },
			{
				code: `const x: string = "Slice";`,
				options: [{ performanceMode: true }],
			},
			{
				code: `${typeDeclarations}
declare function someFunction(value: Enum.ScaleType | string): void;
someFunction("InvalidName");`,
				options: [{ performanceMode: false }],
			},
			{
				code: `${typeDeclarations}
declare function someFunction(value: Enum.ScaleType | string): void;
someFunction("InvalidName");
someFunction("InvalidName");`,
				options: [{ performanceMode: true }],
			},
			{
				code: `const first: string = "Slice";
const second: string = "Slice";`,
				options: [{ performanceMode: true }],
			},
		],
	});
});
