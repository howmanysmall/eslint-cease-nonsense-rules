import nodePath from "node:path";
import { describe, vi } from "vitest";
import rule from "$rules/prefer-enum-member";
import parser from "@typescript-eslint/parser";
import { RuleTester } from "@typescript-eslint/rule-tester";

import type { InvalidTestCase, ValidTestCase } from "@typescript-eslint/rule-tester";

const currentDirectory = import.meta.dirname;

// Type-aware tests have cold-start overhead from TypeScript project service initialization
vi.setConfig({ testTimeout: 30_000 });

const testsDir = nodePath.resolve(currentDirectory, "..");
const eslintProjectPath = nodePath.join(testsDir, "tsconfig.eslint.json");
const fixturesRelativeDir = "fixtures/prefer-enum-member";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser,
		parserOptions: {
			ecmaFeatures: { jsx: true },
			project: eslintProjectPath,
			tsconfigRootDir: testsDir,
		},
		sourceType: "module",
	},
});

const declarations = `
enum Color {
    Blue = "Blue",
    Green = "Green",
    Red = "Red",
}

const enum Mode {
    Dark = "Dark",
    Light = "Light",
}

enum Status {
    Ready = 1,
    Done = 2,
}

declare function useState<T>(value: T): [T, (value: T) => void];
declare function setStatus(status: Status): void;
`;

type MessageIds = "preferEnumMember";
type RuleOptions = [];
type RuleInvalidCase = InvalidTestCase<MessageIds, RuleOptions>;
type RuleValidCase = ValidTestCase<RuleOptions>;

interface RuleTestCase {
	readonly filename?: string;
}

function withStableFilenames<TTestCase extends RuleTestCase>(
	cases: ReadonlyArray<TTestCase>,
	prefix: string,
): Array<TTestCase> {
	return cases.map((testCase) => ({
		...testCase,
		filename: nodePath.join(fixturesRelativeDir, `${prefix}.tsx`),
	}));
}

