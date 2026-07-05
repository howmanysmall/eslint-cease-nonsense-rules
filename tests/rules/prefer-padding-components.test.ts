import nodePath from "node:path";
import { describe } from "vitest";
import rule from "$rules/prefer-padding-components";
import tsParser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";

const FIXTURES = nodePath.join(import.meta.dirname, "..", "fixtures", "prefer-padding-components");
const WITH_COMPONENTS = nodePath.join(FIXTURES, "with-components");
const WITHOUT_COMPONENTS = nodePath.join(FIXTURES, "without-components");
const FIXTURE_ONLY_COMPONENTS = nodePath.join(FIXTURES, "fixture-only");

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser: tsParser,
		parserOptions: {
			ecmaFeatures: { jsx: true },
		},
		sourceType: "module",
	},
});

describe("prefer-padding-components", () => {
	// @ts-expect-error RuleTester types incompatible with runtime rule shape
	ruleTester.run("prefer-padding-components", rule, {
		invalid: [
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

export function Example(padding: UDim) {
    return <uipadding PaddingBottom={padding} PaddingLeft={padding} PaddingRight={padding} PaddingTop={padding} />;
}`,
				errors: [{ messageId: "preferEqualPadding" }],
				filename: nodePath.join(WITH_COMPONENTS, "src", "screens", "equal.tsx"),
				output: `import { EqualPadding } from "../ui/equal-padding";

export function Example(padding: UDim) {
    return <EqualPadding padding={padding} />;
}`,
			},
			{
				code: `import { DirectionalPadding as AxisPadding } from "../ui/directional-padding";

export function Example(horizontal: UDim, vertical: UDim) {
    return <uipadding PaddingBottom={horizontal} PaddingLeft={vertical} PaddingRight={vertical} PaddingTop={horizontal} />;
}`,
				errors: [{ messageId: "preferDirectionalPadding" }],
				filename: nodePath.join(WITH_COMPONENTS, "src", "screens", "directional.tsx"),
				output: `import { DirectionalPadding as AxisPadding } from "../ui/directional-padding";

export function Example(horizontal: UDim, vertical: UDim) {
    return <AxisPadding horizontal={horizontal} vertical={vertical} />;
}`,
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

export function Example(padding: UDim) {
    return <uipadding PaddingBottom={padding as UDim} PaddingLeft={padding} PaddingRight={padding} PaddingTop={padding} />;
}`,
				errors: [{ messageId: "preferEqualPadding" }],
				filename: nodePath.join(WITH_COMPONENTS, "src", "screens", "normalized.tsx"),
				output: `import { EqualPadding } from "../ui/equal-padding";

export function Example(padding: UDim) {
    return <EqualPadding padding={padding} />;
}`,
			},
			{
				code: `export function Example(padding: UDim) {
    return <uipadding PaddingBottom={padding} PaddingLeft={padding} PaddingRight={padding} PaddingTop={padding} />;
}`,
				errors: [{ messageId: "preferEqualPadding" }],
				filename: nodePath.join(WITH_COMPONENTS, "src", "screens", "report-only.tsx"),
			},
		],
		valid: [
			{
				code: `export function Example(padding: UDim) {
    return <uipadding PaddingBottom={padding} PaddingLeft={padding} PaddingRight={padding} PaddingTop={padding} />;
}`,
				filename: nodePath.join(WITHOUT_COMPONENTS, "src", "screens", "missing.tsx"),
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

export function Example(padding: UDim) {
    return <uipadding Name="Padding" PaddingBottom={padding} PaddingLeft={padding} PaddingRight={padding} PaddingTop={padding} />;
}`,
				filename: nodePath.join(WITH_COMPONENTS, "src", "screens", "extra-props.tsx"),
			},
			{
				code: `import { DirectionalPadding } from "../ui/directional-padding";

export function Example(horizontal: UDim, vertical: UDim, other: UDim) {
    return <uipadding PaddingBottom={horizontal} PaddingLeft={vertical} PaddingRight={vertical} PaddingTop={other} />;
}`,
				filename: nodePath.join(WITH_COMPONENTS, "src", "screens", "mismatch.tsx"),
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

const attributes = { PaddingBottom: padding };

export function Example(padding: UDim) {
    return <uipadding {...attributes} PaddingLeft={padding} PaddingRight={padding} PaddingTop={padding} />;
}`,
				filename: nodePath.join(WITH_COMPONENTS, "src", "screens", "spread.tsx"),
			},
			{
				code: `export function Example(padding: UDim) {
    return <uipadding PaddingBottom={padding} PaddingLeft={padding} PaddingRight={padding} PaddingTop={padding} />;
}`,
				filename: nodePath.join(FIXTURE_ONLY_COMPONENTS, "src", "screens", "fixture.tsx"),
			},
		],
	});
});
