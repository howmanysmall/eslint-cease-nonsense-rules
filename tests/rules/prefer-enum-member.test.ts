import { describe, setDefaultTimeout } from "bun:test";
import { join } from "node:path";
import parser from "@typescript-eslint/parser";
import { RuleTester } from "@typescript-eslint/rule-tester";
import rule from "../../src/rules/prefer-enum-member";

// Type-aware tests have cold-start overhead from TypeScript project service initialization
setDefaultTimeout(30_000);

const fixturesDir = join(__dirname, "../fixtures/prefer-enum-member");

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser,
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

describe("prefer-enum-member", () => {
	ruleTester.run("prefer-enum-member", rule, {
		invalid: [
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
declare const Swatch: (props: { color: Color }) => unknown;
<Swatch color="Blue" />;`,
				errors: [{ messageId: "preferEnumMember" }],
				output: `${declarations}
declare const Swatch: (props: { color: Color }) => unknown;
<Swatch color={Color.Blue} />;`,
			},
		],
		valid: [
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
type Loose = { foo: string };
const loose: Loose = { foo: "bar" };`,
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
		],
	});
});
