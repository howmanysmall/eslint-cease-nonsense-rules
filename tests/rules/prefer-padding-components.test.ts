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
			{
				code: `import EqualPadding from "../ui/equal-padding";

export function Example(padding: UDim) {
    return <uipadding PaddingBottom={padding} PaddingLeft={padding} PaddingRight={padding} PaddingTop={padding} />;
}`,
				errors: [{ messageId: "preferEqualPadding" }],
				filename: nodePath.join(WITH_COMPONENTS, "src", "screens", "default-equal.tsx"),
				output: `import EqualPadding from "../ui/equal-padding";

export function Example(padding: UDim) {
    return <EqualPadding padding={padding} />;
}`,
			},
			{
				code: `import DirectionalPadding from "../ui/directional-padding";

export function Example(horizontal: UDim, vertical: UDim) {
    return <uipadding PaddingBottom={horizontal} PaddingLeft={vertical} PaddingRight={vertical} PaddingTop={horizontal} />;
}`,
				errors: [{ messageId: "preferDirectionalPadding" }],
				filename: nodePath.join(WITH_COMPONENTS, "src", "screens", "default-directional.tsx"),
				output: `import DirectionalPadding from "../ui/directional-padding";

export function Example(horizontal: UDim, vertical: UDim) {
    return <DirectionalPadding horizontal={horizontal} vertical={vertical} />;
}`,
			},
			{
				code: `import { "EqualPadding" as LocalPadding } from "../ui/equal-padding";

export function Example(padding: UDim) {
    return <uipadding PaddingBottom={padding} PaddingLeft={padding} PaddingRight={padding} PaddingTop={padding} />;
}`,
				errors: [{ messageId: "preferEqualPadding" }],
				filename: nodePath.join(WITH_COMPONENTS, "src", "screens", "string-import-equal.tsx"),
				output: `import { "EqualPadding" as LocalPadding } from "../ui/equal-padding";

export function Example(padding: UDim) {
    return <LocalPadding padding={padding} />;
}`,
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

	export function Example() {
	    return <uipadding PaddingBottom="12" PaddingLeft="12" PaddingRight="12" PaddingTop="12">{}</uipadding>;
	}`,
				errors: [{ messageId: "preferEqualPadding" }],
				filename: nodePath.join(WITH_COMPONENTS, "src", "screens", "literal-empty-child.tsx"),
				output: `import { EqualPadding } from "../ui/equal-padding";

	export function Example() {
	    return <EqualPadding padding="12" />;
	}`,
			},
			{
				code: `import { EqualPadding as FirstPadding } from "../ui/equal-padding";
		import { EqualPadding as SecondPadding } from "../ui/equal-padding";

	export function Example(padding: UDim) {
	    return <uipadding PaddingBottom={padding} PaddingLeft={padding} PaddingRight={padding} PaddingTop={padding} />;
	}`,
				errors: [{ messageId: "preferEqualPadding" }],
				filename: nodePath.join(WITH_COMPONENTS, "src", "screens", "ambiguous-imports.tsx"),
			},
			{
				code: `import * as Padding from "../ui/equal-padding";

	export function Example(padding: UDim) {
	    return <uipadding PaddingBottom={padding} PaddingLeft={padding} PaddingRight={padding} PaddingTop={padding} />;
	}`,
				errors: [{ messageId: "preferEqualPadding" }],
				filename: nodePath.join(WITH_COMPONENTS, "src", "screens", "namespace-import.tsx"),
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
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

	export function Example(padding: UDim) {
	    return (
	        <uipadding PaddingBottom={padding} PaddingLeft={padding} PaddingRight={padding} PaddingTop={padding}>
	            <frame />
	        </uipadding>
	    );
	}`,
				filename: nodePath.join(WITH_COMPONENTS, "src", "screens", "children.tsx"),
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

	export function Example(padding: UDim) {
	    return <uipadding PaddingBottom={padding} PaddingLeft={padding} PaddingRight={padding} />;
	}`,
				filename: nodePath.join(WITH_COMPONENTS, "src", "screens", "missing-attribute.tsx"),
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

	export function Example(padding: UDim) {
	    return <uipadding PaddingBottom={padding} PaddingLeft={padding} PaddingRight={padding} PaddingTop />;
	}`,
				filename: nodePath.join(WITH_COMPONENTS, "src", "screens", "bare-attribute.tsx"),
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

	export function Example(padding: UDim) {
	    return <uipadding PaddingBottom={padding} PaddingLeft={padding} PaddingRight={padding} PaddingTop={<frame />} />;
	}`,
				filename: nodePath.join(WITH_COMPONENTS, "src", "screens", "jsx-value.tsx"),
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

	export function Example(padding: UDim) {
	    return <uipadding PaddingBottom={padding} PaddingLeft={padding} PaddingRight={padding} PaddingTop=<frame /> />;
	}`,
				filename: nodePath.join(WITH_COMPONENTS, "src", "screens", "direct-jsx-value.tsx"),
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

	export function Example(padding: UDim) {
	    return <uipadding PaddingBottom={padding} PaddingLeft PaddingRight={padding} PaddingTop={padding} />;
	}`,
				filename: nodePath.join(WITH_COMPONENTS, "src", "screens", "bare-middle-attribute.tsx"),
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

	export function Example() {
	    return <uipadding PaddingBottom={[1, 2]} PaddingLeft={[1, 2]} PaddingRight={[1, 2, 3]} PaddingTop={[1, 2]} />;
	}`,
				filename: nodePath.join(WITH_COMPONENTS, "src", "screens", "array-mismatch.tsx"),
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

	export function Example() {
	    return <uipadding PaddingBottom={[{ value: 1 }]} PaddingLeft={[{ value: 1 }]} PaddingRight={[{ value: 2 }]} PaddingTop={[{ value: 1 }]} />;
	}`,
				filename: nodePath.join(WITH_COMPONENTS, "src", "screens", "array-value-mismatch.tsx"),
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

	export function Example() {
	    return <uipadding PaddingBottom={{ value: 1 }} PaddingLeft={{ value: 1 }} PaddingRight={{ value: 2 }} PaddingTop={{ value: 1 }} />;
	}`,
				filename: nodePath.join(WITH_COMPONENTS, "src", "screens", "object-mismatch.tsx"),
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

	export function Example() {
	    return <uipadding PaddingBottom={{ first: 1 }} PaddingLeft={{ first: 1 }} PaddingRight={{ second: 1 }} PaddingTop={{ first: 1 }} />;
	}`,
				filename: nodePath.join(WITH_COMPONENTS, "src", "screens", "object-key-mismatch.tsx"),
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

	export function Example() {
	    return <uipadding PaddingBottom={/medium/u} PaddingLeft={/small/u} PaddingRight={/large/u} PaddingTop="medium" />;
	}`,
				filename: nodePath.join(WITH_COMPONENTS, "src", "screens", "literal-regex-mismatch.tsx"),
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

	export function Example() {
	    return <uipadding PaddingBottom={null} PaddingLeft={null} PaddingRight={undefined} PaddingTop={null} />;
	}`,
				filename: nodePath.join(WITH_COMPONENTS, "src", "screens", "null-mismatch.tsx"),
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

	export function Example() {
	    return <uipadding PaddingBottom={null} PaddingLeft={{ value: 1 }} PaddingRight={{ value: 1 }} PaddingTop={{ value: 1 }} />;
	}`,
				filename: nodePath.join(WITH_COMPONENTS, "src", "screens", "null-object-mismatch.tsx"),
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

	export function Example(padding: UDim) {
	    return <frame PaddingBottom={padding} PaddingLeft={padding} PaddingRight={padding} PaddingTop={padding} />;
	}`,
				filename: nodePath.join(WITH_COMPONENTS, "src", "screens", "wrong-element.tsx"),
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

	export function Example(padding: UDim) {
	    return <Padding.Container PaddingBottom={padding} PaddingLeft={padding} PaddingRight={padding} PaddingTop={padding} />;
	}`,
				filename: nodePath.join(WITH_COMPONENTS, "src", "screens", "member-element.tsx"),
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

	export function Example(padding: UDim) {
	    return <uipadding PaddingBottom={padding} PaddingLeft={padding} PaddingRight={padding} PaddingTop={} />;
	}`,
				filename: nodePath.join(WITH_COMPONENTS, "src", "screens", "empty-expression.tsx"),
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

	export function Example(padding: UDim) {
	    return <uipadding layout:PaddingBottom={padding} PaddingLeft={padding} PaddingRight={padding} PaddingTop={padding} />;
	}`,
				filename: nodePath.join(WITH_COMPONENTS, "src", "screens", "namespaced-attribute.tsx"),
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

	export function Example(padding: UDim) {
	    return <uipadding PaddingBottom={padding} PaddingBottom={padding} PaddingLeft={padding} PaddingRight={padding} PaddingTop={padding} />;
	}`,
				filename: nodePath.join(WITH_COMPONENTS, "src", "screens", "duplicate-attribute.tsx"),
			},
			{
				code: `import { EqualPadding } from "@scope/equal-padding";

	export function Example(padding: UDim) {
	    return <uipadding PaddingBottom={padding} PaddingLeft={padding} PaddingRight={padding} PaddingTop={padding} />;
	}`,
				filename: nodePath.join(WITHOUT_COMPONENTS, "src", "screens", "package-import.tsx"),
			},
			{
				code: `import { EqualPadding } from "../ui/missing-padding";

	export function Example(padding: UDim) {
	    return <uipadding PaddingBottom={padding} PaddingLeft={padding} PaddingRight={padding} PaddingTop={padding} />;
	}`,
				filename: nodePath.join(WITHOUT_COMPONENTS, "src", "screens", "unresolved-import.tsx"),
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

	export function Example() {
	    return <uipadding PaddingBottom={{ nested: { value: 1 } }} PaddingLeft={{ nested: { value: 1 } }} PaddingRight={{ nested: { value: 1, extra: true } }} PaddingTop={{ nested: { value: 1 } }} />;
	}`,
				filename: nodePath.join(WITH_COMPONENTS, "src", "screens", "nested-object-mismatch.tsx"),
			},
		],
	});
});
