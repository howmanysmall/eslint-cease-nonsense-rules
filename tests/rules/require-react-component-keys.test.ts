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
				],
			});
		}).not.toThrow();
	});
});
