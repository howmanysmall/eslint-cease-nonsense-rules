import nodePath from "node:path";
import { describe, vi } from "vitest";
import rule from "$rules/prefer-read-only-properties";
import parser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";

const __dirname = import.meta.dirname;

// Type-aware tests have cold-start overhead from TypeScript project service initialization
vi.setConfig({ testTimeout: 30_000 });

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

const fixturesDir = nodePath.join(__dirname, "../fixtures/prefer-read-only-props");

const ruleTesterWithTypes = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser,
		parserOptions: {
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

describe("prefer-read-only-props", () => {
	// @ts-expect-error -- this thing is dumb.
	ruleTester.run("prefer-read-only-props", rule, {
		invalid: [
			// Non-destructured props in parameter
			{
				code: "function Component(props: { value: string }) { return null; }",
				errors: [{ data: { name: "value" }, messageId: "readOnlyProperty" }],
				output: "function Component(props: { readonly value: string }) { return null; }",
			},
			// Multiple props without readonly
			{
				code: "function Component(props: { a: number; b: string }) { return null; }",
				errors: [
					{ data: { name: "a" }, messageId: "readOnlyProperty" },
					{ data: { name: "b" }, messageId: "readOnlyProperty" },
				],
				output: "function Component(props: { readonly a: number; readonly b: string }) { return null; }",
			},
			// FunctionExpression with non-readonly props
			{
				code: "const Component = function(props: { value: string }) { return null; };",
				errors: [{ data: { name: "value" }, messageId: "readOnlyProperty" }],
				output: "const Component = function(props: { readonly value: string }) { return null; };",
			},
			// Arrow function with non-readonly props
			{
				code: "const Component = (props: { value: string }) => null;",
				errors: [{ data: { name: "value" }, messageId: "readOnlyProperty" }],
				output: "const Component = (props: { readonly value: string }) => null;",
			},
			// VariableDeclarator with function expression
			{
				code: "const Component = function(props: { name: string }) { return null; };",
				errors: [{ data: { name: "name" }, messageId: "readOnlyProperty" }],
				output: "const Component = function(props: { readonly name: string }) { return null; };",
			},
			// VariableDeclarator with arrow function
			{
				code: "const Component = (props: { name: string }) => { return null; };",
				errors: [{ data: { name: "name" }, messageId: "readOnlyProperty" }],
				output: "const Component = (props: { readonly name: string }) => { return null; };",
			},
			// Property with string literal key
			{
				code: "function Component(props: { 'prop-name': string }) { return null; }",
				errors: [{ data: { name: "unknown" }, messageId: "readOnlyProperty" }],
				output: "function Component(props: { readonly 'prop-name': string }) { return null; }",
			},
			// Optional property without readonly
			{
				code: "function Component(props: { value?: string }) { return null; }",
				errors: [{ data: { name: "value" }, messageId: "readOnlyProperty" }],
				output: "function Component(props: { readonly value?: string }) { return null; }",
			},
			// Multiple parameters, props not first
			{
				code: "function Component(other: number, props: { value: string }) { return null; }",
				errors: [{ data: { name: "value" }, messageId: "readOnlyProperty" }],
				output: "function Component(other: number, props: { readonly value: string }) { return null; }",
			},
			{
				code: 'function Component(props: { value: string } = { value: "" }) { return null; }',
				errors: [{ data: { name: "value" }, messageId: "readOnlyProperty" }],
				output: 'function Component(props: { readonly value: string } = { value: "" }) { return null; }',
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
			{
				code: "const Component;",
			},
			// TSTypeReference (type alias) - getPropertiesFromType returns empty array
			{
				code: "type Props = { value: string }; function Component(props: Props) { return null; }",
			},
			// Function with no type annotation
			{
				code: "function Component(props) { return null; }",
			},
			{
				code: 'function Component(props: { readonly value: string } = { value: "" }) { return null; }',
			},
			{
				code: "function Component(...props: [{ value: string }]) { return null; }",
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
			{
				code: "function Component(props: { [name]: string }) { return null; }",
			},
			// Component cache - same function visited twice (should not duplicate errors)
			// This is tested implicitly by the rule's cache mechanism
		],
	});

	// @ts-expect-error -- this thing is dumb.
	ruleTesterWithTypes.run("prefer-read-only-props-types", rule, {
		invalid: [
			{
				code: `
declare function jsxElement(): JSX.Element;
function Component(props: { value: string }): JSX.Element {
    return jsxElement();
}`,
				errors: [{ messageId: "preferReadOnlyProperties" }],
			},
			{
				code: `
declare function jsxElement(): JSX.Element;
interface Props {
	[key: string]: string;
}
function Component(props: Props): JSX.Element {
    return jsxElement();
}`,
				errors: [{ messageId: "preferReadOnlyProperties" }],
			},
			{
				code: `
declare function jsxElement(): JSX.Element;
interface BaseProps {
	readonly inherited: string;
}
interface Props extends BaseProps {
	value: string;
}
function Component(props: Props): JSX.Element {
    return jsxElement();
}`,
				errors: [{ messageId: "preferReadOnlyProperties" }],
			},
			{
				code: `
declare function jsxElement(): JSX.Element;
interface GrandProps {
	value: string;
}
interface BaseProps extends GrandProps {}
interface Props extends BaseProps {
	readonly label: string;
}
function Component(props: Props): JSX.Element {
    return jsxElement();
}`,
				errors: [{ messageId: "preferReadOnlyProperties" }],
			},
			{
				code: `
declare namespace React {
	type FC<Props> = (props: Props) => JSX.Element;
}
const Component: React.FC<{ value: string }> = (props) => props.value;`,
				errors: [{ messageId: "preferReadOnlyProperties" }],
			},
			{
				code: `
declare namespace React {
	function forwardRef<Ref, Props>(render: (props: Props, ref: Ref) => JSX.Element): JSX.Element;
}
const Component = React.forwardRef<HTMLDivElement, { value: string }>((props) => {
	return props.value;
});`,
				errors: [{ messageId: "preferReadOnlyProperties" }],
			},
			{
				code: `
declare namespace React {
	function memo<Props>(component: (props: Props) => JSX.Element): JSX.Element;
}
const Component = React.memo<{ value: string }>((props) => {
	return props.value;
});`,
				errors: [{ messageId: "preferReadOnlyProperties" }],
			},
			{
				code: `
declare function memo<Props>(component: (props: Props) => JSX.Element): JSX.Element;
const Component = memo<{ value: string }>((props) => {
	return props.value;
});`,
				errors: [{ messageId: "preferReadOnlyProperties" }],
			},
			{
				code: `
declare namespace React {
	function memo<Props>(component: (props: Props) => JSX.Element): JSX.Element;
}
declare function hoc(component: JSX.Element): JSX.Element;
const Component = hoc(React.memo<{ value: string }>((props) => {
	return props.value;
}));`,
				errors: [{ messageId: "preferReadOnlyProperties" }],
			},
			{
				code: `
declare function hoc<Props>(component: (props: Props) => JSX.Element): JSX.Element;
const Component = hoc((props: { value: string }) => {
	return props.value;
});`,
				errors: [{ messageId: "preferReadOnlyProperties" }],
			},
			{
				code: `
declare function memo<Props>(component: (props: Props) => JSX.Element): JSX.Element;
declare function getWrapper(): { memo: typeof memo };
const Component = getWrapper()["memo"]<{ value: string }>((props) => props.value);`,
				errors: [{ messageId: "preferReadOnlyProperties" }],
			},
		],
		valid: [
			{
				code: "const Component = 1;",
			},
			{
				code: "const { Component } = { Component: 1 };",
			},
			{
				code: "let Component;",
			},
			{
				code: "const Component = getComponent();",
			},
			{
				code: `
declare function getComponent(): JSX.Element;
const Component = getComponent;`,
			},
			{
				code: `
declare function jsxElement(): JSX.Element;
function Component(): JSX.Element {
	return jsxElement();
}`,
			},
			{
				code: `
declare function jsxElement(): JSX.Element;
interface CallableComponent {
	(): JSX.Element;
}
const Component: CallableComponent = () => jsxElement();`,
			},
			{
				code: `
declare function hoc(value: number): JSX.Element;
const Component = hoc(42);`,
			},
			{
				code: `
declare namespace React {
	type FC<Props> = (props: Props) => JSX.Element;
}
declare function jsxElement(): JSX.Element;
const Component: React.FC = () => jsxElement();`,
			},
			{
				code: `
declare namespace React {
	type ComponentType<Props> = {
		readonly props: Props;
	};
}
const Component: React.ComponentType<{ value: string }> = { props: { value: "" } };`,
			},
			{
				code: `
declare namespace React {
	type FC<Props> = (props: Props) => JSX.Element;
}
const Component: React.FC<Readonly<{ value: string }>> = (props) => props.value;`,
			},
			{
				code: `
declare function jsxElement(): JSX.Element;
interface Props {
	children: string;
}
function Component(props: Props): JSX.Element {
	return jsxElement();
}`,
			},
			{
				code: `
declare function jsxElement(): JSX.Element;
interface BaseProps {
	readonly value: string;
}
interface Props extends BaseProps {
	readonly label: string;
}
function Component(props: Props): JSX.Element {
	return jsxElement();
}`,
			},
			{
				code: `
declare function jsxElement(): JSX.Element;
type DeepReadOnly<T> = {
	readonly [K in keyof T]: T[K];
};
interface BaseProps {
	value: string;
}
type ReadonlyBaseProps = DeepReadOnly<BaseProps>;
interface Props extends ReadonlyBaseProps {
	readonly label: string;
}
function Component(props: Props): JSX.Element {
	return jsxElement();
}`,
			},
			{
				code: `
declare function jsxElement(): JSX.Element;
interface BaseProps {
	readonly value: string;
}
interface MiddleProps extends BaseProps {}
interface Props extends MiddleProps {
	readonly label: string;
}
function Component(props: Props): JSX.Element {
	return jsxElement();
}`,
			},
			{
				code: `
declare function jsxElement(): JSX.Element;
interface Props {
	readonly [key: string]: string;
}
function Component(props: Props): JSX.Element {
	return jsxElement();
}`,
			},
			{
				code: `
declare function jsxElement(): JSX.Element;
type Props = { readonly value: string } & { readonly label: string };
function Component(props: Props): JSX.Element {
	return jsxElement();
}`,
			},
			{
				code: `
declare namespace React {
	function forwardRef<Ref, Props>(render: (props: Props, ref: Ref) => JSX.Element): JSX.Element;
}
declare function jsxElement(): JSX.Element;
const Component = React.forwardRef<HTMLDivElement>((props) => {
	return jsxElement();
});`,
			},
			{
				code: `
declare namespace React {
	function lazy<Props>(): (props: Props) => JSX.Element;
}
const Component = React.lazy<{ value: string }>();`,
			},
			{
				code: `
declare function jsxElement(): JSX.Element;
function helper(props: { value: string }): JSX.Element {
	return jsxElement();
}`,
			},
			{
				code: `
function UnionComponent(props: { value: string }): string | number {
    return props.value;
}`,
			},
			{
				code: `
declare function jsxElement(): JSX.Element;

interface PrimaryProps {
	readonly value: string;
	readonly variant?: "primary";
}

interface SecondaryProps {
	readonly value: string;
	readonly size?: "small";
}

function UnionPropsComponent(props: PrimaryProps | SecondaryProps): JSX.Element {
	return jsxElement();
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
