import { describe, it, expect } from "bun:test";
import { RuleTester } from "eslint";
import parser from "@typescript-eslint/parser";
import rule from "../../src/rules/require-react-component-keys";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		sourceType: "module",
		parser,
		parserOptions: {
			ecmaFeatures: {
				jsx: true,
			},
		},
	},
});

describe("require-react-component-keys", () => {
	it("should pass valid cases", () => {
		expect(() => {
			ruleTester.run("require-react-component-keys", rule, {
				valid: [
					// Top-level return
					{
						code: `
							function Good1() {
								return <div />;
							}
						`,
						languageOptions: {
							parser,
							parserOptions: {
								ecmaFeatures: { jsx: true },
							},
						},
					},
					// Arrow function top-level return
					{
						code: `
							const Good2 = () => <span />;
						`,
						languageOptions: {
							parser,
							parserOptions: {
								ecmaFeatures: { jsx: true },
							},
						},
					},
					// Proper keys
					{
						code: `
							function Good3() {
								return (
									<>
										<div key="div1" />
										<span key="span1" />
									</>
								);
							}
						`,
						languageOptions: {
							parser,
							parserOptions: {
								ecmaFeatures: { jsx: true },
							},
						},
					},
					// Nested with keys
					{
						code: `
							function Good4() {
								return (
									<div>
										<span key="span1" />
										<p key="p1" />
									</div>
								);
							}
						`,
						languageOptions: {
							parser,
							parserOptions: {
								ecmaFeatures: { jsx: true },
							},
						},
					},
					// ReactTree.mount doesn't require key
					{
						code: `
							const screenGui = screenGuiProvider.Get("ACTION_BAR");
							ReactTree.mount(<ActionBarApp />, screenGui, "action-bar");
						`,
						languageOptions: {
							parser,
							parserOptions: {
								ecmaFeatures: { jsx: true },
							},
						},
					},
					// Custom ignored call expression
					{
						code: `
							Portal.render(<CustomComponent />);
						`,
						languageOptions: {
							parser,
							parserOptions: {
								ecmaFeatures: { jsx: true },
							},
						},
						options: [{ ignoreCallExpressions: ["Portal.render"] }],
					},
					// CreateReactStory with function argument (default ignore)
					{
						code: `
							import { CreateReactStory } from "@rbxts/ui-labs";
							export = CreateReactStory(
								{
									controls: { maxValue: 100, value: 50 },
									summary: "Bar component demo.",
								},
								({ controls }) => (
									<frame BackgroundTransparency={1}>
										<Bar {...controls} key="bar" />
									</frame>
								),
							);
						`,
						languageOptions: {
							parser,
							parserOptions: {
								ecmaFeatures: { jsx: true },
							},
						},
					},
					// Allow root keys when configured
					{
						code: `
							function Component() {
								return <div key="allowed" />;
							}
						`,
						languageOptions: {
							parser,
							parserOptions: {
								ecmaFeatures: { jsx: true },
							},
						},
						options: [{ allowRootKeys: true }],
					},
					// Map callback with keyed element
					{
						code: `
							function Good5(items) {
								return items.map((item) => <span key={item.id} />);
							}
						`,
						languageOptions: {
							parser,
							parserOptions: {
								ecmaFeatures: { jsx: true },
							},
						},
					},
					// useCallback with keyed elements
					{
						code: `
							function Component() {
								const renderLayout = useCallback(() => {
									return <div key="layout" />;
								}, []);
							}
						`,
						languageOptions: {
							parser,
							parserOptions: {
								ecmaFeatures: { jsx: true },
							},
						},
					},
					// useMemo with keyed elements
					{
						code: `
							function Component() {
								const element = useMemo(() => <span key="memoized" />, []);
							}
						`,
						languageOptions: {
							parser,
							parserOptions: {
								ecmaFeatures: { jsx: true },
							},
						},
					},
						// Expression container sibling with keys
						{
							code: `
								function Good6() {
									return (
										<div>
											{<span key="first" />}
											<p key="second" />
										</div>
									);
								}
							`,
							languageOptions: {
								parser,
								parserOptions: {
									ecmaFeatures: { jsx: true },
								},
							},
						},
					// Ternary conditional return (both branches are root)
					{
						code: `
							function Good7({ condition }) {
								return condition ? <div /> : <span />;
							}
						`,
						languageOptions: {
							parser,
							parserOptions: {
								ecmaFeatures: { jsx: true },
							},
						},
					},
					// Logical expression return
					{
						code: `
							function Good8({ show }) {
								return show && <Component />;
							}
						`,
						languageOptions: {
							parser,
							parserOptions: {
								ecmaFeatures: { jsx: true },
							},
						},
					},
					// JSX fragment as prop value
					{
						code: `
							function Good9() {
								return <Suspense fallback={<></>}><Content key="content" /></Suspense>;
							}
						`,
						languageOptions: {
							parser,
							parserOptions: {
								ecmaFeatures: { jsx: true },
							},
						},
					},
					// JSX element as prop value
					{
						code: `
							function Good10() {
								return <ErrorBoundary fallback={<div>Error</div>}><App key="app" /></ErrorBoundary>;
							}
						`,
						languageOptions: {
							parser,
							parserOptions: {
								ecmaFeatures: { jsx: true },
							},
						},
					},
					// Ternary with fragment in prop
					{
						code: `
							function Good11({ placeholder }) {
								return <Suspense fallback={placeholder ?? <></>}><Content key="content" /></Suspense>;
							}
						`,
						languageOptions: {
							parser,
							parserOptions: {
								ecmaFeatures: { jsx: true },
							},
						},
					},
					// Nested ternary return
					{
						code: `
							function Good12({ a, b }) {
								return a ? <div /> : b ? <span /> : <p />;
							}
						`,
						languageOptions: {
							parser,
							parserOptions: {
								ecmaFeatures: { jsx: true },
							},
						},
					},
				],
				invalid: [
					// Elements in fragment
					{
						code: `
							function Bad1() {
								return (
									<>
										<div />
										<span />
									</>
								);
							}
						`,
						languageOptions: {
							parser,
							parserOptions: {
								ecmaFeatures: { jsx: true },
							},
						},
						errors: 2,
					},
					// Single element in fragment
					{
						code: `
							function Bad2() {
								return (
									<>
										<div />
									</>
								);
							}
						`,
						languageOptions: {
							parser,
							parserOptions: {
								ecmaFeatures: { jsx: true },
							},
						},
						errors: 1,
					},
					// Nested elements
					{
						code: `
							function Bad3() {
								return (
									<div>
										<span />
										<p />
									</div>
								);
							}
						`,
						languageOptions: {
							parser,
							parserOptions: {
								ecmaFeatures: { jsx: true },
							},
						},
						errors: 2,
					},
					// Nested fragments
					{
						code: `
							function Bad4() {
								return (
									<div>
										<>
											<span />
										</>
									</div>
								);
							}
						`,
						languageOptions: {
							parser,
							parserOptions: {
								ecmaFeatures: { jsx: true },
							},
						},
						errors: 2,
					},
					// Root component with key
					{
						code: `
							function Bad5() {
								return <div key="bad" />;
							}
						`,
						languageOptions: {
							parser,
							parserOptions: {
								ecmaFeatures: { jsx: true },
							},
						},
						errors: [{ messageId: "rootComponentWithKey" }],
					},
					// Arrow function root component with key
					{
						code: `
							const Bad6 = () => <span key="bad" />;
						`,
						languageOptions: {
							parser,
							parserOptions: {
								ecmaFeatures: { jsx: true },
							},
						},
						errors: [{ messageId: "rootComponentWithKey" }],
					},
					// Map callback missing key
					{
						code: `
							function Bad7(items) {
								return items.map((item) => <div />);
							}
						`,
						languageOptions: {
							parser,
							parserOptions: {
								ecmaFeatures: { jsx: true },
							},
						},
						errors: 1,
					},
					// useCallback missing key
					{
						code: `
							function Bad10() {
								const renderLayout = useCallback(() => {
									return <div />;
								}, []);
							}
						`,
						languageOptions: {
							parser,
							parserOptions: {
								ecmaFeatures: { jsx: true },
							},
						},
						errors: 1,
					},
					// useMemo missing key
					{
						code: `
							function Bad11() {
								const element = useMemo(() => <span />, []);
							}
						`,
						languageOptions: {
							parser,
							parserOptions: {
								ecmaFeatures: { jsx: true },
							},
						},
						errors: 1,
					},
					// Expression container map missing key
					{
						code: `
							function Bad8(items) {
								return (
									<div>
										{items.map((item) => <span />)}
									</div>
								);
							}
						`,
						languageOptions: {
							parser,
							parserOptions: {
								ecmaFeatures: { jsx: true },
							},
						},
						errors: 1,
					},
						// Array literal with single element without key
						{
							code: `
								const elements = [<div />];
							`,
							languageOptions: {
								parser,
								parserOptions: {
									ecmaFeatures: { jsx: true },
								},
							},
							errors: 1,
						},
						// Array literal without keys
						{
							code: `
								const elements = [<div />, <span />];
							`,
							languageOptions: {
								parser,
								parserOptions: {
									ecmaFeatures: { jsx: true },
								},
							},
							errors: 2,
						},
						// Expression container siblings without key
						{
							code: `
								function Bad9() {
									return (
										<div>
											{<span />}
											<p />
										</div>
									);
								}
							`,
							languageOptions: {
								parser,
								parserOptions: {
									ecmaFeatures: { jsx: true },
								},
							},
							errors: 2,
						},
				],
			});
		}).not.toThrow();
	});
});
