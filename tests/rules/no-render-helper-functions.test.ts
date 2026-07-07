import { describe } from "vitest";
import rule from "$rules/no-render-helper-functions";
import parser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser,
		parserOptions: { ecmaFeatures: { jsx: true } },
		sourceType: "module",
	},
});

describe("no-render-helper-functions", () => {
	// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
	ruleTester.run("no-render-helper-functions", rule, {
		invalid: [
			{
				code: "function createLabel() { return <div />; }",
				errors: [{ messageId: "noRenderHelper" }],
			},
			{
				code: "function createLeftLabel(text: string) { return <TextLabel text={text} />; }",
				errors: [{ messageId: "noRenderHelper" }],
			},
			{
				code: "function renderHeader() { return <header>Header</header>; }",
				errors: [{ messageId: "noRenderHelper" }],
			},
			{
				code: "const createLabel = () => <div />;",
				errors: [{ messageId: "noRenderHelper" }],
			},
			{
				code: "const createLabel = (): React.ReactNode => <div />;",
				errors: [{ messageId: "noRenderHelper" }],
			},
			{
				code: "const createLabel = (): ReactNode => <div />;",
				errors: [{ messageId: "noRenderHelper" }],
			},
			{
				code: "const renderItem = (item: string) => <div>{item}</div>;",
				errors: [{ messageId: "noRenderHelper" }],
			},
			{
				code: "function createRightLabel(text: string, gradient: ColorSequence, rotation: number | undefined): React.ReactNode { return <TextLabel />; }",
				errors: [{ messageId: "noRenderHelper" }],
			},
			{
				code: "const buildElement = () => { return <div><span>Nested</span></div>; };",
				errors: [{ messageId: "noRenderHelper" }],
			},
			{
				code: "function makeFragment() { return <>Fragment Content</>; }",
				errors: [{ messageId: "noRenderHelper" }],
			},
			{
				code: "const get_label = () => <label />;",
				errors: [{ messageId: "noRenderHelper" }],
			},
			{
				code: "function createButton(): JSX.Element { return <button />; }",
				errors: [{ messageId: "noRenderHelper" }],
			},
			{
				code: "function createButton(): React.ReactElement { return <button />; }",
				errors: [{ messageId: "noRenderHelper" }],
			},
			{
				code: "function createButton(): ReactElement { return <button />; }",
				errors: [{ messageId: "noRenderHelper" }],
			},
			{
				code: "function createButton(): Promise<JSX.Element> { return <button />; }",
				errors: [{ messageId: "noRenderHelper" }],
			},
			{
				code: "const renderPanel = function namedPanel() { return <div />; };",
				errors: [{ messageId: "noRenderHelper" }],
			},
			{
				code: "const renderPanel: ReactNode = function() { return 'text'; };",
				errors: [{ messageId: "noRenderHelper" }],
			},
			{
				code: "const renderPanel: ReactNode = () => 'text';",
				errors: [{ messageId: "noRenderHelper" }],
			},
			{
				code: "export function createLayout() { return <div />; }",
				errors: [{ messageId: "noRenderHelper" }],
			},
			{
				code: `function createLabel(text: string): React.ReactNode {
    return (
        <TextLabel
            nativeProperties={{ Text: text }}
            strokeEnabled={true}
        />
    );
}`,
				errors: [{ messageId: "noRenderHelper" }],
			},
			{
				code: "const renderPanel = function() { return <div />; };",
				errors: [{ messageId: "noRenderHelper" }],
			},
			{
				code: `function createDecoratedLabel(condition: boolean) {
    let value;
    if (condition) return;
    value = new Date().getTime() || 1;
    return <div>{value}</div>;
}`,
				errors: [{ messageId: "noRenderHelper" }],
			},
			{
				code: `function createConditionalLabel(condition: boolean) {
    if (condition) {
        return "fallback";
    } else {
        return <div />;
    }
}`,
				errors: [{ messageId: "noRenderHelper" }],
			},
		],
		valid: [
			"function Component() { return <div />; }",
			"function MyComponent() { return <div />; }",
			"function MyComponent(props: Props) { return <div>{props.children}</div>; }",
			"const Component = () => <div />;",
			"const Component = (): JSX.Element => <div />;",
			"const Component = function() { return <div />; };",
			"export function HeaderComponent() { return <header />; }",
			"function useCustomHook() { return <div />; }",
			"function useFetchData(): React.ReactNode { return <div />; }",
			"const useData = () => <div />;",
			"function createUser(name: string) { return { name }; }",
			"const createId = () => Math.random();",
			"function buildConfig() { return { setting: true }; }",
			"const renderString = () => 'text';",
			"function createFactory(): React.FC { return createComponent; }",
			"function createSelf(): this { return this; }",
			"function createTitle(): string { return 'Title'; }",
			"function getNumber() { return 42; }",
			"export default () => <div />;",
			"export default function() { return <div />; }",
			{
				code: "items.map(item => <div key={item.id}>{item.name}</div>)",
			},
			{
				code: "items.map(function(item) { return <div key={item.id}>{item.name}</div>; })",
			},
			{
				code: "const Component = () => { const inline = () => <span />; return <div />; };",
			},
			{
				code: "array.filter(x => x.active).map(x => <Item key={x.id} data={x} />)",
			},
			{
				code: "<Button onClick={() => <Modal />} />",
			},
			"class MyClass { render() { return <div />; } }",
			"class MyClass { renderItem() { return <div />; } }",
			{
				code: "function Component() { function helper() { return 'text'; } return <div>{helper()}</div>; }",
			},
			{
				code: "const List = () => { const renderItem = (item: string) => item.toUpperCase(); return <div />; };",
			},
			{
				code: "const callbacks = [() => <span />];",
			},
			{
				code: "const { renderPanel = () => <div /> } = props;",
			},
			{
				code: "const { renderPanel } = () => <div />;",
			},
			{
				code: "const Component = function() { const renderItem = function() { return <span />; }; return <div />; };",
			},
			{
				code: "const { renderPanel = function() { return <div />; } } = props;",
			},
			{
				code: "const { renderPanel } = function() { return <div />; };",
			},
			{
				code: "const useRenderPanel = function() { return <div />; };",
			},
			{
				code: "function createSparseItems(value: string) { return [value, , 'fallback']; }",
			},
			{
				code: "function createItems() { return [<div />]; }",
			},
			{
				code: "function createOptions() { return { child: <div /> }; }",
			},
			{
				code: "function createFallback(condition: boolean) { return condition ? <div /> : <span />; }",
			},
			{
				code: "function createValue(value: number) { return -value; }",
			},
			{
				code: "async function createResult(result: Promise<string>) { return await result; }",
			},
			{
				code: "function createNestedValue(data: { current?: { value: string } }) { return data.current?.value; }",
			},
			{
				code: "function createTypedValue(value: unknown) { return value as string; }",
			},
			{
				code: `function createSwitchValue(value: string) {
    switch (value) {
        case "first": {
            const normalized = value.toUpperCase();
            return normalized;
        }
        default:
            return value;
    }
}`,
			},
		],
	});
});