describe("prefer-enum-member", () => {
	ruleTester.run("prefer-enum-member", rule, {
		invalid: withStableFilenames<RuleInvalidCase>(
			[
				{
					code: `${declarations}
const palette: Record<Color, string> = {
    Blue: "#00F",
    Green: "#0F0",
    Red: "#F00",
};`,
					errors: [
						{ messageId: "preferEnumMember" },
						{ messageId: "preferEnumMember" },
						{ messageId: "preferEnumMember" },
					],
					output: `${declarations}
const palette: Record<Color, string> = {
    [Color.Blue]: "#00F",
    [Color.Green]: "#0F0",
    [Color.Red]: "#F00",
};`,
				},
				{
					code: `${declarations}
const Blue = "#00F";
const palette: Record<Color, string> = { Blue };`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `${declarations}
const Blue = "#00F";
const palette: Record<Color, string> = { [Color.Blue]: Blue };`,
				},
				{
					code: `${declarations}
const palette: Record<Color, string> = { ["Blue"]: "#00F" };`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `${declarations}
const palette: Record<Color, string> = { [Color.Blue]: "#00F" };`,
				},
				{
					code: `${declarations}
const palette: Record<Color, string> = { "Blue": "#00F" };`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `${declarations}
const palette: Record<Color, string> = { [Color.Blue]: "#00F" };`,
				},
				{
					code: `${declarations}
const labels: Record<Status, string> = { 1: "Ready", 2: "Done" };`,
					errors: [{ messageId: "preferEnumMember" }, { messageId: "preferEnumMember" }],
					output: `${declarations}
const labels: Record<Status, string> = { [Status.Ready]: "Ready", [Status.Done]: "Done" };`,
				},
				{
					code: `${declarations}
const [color] = useState<Color>("Blue");`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `${declarations}
const [color] = useState<Color>(Color.Blue);`,
				},
				{
					code: `${declarations}
declare function configure(palette: Record<Color, string>): void;
configure({ Blue: "#00F" });`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `${declarations}
declare function configure(palette: Record<Color, string>): void;
configure({ [Color.Blue]: "#00F" });`,
				},
				{
					code: `${declarations}
const selection: { color: Color } = { color: "Blue" };`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `${declarations}
const selection: { color: Color } = { color: Color.Blue };`,
				},
				{
					code: `${declarations}
const colors: Array<Color> = ["Blue", "Green"];`,
					errors: [{ messageId: "preferEnumMember" }, { messageId: "preferEnumMember" }],
					output: `${declarations}
const colors: Array<Color> = [Color.Blue, Color.Green];`,
				},
				{
					code: `${declarations}
function getColor(): Color {
    return "Blue";
}`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `${declarations}
function getColor(): Color {
    return Color.Blue;
}`,
				},
				{
					code: `${declarations}
type ColorMap = { [K in Color]: number };
const values: ColorMap = { Blue: 1, Green: 2, Red: 3 };`,
					errors: [
						{ messageId: "preferEnumMember" },
						{ messageId: "preferEnumMember" },
						{ messageId: "preferEnumMember" },
					],
					output: `${declarations}
type ColorMap = { [K in Color]: number };
const values: ColorMap = { [Color.Blue]: 1, [Color.Green]: 2, [Color.Red]: 3 };`,
				},
				{
					code: `${declarations}
type Palette = { [K in Color]: string };
const primary: Palette = { Blue: "#00F" };
const secondary: Palette = { Green: "#0F0" };`,
					errors: [{ messageId: "preferEnumMember" }, { messageId: "preferEnumMember" }],
					output: `${declarations}
type Palette = { [K in Color]: string };
const primary: Palette = { [Color.Blue]: "#00F" };
const secondary: Palette = { [Color.Green]: "#0F0" };`,
				},
				{
					code: `${declarations}
setStatus(1);`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `${declarations}
setStatus(Status.Ready);`,
				},
				{
					code: `${declarations}
const theme: Mode = "Dark";`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `${declarations}
const theme: Mode = Mode.Dark;`,
				},
				{
					code: `${declarations}
let theme: Mode;
theme = "Dark";`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `${declarations}
let theme: Mode;
theme = Mode.Dark;`,
				},
				{
					code: `${declarations}
const shade: Color.Blue = "Blue";`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `${declarations}
const shade: Color.Blue = Color.Blue;`,
				},
				{
					code: `${declarations}
const palette: Readonly<Record<Color, string>> = { Blue: "#00F" };`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `${declarations}
const palette: Readonly<Record<Color, string>> = { [Color.Blue]: "#00F" };`,
				},
				{
					code: `${declarations}
type Palette = Record<Color, string>;
const palette: Palette = { Blue: "#00F" };`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `${declarations}
type Palette = Record<Color, string>;
const palette: Palette = { [Color.Blue]: "#00F" };`,
				},
				{
					code: `${declarations}
type Palette = Record<Color, string>;
type PaletteAlias = Palette;
const palette: PaletteAlias = { Green: "#0F0" };`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `${declarations}
type Palette = Record<Color, string>;
type PaletteAlias = Palette;
const palette: PaletteAlias = { [Color.Green]: "#0F0" };`,
				},
				{
					code: `${declarations}
type Palette<TKey extends Color> = Record<TKey, string>;
const palette: Palette<Color> = { Blue: "#00F" };`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `${declarations}
type Palette<TKey extends Color> = Record<TKey, string>;
const palette: Palette<Color> = { [Color.Blue]: "#00F" };`,
				},
				{
					code: `${declarations}
type Palette<TKey extends Color> = Readonly<Record<TKey, string>>;
const palette: Palette<Color> = { Blue: "#00F" };`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `${declarations}
type Palette<TKey extends Color> = Readonly<Record<TKey, string>>;
const palette: Palette<Color> = { [Color.Blue]: "#00F" };`,
				},
				{
					code: `${declarations}
type Palette<TKey extends Color> = { [K in (TKey)]: string };
const palette: Palette<Color> = { Blue: "#00F", Green: "#0F0", Red: "#F00" };`,
					errors: [
						{ messageId: "preferEnumMember" },
						{ messageId: "preferEnumMember" },
						{ messageId: "preferEnumMember" },
					],
					output: `${declarations}
type Palette<TKey extends Color> = { [K in (TKey)]: string };
const palette: Palette<Color> = { [Color.Blue]: "#00F", [Color.Green]: "#0F0", [Color.Red]: "#F00" };`,
				},
				{
					code: `${declarations}
const palette = { Blue: "#00F" } satisfies Record<Color, string>;`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `${declarations}
const palette = { [Color.Blue]: "#00F" } satisfies Record<Color, string>;`,
				},
				{
					code: `${declarations}
type ColorMap<T extends Color> = { [K in T]: number };
const values: ColorMap<Color> = { Blue: 1, Green: 2, Red: 3 };`,
					errors: [
						{ messageId: "preferEnumMember" },
						{ messageId: "preferEnumMember" },
						{ messageId: "preferEnumMember" },
					],
					output: `${declarations}
type ColorMap<T extends Color> = { [K in T]: number };
const values: ColorMap<Color> = { [Color.Blue]: 1, [Color.Green]: 2, [Color.Red]: 3 };`,
				},
				{
					code: `${declarations}
type PaletteOrLoose = Record<Color, string> | { fallback: string };
const palette: PaletteOrLoose = { Blue: "#00F" };`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `${declarations}
type PaletteOrLoose = Record<Color, string> | { fallback: string };
const palette: PaletteOrLoose = { [Color.Blue]: "#00F" };`,
				},
				{
					code: `${declarations}
    type Mixed = Record<Color, string> | Record<Color, number>;
    const values: Mixed = { Blue: 1, Green: 2, Red: 3 };`,
					errors: [
						{ messageId: "preferEnumMember" },
						{ messageId: "preferEnumMember" },
						{ messageId: "preferEnumMember" },
					],
					output: `${declarations}
    type Mixed = Record<Color, string> | Record<Color, number>;
    const values: Mixed = { [Color.Blue]: 1, [Color.Green]: 2, [Color.Red]: 3 };`,
				},
				{
					code: `${declarations}
    type Mixed = Record<Color, string> | Record<Color, number>;
    type MixedAlias = Mixed;
    const values: MixedAlias = { Blue: 1, Green: 2, Red: 3 };`,
					errors: [
						{ messageId: "preferEnumMember" },
						{ messageId: "preferEnumMember" },
						{ messageId: "preferEnumMember" },
					],
					output: `${declarations}
    type Mixed = Record<Color, string> | Record<Color, number>;
    type MixedAlias = Mixed;
    const values: MixedAlias = { [Color.Blue]: 1, [Color.Green]: 2, [Color.Red]: 3 };`,
				},
				{
					code: `${declarations}
    type Wrapped = Readonly<Record<Color, string> | Record<Color, number>>;
    const values: Wrapped = { Blue: 1, Green: 2, Red: 3 };`,
					errors: [
						{ messageId: "preferEnumMember" },
						{ messageId: "preferEnumMember" },
						{ messageId: "preferEnumMember" },
					],
					output: `${declarations}
    type Wrapped = Readonly<Record<Color, string> | Record<Color, number>>;
    const values: Wrapped = { [Color.Blue]: 1, [Color.Green]: 2, [Color.Red]: 3 };`,
				},
				{
					code: `${declarations}
    type Narrow = Record<Color.Blue, number>;
    type Wide = Record<Color, number>;
    type MixedNarrow = Narrow | Wide;
    const mixed: MixedNarrow = { Blue: 1, Green: 2, Red: 3 };`,
					errors: [
						{ messageId: "preferEnumMember" },
						{ messageId: "preferEnumMember" },
						{ messageId: "preferEnumMember" },
					],
					output: `${declarations}
    type Narrow = Record<Color.Blue, number>;
    type Wide = Record<Color, number>;
    type MixedNarrow = Narrow | Wide;
    const mixed: MixedNarrow = { [Color.Blue]: 1, [Color.Green]: 2, [Color.Red]: 3 };`,
				},
				{
					code: `${declarations}
type BlueMap = Record<Color.Blue, number>;
type WarmMap = Record<Color.Green | Color.Red, number>;
type SplitMap = BlueMap | WarmMap;
const values: SplitMap = { Blue: 1, Green: 2, Red: 3 };`,
					errors: [
						{ messageId: "preferEnumMember" },
						{ messageId: "preferEnumMember" },
						{ messageId: "preferEnumMember" },
					],
					output: `${declarations}
type BlueMap = Record<Color.Blue, number>;
type WarmMap = Record<Color.Green | Color.Red, number>;
type SplitMap = BlueMap | WarmMap;
const values: SplitMap = { [Color.Blue]: 1, [Color.Green]: 2, [Color.Red]: 3 };`,
				},
				{
					code: `${declarations}\ndeclare const Swatch: (props: { color: Color }) => unknown;\n<Swatch color="Blue" />;`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `${declarations}\ndeclare const Swatch: (props: { color: Color }) => unknown;\n<Swatch color={Color.Blue} />;`,
				},
				{
					code: `
namespace Tokens {
    export enum Color {
        Blue = "Blue",
    }
}

const shade: Tokens.Color = "Blue";`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `
namespace Tokens {
    export enum Color {
        Blue = "Blue",
    }
}

const shade: Tokens.Color = Tokens.Color.Blue;`,
				},
				{
					code: `
namespace Tokens {
    export enum Color {
        Blue = "Blue",
    }
}

const palette: Record<Tokens.Color, string> = { Blue: "#00F" };`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `
namespace Tokens {
    export enum Color {
        Blue = "Blue",
    }
}

const palette: Record<Tokens.Color, string> = { [Tokens.Color.Blue]: "#00F" };`,
				},
				{
					code: `
enum Duplicate {
    First = "same",
    Second = "same",
}

const value: Duplicate = "same";`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `
enum Duplicate {
    First = "same",
    Second = "same",
}

const value: Duplicate = Duplicate.First;`,
				},
				{
					code: `import { ImportedColor as SwatchColor } from "./enums";

const color: SwatchColor = "Blue";
const palette: Record<SwatchColor, string> = { Green: "#0F0" };`,
					errors: [{ messageId: "preferEnumMember" }, { messageId: "preferEnumMember" }],
					output: `import { ImportedColor as SwatchColor } from "./enums";

const color: SwatchColor = SwatchColor.Blue;
const palette: Record<SwatchColor, string> = { [SwatchColor.Green]: "#0F0" };`,
				},
				{
					code: `import * as imported from "./enums";

const color: imported.ImportedColor = "Blue";
const palette: Record<imported.ImportedColor, string> = { Green: "#0F0" };`,
					errors: [{ messageId: "preferEnumMember" }, { messageId: "preferEnumMember" }],
					output: `import * as imported from "./enums";

const color: imported.ImportedColor = imported.ImportedColor.Blue;
const palette: Record<imported.ImportedColor, string> = { [imported.ImportedColor.Green]: "#0F0" };`,
				},
				{
					code: `import { ImportedColor, type ImportedPalette } from "./enums";

const palette: ImportedPalette = { Blue: "#00F" };`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `import { ImportedColor, type ImportedPalette } from "./enums";

const palette: ImportedPalette = { [ImportedColor.Blue]: "#00F" };`,
				},
				{
					code: `import { ImportedColor as RuntimeColor, type ImportedColor } from "./enums";

void RuntimeColor;
const color: ImportedColor = "Blue";`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `import { ImportedColor as RuntimeColor, type ImportedColor } from "./enums";

void RuntimeColor;
const color: ImportedColor = RuntimeColor.Blue;`,
				},
				{
					code: `import { Other, ImportedColor } from "./enums";

void Other;
const color: ImportedColor = "Blue";`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `import { Other, ImportedColor } from "./enums";

void Other;
const color: ImportedColor = ImportedColor.Blue;`,
				},
				{
					code: `${declarations}
type GenericRecord<TKey extends Color> = Record<TKey, string>;
type Palette = GenericRecord<Color>;
const palette: Palette = { Blue: "#00F", Green: "#0F0" };`,
					errors: [{ messageId: "preferEnumMember" }, { messageId: "preferEnumMember" }],
					output: `${declarations}
type GenericRecord<TKey extends Color> = Record<TKey, string>;
type Palette = GenericRecord<Color>;
const palette: Palette = { [Color.Blue]: "#00F", [Color.Green]: "#0F0" };`,
				},
				{
					code: `${declarations}
type GenericRecord<TKey extends Color> = Record<TKey, string>;
const palette: GenericRecord<Color> = { Blue: "#00F" };`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `${declarations}
type GenericRecord<TKey extends Color> = Record<TKey, string>;
const palette: GenericRecord<Color> = { [Color.Blue]: "#00F" };`,
				},
				{
					code: `${declarations}
type PaletteBase = Record<Color, string>;
type Palette = PaletteBase;
const palette: Palette = { Blue: "#00F" };`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `${declarations}
type PaletteBase = Record<Color, string>;
type Palette = PaletteBase;
const palette: Palette = { [Color.Blue]: "#00F" };`,
				},
				{
					code: `${declarations}
type Palette = Record<(Color), string>;
const palette: Palette = { Blue: "#00F" };`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `${declarations}
type Palette = Record<(Color), string>;
const palette: Palette = { [Color.Blue]: "#00F" };`,
				},
				{
					code: `${declarations}
type Palette = Record<Color.Blue, string> | Record<Color.Green, string>;
const palette: Palette = { Blue: "#00F", Green: "#0F0" };`,
					errors: [{ messageId: "preferEnumMember" }, { messageId: "preferEnumMember" }],
					output: `${declarations}
type Palette = Record<Color.Blue, string> | Record<Color.Green, string>;
const palette: Palette = { [Color.Blue]: "#00F", [Color.Green]: "#0F0" };`,
				},
				{
					code: `${declarations}
type Wide = Record<Color, number>;
type Narrow = Record<Color.Blue, number>;
type Mixed = Wide | Narrow;
const values: Mixed = { Blue: 1, Green: 2, Red: 3 };`,
					errors: [
						{ messageId: "preferEnumMember" },
						{ messageId: "preferEnumMember" },
						{ messageId: "preferEnumMember" },
					],
					output: `${declarations}
type Wide = Record<Color, number>;
type Narrow = Record<Color.Blue, number>;
type Mixed = Wide | Narrow;
const values: Mixed = { [Color.Blue]: 1, [Color.Green]: 2, [Color.Red]: 3 };`,
				},
				{
					code: `${declarations}
type ReadonlyPalette = Readonly<Record<Color, string>>;
type Palette = ReadonlyPalette;
const palette: Palette = { Blue: "#00F" };`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `${declarations}
type ReadonlyPalette = Readonly<Record<Color, string>>;
type Palette = ReadonlyPalette;
const palette: Palette = { [Color.Blue]: "#00F" };`,
				},
				{
					code: `${declarations}
declare function configure(palette: Readonly<Record<Color, string>>): void;
configure({ Blue: "#00F", Green: "#0F0" });`,
					errors: [{ messageId: "preferEnumMember" }, { messageId: "preferEnumMember" }],
					output: `${declarations}
declare function configure(palette: Readonly<Record<Color, string>>): void;
configure({ [Color.Blue]: "#00F", [Color.Green]: "#0F0" });`,
				},
				{
					code: `${declarations}
type MixedEnumMembers = Color.Blue | Mode.Dark;
const value: MixedEnumMembers = "Blue";`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `${declarations}
type MixedEnumMembers = Color.Blue | Mode.Dark;
const value: MixedEnumMembers = Color.Blue;`,
				},
				{
					code: `${declarations}
declare function configurePair(
    first: Record<Color, string>,
    second: Record<Color, string>,
): void;
configurePair({ Blue: "#00F" }, { Green: "#0F0" });`,
					errors: [{ messageId: "preferEnumMember" }, { messageId: "preferEnumMember" }],
					output: `${declarations}
declare function configurePair(
    first: Record<Color, string>,
    second: Record<Color, string>,
): void;
configurePair({ [Color.Blue]: "#00F" }, { [Color.Green]: "#0F0" });`,
				},
				{
					code: `${declarations}
namespace Types {
    export type Palette = Record<Color, string>;
}
type Palette = Types.Palette;
const palette: Palette = { Blue: "#00F" };`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `${declarations}
namespace Types {
    export type Palette = Record<Color, string>;
}
type Palette = Types.Palette;
const palette: Palette = { [Color.Blue]: "#00F" };`,
				},
				{
					code: `${declarations}
namespace Types {
    export type Palette = Record<Color, string>;
}
type Palette = Types.Palette;
type PaletteBox = Palette;
const palette: PaletteBox = { Blue: "#00F" };`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `${declarations}
namespace Types {
    export type Palette = Record<Color, string>;
}
type Palette = Types.Palette;
type PaletteBox = Palette;
const palette: PaletteBox = { [Color.Blue]: "#00F" };`,
				},
				{
					code: `${declarations}
type Palette<TKey extends Color = Color> = Record<TKey, string>;
const palette: Palette = { Blue: "#00F" };`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `${declarations}
type Palette<TKey extends Color = Color> = Record<TKey, string>;
const palette: Palette = { [Color.Blue]: "#00F" };`,
				},
				{
					code: `${declarations}
namespace Types {
    export type Palette = Record<Color, string>;
}
const palette: Types.Palette = { Blue: "#00F" };`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `${declarations}
namespace Types {
    export type Palette = Record<Color, string>;
}
const palette: Types.Palette = { [Color.Blue]: "#00F" };`,
				},
				{
					code: `${declarations}
type Identity<TValue> = TValue;
type Palette = Identity<Record<Color, string>>;
const palette: Palette = { Blue: "#00F" };`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `${declarations}
type Identity<TValue> = TValue;
type Palette = Identity<Record<Color, string>>;
const palette: Palette = { [Color.Blue]: "#00F" };`,
				},
				{
					code: `${declarations}
type Identity<TValue> = TValue;
const palette: Identity<Record<Color, string>> = { Blue: "#00F" };`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `${declarations}
type Identity<TValue> = TValue;
const palette: Identity<Record<Color, string>> = { [Color.Blue]: "#00F" };`,
				},
				{
					code: `${declarations}
type Box<TValue> = TValue;
type Palette<TKey extends Color> = Box<Record<TKey, string>>;
const palette: Palette<Color> = { Blue: "#00F" };`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `${declarations}
type Box<TValue> = TValue;
type Palette<TKey extends Color> = Box<Record<TKey, string>>;
const palette: Palette<Color> = { [Color.Blue]: "#00F" };`,
				},
				{
					code: `${declarations}
namespace Types {
    export type Palette = Record<Color, string>;
}
type Box<TValue> = TValue;
type Palette = Box<Types.Palette>;
const palette: Palette = { Blue: "#00F" };`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `${declarations}
namespace Types {
    export type Palette = Record<Color, string>;
}
type Box<TValue> = TValue;
type Palette = Box<Types.Palette>;
const palette: Palette = { [Color.Blue]: "#00F" };`,
				},
				{
					code: `${declarations}
type Palette<TKey extends Color> = ({ [K in TKey]: string });
const palette: Palette<Color> = { Blue: "#00F" };`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `${declarations}
type Palette<TKey extends Color> = ({ [K in TKey]: string });
const palette: Palette<Color> = { [Color.Blue]: "#00F" };`,
				},
				{
					code: `${declarations}
const palette: { [K in Color]: string } = { Red: "#F00" };`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `${declarations}
const palette: { [K in Color]: string } = { [Color.Red]: "#F00" };`,
				},
				{
					code: `${declarations}
type Palette = { [K in Color]: string };
declare function configure(palette: Palette): void;
configure({ Blue: "#00F" });`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `${declarations}
type Palette = { [K in Color]: string };
declare function configure(palette: Palette): void;
configure({ [Color.Blue]: "#00F" });`,
				},
				{
					code: `${declarations}
type Box = Readonly<Record<Color, string>>;
declare function configure(palette: Box): void;
configure({ Blue: "#00F" });`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `${declarations}
type Box = Readonly<Record<Color, string>>;
declare function configure(palette: Box): void;
configure({ [Color.Blue]: "#00F" });`,
				},
				{
					code: `${declarations}
enum Flag {
    Enabled = "Enabled",
}
namespace Flag {
    export const description = "feature flag";
}
const flag: Flag = "Enabled";`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `${declarations}
enum Flag {
    Enabled = "Enabled",
}
namespace Flag {
    export const description = "feature flag";
}
const flag: Flag = Flag.Enabled;`,
				},
				{
					code: `${declarations}
type KeyAlias<TKey extends Color> = TKey;
type Palette<TKey extends Color> = Record<KeyAlias<TKey>, string>;
const palette: Palette<Color> = { Blue: "#00F" };`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `${declarations}
type KeyAlias<TKey extends Color> = TKey;
type Palette<TKey extends Color> = Record<KeyAlias<TKey>, string>;
const palette: Palette<Color> = { [Color.Blue]: "#00F" };`,
				},
				{
					code: `${declarations}
type Palette<TKey extends Color> = Record<TKey | Color.Green, string>;
const palette: Palette<Color.Blue> = { Blue: "#00F", Green: "#0F0" };`,
					errors: [{ messageId: "preferEnumMember" }, { messageId: "preferEnumMember" }],
					output: `${declarations}
type Palette<TKey extends Color> = Record<TKey | Color.Green, string>;
const palette: Palette<Color.Blue> = { [Color.Blue]: "#00F", [Color.Green]: "#0F0" };`,
				},
				{
					code: `${declarations}
type Palette<TKey extends Color> = Record<TKey, string> | Record<Color.Green, string>;
const palette: Palette<Color.Blue> = { Blue: "#00F", Green: "#0F0" };`,
					errors: [{ messageId: "preferEnumMember" }, { messageId: "preferEnumMember" }],
					output: `${declarations}
type Palette<TKey extends Color> = Record<TKey, string> | Record<Color.Green, string>;
const palette: Palette<Color.Blue> = { [Color.Blue]: "#00F", [Color.Green]: "#0F0" };`,
				},
				{
					code: `${declarations}
type Palette = Record<Color, string> | Readonly<Record<Color, string>>;
const palette: Palette = { Blue: "#00F", Green: "#0F0" };`,
					errors: [{ messageId: "preferEnumMember" }, { messageId: "preferEnumMember" }],
					output: `${declarations}
type Palette = Record<Color, string> | Readonly<Record<Color, string>>;
const palette: Palette = { [Color.Blue]: "#00F", [Color.Green]: "#0F0" };`,
				},
				{
					code: `${declarations}
type Box<TValue> = Readonly<TValue>;
type Palette = Box<Record<Color, string>>;
const palette: Palette = { Blue: "#00F" };`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `${declarations}
type Box<TValue> = Readonly<TValue>;
type Palette = Box<Record<Color, string>>;
const palette: Palette = { [Color.Blue]: "#00F" };`,
				},
				{
					code: `${declarations}
type Palette<TKey extends Color> = Record<Readonly<TKey>, string>;
const palette: Palette<Color> = { Blue: "#00F" };`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `${declarations}
type Palette<TKey extends Color> = Record<Readonly<TKey>, string>;
const palette: Palette<Color> = { [Color.Blue]: "#00F" };`,
				},
				{
					code: `${declarations}
type Palette = Record<Readonly<Color>, string>;
const palette: Palette = { Green: "#0F0" };`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `${declarations}
type Palette = Record<Readonly<Color>, string>;
const palette: Palette = { [Color.Green]: "#0F0" };`,
				},
				{
					code: `${declarations}
type LooseMap<TKey> = { [Key in TKey]: string };
const palette: LooseMap<Color> = { Blue: "#00F" };`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `${declarations}
type LooseMap<TKey> = { [Key in TKey]: string };
const palette: LooseMap<Color> = { [Color.Blue]: "#00F" };`,
				},
				{
					code: `${declarations}
const { Blue }: Record<Color, string> = { Blue: "#00F" };
void Blue;`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `${declarations}
const { Blue }: Record<Color, string> = { [Color.Blue]: "#00F" };
void Blue;`,
				},
				{
					code: `${declarations}
type Palette = Record<Color, string>;
const palette: Palette = { Blue: "#00F" } as Palette;`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `${declarations}
type Palette = Record<Color, string>;
const palette: Palette = { [Color.Blue]: "#00F" } as Palette;`,
				},
				{
					code: `${declarations}
type ColorKey = Color;
type Palette<TKey extends Color> = Record<ColorKey, string>;
const palette: Palette<Color> = { Blue: "#00F" };`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `${declarations}
type ColorKey = Color;
type Palette<TKey extends Color> = Record<ColorKey, string>;
const palette: Palette<Color> = { [Color.Blue]: "#00F" };`,
				},
				{
					code: `${declarations}
type PaletteRecord<TValue> = Record<Color, string>;
type Palette<TValue = string> = PaletteRecord<TValue>;
const palette: Palette = { Blue: "#00F" };`,
					errors: [{ messageId: "preferEnumMember" }],
					output: `${declarations}
type PaletteRecord<TValue> = Record<Color, string>;
type Palette<TValue = string> = PaletteRecord<TValue>;
const palette: Palette = { [Color.Blue]: "#00F" };`,
				},
			],
			"prefer-enum-member-invalid",
		),
		valid: withStableFilenames<RuleValidCase>(
			[
				{
					code: `${declarations}
const palette: Record<Color, string> = {
    [Color.Blue]: "#00F",
    [Color.Green]: "#0F0",
    [Color.Red]: "#F00",
};`,
				},
				{
					code: `${declarations}
const [color] = useState<Color>(Color.Blue);`,
				},
				{
					code: `${declarations}
type ColorMap = { [K in Color]: number };
const values: ColorMap = { [Color.Blue]: 1, [Color.Green]: 2, [Color.Red]: 3 };`,
				},
				{
					code: `${declarations}
setStatus(Status.Ready);`,
				},
				{
					code: `${declarations}
const theme: Mode = Mode.Dark;`,
				},
				{
					code: `${declarations}
const label = "Blue";`,
				},
				{
					code: `${declarations}
const label: string = "Blue";`,
				},
				{
					code: `import type { ParsedPath } from "node:path";
export type { ParsedPath } from "node:path";
type ImportedPath = import("node:path").ParsedPath;
import("node:path");
const label = "Blue";`,
				},
				{
					code: `import type { ImportedColor } from "./enums";

const color: ImportedColor = "Blue";`,
				},
				{
					code: `import type { ImportedColor } from "./enums";

const palette: Record<ImportedColor, string> = { Blue: "#00F" };`,
				},
				{
					code: `import { type ImportedColor } from "./enums";

const color: ImportedColor = "Blue";`,
				},
				{
					code: `import { type ImportedColor } from "./enums";

const palette: Record<ImportedColor, string> = { Blue: "#00F" };`,
				},
				{
					code: `"use strict";
${declarations}
const color = Color.Blue;`,
				},
				{
					code: `${declarations}
type Loose = { foo: string };
const loose: Loose = { foo: "bar" };`,
				},
				{
					code: `${declarations}
const palette: Record<Color, string> = {
    [Color.Blue]: "#00F",
    [Color.Green]: "#0F0",
    [Color.Red]: "#F00",
};
const { Blue } = palette;
void Blue;`,
				},
				{
					code: `${declarations}
const { Blue } = { Blue: "#00F" };
void Blue;`,
				},
				{
					code: `${declarations}
const obj = { 1n: "value" };`,
				},
				{
					code: `${declarations}
declare const seed: number;
enum Weird {
    First = seed,
    Second = seed + 1,
}
const value: Weird = 1;`,
				},
				{
					code: `${declarations}
type Shade = "Blue";
type Count = 1;`,
				},
				{
					code: `${declarations}
const Blue = "Blue";
const palette: Record<Color, string> = { [Blue]: "#00F" };`,
				},
				{
					code: `${declarations}
enum AltColor {
    Blue = "Blue",
}
type Mix = Color | AltColor;
const shade: Mix = "Blue";`,
				},
				{
					code: `${declarations}
type ColorOrStatusMap = Record<Color, string> | Record<Status, string>;
const values: ColorOrStatusMap = { Blue: "blue", 1: "ready" };`,
				},
				{
					code: `${declarations}
type MixedEnumKeys = Record<Color.Blue | Status.Ready, string> | Record<Color, string>;
const values: MixedEnumKeys = { Blue: "blue", 1: "ready" };`,
				},
				{
					code: `${declarations}
enum AltColor {
    Blue = "Blue",
    Green = "Green",
    Red = "Red",
}
type Ambiguous = Record<Color, number> | Record<AltColor, number>;
const values: Ambiguous = { Blue: 1, Green: 2, Red: 3 };`,
				},
				{
					code: `${declarations}
type Tweenable = CFrame | number;
type ExtractMembers<TInstance, TValue> = {
    [K in keyof TInstance as TInstance[K] extends TValue ? K : never]: TInstance[K];
};

interface BasePart {
    CFrame: CFrame;
    Name: string;
}

declare class CFrame {}
declare function tween<TInstance>(instance: TInstance, properties: Partial<ExtractMembers<TInstance, Tweenable>>): void;
declare const basePart: BasePart;
declare const targetCFrame: CFrame;

tween(basePart, { CFrame: targetCFrame });`,
				},
				{
					code: `${declarations}
type Palette = Partial<Record<Color | "Purple", string>>;
const palette: Palette = {
    Purple: "#90F",
};`,
				},
				{
					code: `${declarations}
type Shade = Color | "Purple";
const shade: Shade = "Purple";`,
				},
				{
					code: `${declarations}
type WrappedPalette<TKey extends string> = Readonly<Record<TKey, string>>;
const palette: WrappedPalette<"Blue"> = { Blue: "#00F" };`,
				},
				{
					code: `${declarations}
type Palette<TKey extends Color | "Purple"> = Partial<{ [K in TKey]: string }>;
const palette: Palette<Color | "Purple"> = {
    Purple: "#90F",
};`,
				},
				{
					code: `${declarations}
const importer = async () => import("node:path");
void importer;`,
				},
				{
					code: `${declarations}
declare function takeLiteral(value: "Blue"): void;
takeLiteral("Blue");`,
				},
				{
					code: `${declarations}
type LabelAlias<T> = T;
type Label = LabelAlias<string>;
const label: Label = "Blue";`,
				},
				{
					code: `${declarations}
type MixedKeys = Record<Color, string> | Record<"Blue", string>;
const values: MixedKeys = { Blue: "label" };`,
				},
				{
					code: `${declarations}
type MixedKeys = Record<"Blue", string> | Record<"Green", string>;
const values: MixedKeys = { Blue: "label", Green: "label" };`,
				},
				{
					code: `${declarations}
type MixedKeys = Record<"Blue", string> | Record<Status, string>;
const values: MixedKeys = { Blue: "label", 1: "ready" };`,
				},
				{
					code: `${declarations}
type WrappedLabel<TKey extends string> = Readonly<TKey>;
const label: WrappedLabel<"Blue"> = "Blue";`,
				},
				{
					code: `${declarations}
type Dictionary<TKey extends string> = Map<TKey, string>;
const values: Dictionary<Color> = new Map();`,
				},
				{
					code: `${declarations}
type WrappedRecord = Readonly;
const palette: WrappedRecord = { Blue: "#00F" };`,
				},
				{
					code: `${declarations}
type Palette = Record;
const palette: Palette = { Blue: "#00F" };`,
				},
				{
					code: `${declarations}
type Wrapper<TValue> = Readonly<TValue>;
type Palette = Wrapper;
const palette: Palette = { Blue: "#00F" };`,
				},
				{
					code: `${declarations}
type EmptyMap = { [K in keyof {}]: string };
const palette: EmptyMap = { Blue: "#00F" };`,
				},
				{
					code: `${declarations}
	type Palette<TKey extends Color> = Record<TKey, string>;
	const palette: Palette = { Blue: "#00F" };`,
				},
				{
					code: `${declarations}
	type Palette<TKey extends Color> = { [K in TKey]: string };
	const palette: Palette = { Blue: "#00F" };`,
				},
				{
					code: `${declarations}
	type Box<TValue> = TValue;
	type Palette<TKey extends Color> = Box<Record<TKey, string>>;
	const palette: Palette = { Blue: "#00F" };`,
				},
				{
					code: `${declarations}
type KeyAlias<TKey> = TKey;
type Palette<TKey extends Color> = Record<KeyAlias<TKey>, string>;
const palette: Palette = { Blue: "#00F" };`,
				},
				{
					code: `${declarations}
	type Palette = Record<Color, string> | Record<"Blue", string>;
	const values: Palette = { Blue: "label" };`,
				},
				{
					code: `${declarations}
type Palette = Readonly;
const palette: Palette = { Blue: "#00F" };`,
				},
				{
					code: `${declarations}
interface Label {
    readonly length: number;
}
const label: Label = "Blue";`,
				},
				{
					code: `${declarations}
interface Palette {
    readonly Blue: string;
}
const palette: Palette = { Blue: "#00F" };`,
				},
				{
					code: `${declarations}
const palette = { Blue: "#00F" };
void palette;`,
				},
				{
					code: `${declarations}
namespace Types {
    export interface Palette {
        readonly Blue: string;
    }
}
type Palette = Types.Palette;
const palette: Palette = { Blue: "#00F" };`,
				},
				{
					code: `${declarations}
type Box<TValue> = MissingAlias<TValue>;
type Palette = Box<Color>;
const palette: Palette = { Blue: "#00F" };`,
				},
				{
					code: `${declarations}
type Box<TValue> = Record;
type Palette = Box<Color>;
const palette: Palette = { Blue: "#00F" };`,
				},
				{
					code: `${declarations}
type Box<TValue> = Readonly;
type Palette = Box<Record<Color, string>>;
const palette: Palette = { Blue: "#00F" };`,
				},
				{
					code: `${declarations}
type Identity<TValue> = TValue;
type Palette = Identity<Record>;
const palette: Palette = { Blue: "#00F" };`,
				},
				{
					code: `${declarations}
type Identity<TValue> = TValue;
type Palette = Identity<Readonly>;
const palette: Palette = { Blue: "#00F" };`,
				},
				{
					code: `${declarations}
type Alias = MissingAlias;
const palette: Alias = { Blue: "#00F" };`,
				},
				{
					code: `${declarations}
type WrappedUnknown = Readonly<MissingAlias>;
const palette: WrappedUnknown = { Blue: "#00F" };`,
				},
				{
					code: `${declarations}
type Inner<TValue> = Record<TValue, string>;
type Palette<TKey extends Color> = Inner<TKey>;
const palette: Palette = { Blue: "#00F" };`,
				},
				{
					code: `${declarations}
type Palette = MissingAlias<Color>;
const palette: Palette = { Blue: "#00F" };`,
				},
			],
			"prefer-enum-member-valid",
		),
	});
});
