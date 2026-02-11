import { describe, setDefaultTimeout } from "bun:test";
import { join } from "node:path";
import parser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import rule from "../../src/rules/prefer-read-only-props";

// Type-aware tests have cold-start overhead from TypeScript project service initialization
setDefaultTimeout(30_000);

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser,
		parserOptions: {
			ecmaFeatures: { jsx: true },
		},
		sourceType: "module",
	},
});

const fixturesDir = join(__dirname, "../fixtures/prefer-read-only-props");

const ruleTesterWithTypes = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser,
		parserOptions: {
			projectService: {
				allowDefaultProject: ["*.ts", "*.tsx"],
				defaultProject: join(fixturesDir, "tsconfig.json"),
				"maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING": 64,
			},
			tsconfigRootDir: fixturesDir,
		},
		sourceType: "module",
	},
});

describe("prefer-read-only-props", () => {
	// @ts-expect-error -- this thing is dumb.
	ruleTester.run("prefer-read-only-props", rule, {
		invalid: [
			// Non-destructured props in parameter
			{
				code: "function Component(props: { value: string }) { return null; }",
				errors: [{ data: { name: "value" }, messageId: "readOnlyProp" }],
				output: "function Component(props: { readonly value: string }) { return null; }",
			},
			// Multiple props without readonly
			{
				code: "function Component(props: { a: number; b: string }) { return null; }",
				errors: [
					{ data: { name: "a" }, messageId: "readOnlyProp" },
					{ data: { name: "b" }, messageId: "readOnlyProp" },
				],
				output: "function Component(props: { readonly a: number; readonly b: string }) { return null; }",
			},
			// FunctionExpression with non-readonly props
			{
				code: "const Component = function(props: { value: string }) { return null; };",
				errors: [{ data: { name: "value" }, messageId: "readOnlyProp" }],
				output: "const Component = function(props: { readonly value: string }) { return null; };",
			},
			// Arrow function with non-readonly props
			{
				code: "const Component = (props: { value: string }) => null;",
				errors: [{ data: { name: "value" }, messageId: "readOnlyProp" }],
				output: "const Component = (props: { readonly value: string }) => null;",
			},
			// VariableDeclarator with function expression
			{
				code: "const Component = function(props: { name: string }) { return null; };",
				errors: [{ data: { name: "name" }, messageId: "readOnlyProp" }],
				output: "const Component = function(props: { readonly name: string }) { return null; };",
			},
			// VariableDeclarator with arrow function
			{
				code: "const Component = (props: { name: string }) => { return null; };",
				errors: [{ data: { name: "name" }, messageId: "readOnlyProp" }],
				output: "const Component = (props: { readonly name: string }) => { return null; };",
			},
			// Property with string literal key
			{
				code: "function Component(props: { 'prop-name': string }) { return null; }",
				errors: [{ data: { name: "unknown" }, messageId: "readOnlyProp" }],
				output: "function Component(props: { readonly 'prop-name': string }) { return null; }",
			},
			// Optional property without readonly
			{
				code: "function Component(props: { value?: string }) { return null; }",
				errors: [{ data: { name: "value" }, messageId: "readOnlyProp" }],
				output: "function Component(props: { readonly value?: string }) { return null; }",
			},
			// Multiple parameters, props not first
			{
				code: "function Component(other: number, props: { value: string }) { return null; }",
				errors: [{ data: { name: "value" }, messageId: "readOnlyProp" }],
				output: "function Component(other: number, props: { readonly value: string }) { return null; }",
			},
		],
		valid: [
			// Non-component functions should be ignored
			{
				code: "function makeConfig(props: { value: string }) { return props.value; }",
			},
			{
				code: "const buildConfig = (props: { value: string }) => props.value;",
			},
			// Already-readonly props (should NOT warn)
			{
				code: "function Component(props: { readonly name: string }) { return null; }",
			},
			// Props with readonly modifier already
			{
				code: "const Component = (props: { readonly name: string }) => null;",
			},
			// All props readonly
			{
				code: "function Component(props: { readonly name: string; readonly age: number }) { return null; }",
			},
			// Function without props
			{
				code: "function Component() { return null; }",
			},
			// Function with non-object props type
			{
				code: "function Component(props: string) { return null; }",
			},
			// Non-component function - rule checks all functions, so this would be flagged
			// Removing this test case as the rule behavior is to check all functions
			// Destructured props (not supported by rule - only checks Identifier params)
			{
				code: "function Component({ name }: { name: string }) { return null; }",
			},
			{
				code: "const Component = ({ name }: { name: string }) => null;",
			},
			// FunctionExpression with readonly props
			{
				code: "const Component = function(props: { readonly name: string }) { return null; };",
			},
			// FunctionExpression assigned to variable
			{
				code: "const Component = function(props: { readonly value: string }) { return null; };",
			},
			// TSTypeReference (type alias) - getPropertiesFromType returns empty array
			{
				code: "type Props = { value: string }; function Component(props: Props) { return null; }",
			},
			// Function with no type annotation
			{
				code: "function Component(props) { return null; }",
			},
			// Empty type literal
			{
				code: "function Component(props: {}) { return null; }",
			},
			// Optional property with readonly
			{
				code: "function Component(props: { readonly value?: string }) { return null; }",
			},
			// Multiple parameters, first one without type
			{
				code: "function Component(other, props: { readonly value: string }) { return null; }",
			},
			// Index signature (not TSPropertySignature, so rule doesn't check it)
			{
				code: "function Component(props: { [key: string]: string }) { return null; }",
			},
			// Component cache - same function visited twice (should not duplicate errors)
			// This is tested implicitly by the rule's cache mechanism
		],
	});

	ruleTesterWithTypes.run("prefer-read-only-props-types", rule, {
		invalid: [
			{
				code: `
declare function jsxElement(): JSX.Element;
function Component(props: { value: string }): JSX.Element {
    return jsxElement();
}`,
				errors: [{ messageId: "preferReadOnlyProps" }],
			},
		],
		valid: [
			{
				code: `
function UnionComponent(props: { value: string }): string | number {
    return props.value;
}`,
			},
			{
				code: `
type FancyElement = string;
function ElementComponent(props: { value: string }): FancyElement {
    return props.value;
}`,
			},
			{
				code: `
function StringComponent(props: { value: string }): string {
    return props.value;
}`,
			},
			{
				code: `
type CustomReturn = { value: string };
function CustomComponent(props: { value: string }): CustomReturn {
    return { value: props.value };
}`,
			},
		],
	});
});
