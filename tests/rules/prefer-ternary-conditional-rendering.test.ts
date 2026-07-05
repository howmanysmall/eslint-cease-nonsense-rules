import { describe } from "vitest";
import rule from "$rules/prefer-ternary-conditional-rendering";
import parser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser,
		parserOptions: {
			ecmaFeatures: {
				jsx: true,
			},
		},
		sourceType: "module",
	},
});

describe("prefer-ternary-conditional-rendering", () => {
	// @ts-expect-error - This is dumb
	ruleTester.run("prefer-ternary-conditional-rendering", rule, {
		invalid: [
			{
				code: `
function Component({ gradient, gradientToUse, rarityStyle }) {
    return <>{gradient !== undefined && <uigradient key="ui-gradient" Color={gradient} />}{gradient === undefined && <AnimatedGradient key="animated-gradient" colorValue={gradientToUse} rotation={45} sweepingSpeed={rarityStyle?.sweepingSpeed ?? 0} />}</>;
}
`,
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
				output: `
function Component({ gradient, gradientToUse, rarityStyle }) {
    return <>{gradient !== undefined ? <uigradient key="ui-gradient" Color={gradient} /> : <AnimatedGradient key="animated-gradient" colorValue={gradientToUse} rotation={45} sweepingSpeed={rarityStyle?.sweepingSpeed ?? 0} />}</>;
}
`,
			},
			{
				code: "function Component({ flag }) { return <>{flag && <A />}{!flag && <B />}</>; }",
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
				output: "function Component({ flag }) { return <>{flag ? <A /> : <B />}</>; }",
			},
			{
				code: 'function Component({ mode }) { return <>{mode === "x" && <A />}{mode !== "x" && <B />}</>; }',
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
				output: 'function Component({ mode }) { return <>{mode === "x" ? <A /> : <B />}</>; }',
			},
			{
				code: 'function Component({ mode }) { return <>{mode === "x" && <A />}{"x" !== mode && <B />}</>; }',
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
				output: 'function Component({ mode }) { return <>{mode === "x" ? <A /> : <B />}</>; }',
			},
			{
				code: "function Component() { return <>{isReady() && <A />}{!isReady() && <B />}</>; }",
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
				output: null,
			},
			{
				code: "function Component({ mode }) { return <>{mode === getMode() && <A />}{mode !== getMode() && <B />}</>; }",
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
				output: null,
			},
			{
				code: "function Component({ state }) { return <>{state.value === 1 && <A />}{state.value !== 1 && <B />}</>; }",
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
				output: null,
			},
			{
				code: "function Component({ flag }) { return <>{(flag as boolean) && <A />}{!(flag as boolean) && <B />}</>; }",
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
				output: "function Component({ flag }) { return <>{flag as boolean ? <A /> : <B />}</>; }",
			},
			{
				code: "function Component({ flag }) { return <>{(flag satisfies boolean) && <A />}{!(flag satisfies boolean) && <B />}</>; }",
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
				output: "function Component({ flag }) { return <>{flag satisfies boolean ? <A /> : <B />}</>; }",
			},
			{
				code: "function Component({ flag }) { return <>{identity<boolean>(flag) && <A />}{!identity<boolean>(flag) && <B />}</>; }",
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
				output: null,
			},
			{
				code: "function Component({ args }) { return <>{fn(...args) && <A />}{!fn(...args) && <B />}</>; }",
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
				output: null,
			},
			{
				code: 'function Component({ obj }) { return <>{obj["key"] && <A />}{!obj["key"] && <B />}</>; }',
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
				output: null,
			},
			{
				code: "function Component({ x }) { return <>{-x && <A />}{!-x && <B />}</>; }",
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
				output: null,
			},
			{
				code: "function Component({ x }) { return <>{x + 1 && <A />}{!(x + 1) && <B />}</>; }",
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
				output: null,
			},
			{
				code: "function Component({ a, b }) { return <>{(a && b) && <A />}{!(a && b) && <B />}</>; }",
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
				output: null,
			},
			{
				code: "function Component() { return <>{tag`ready` && <A />}{!tag`ready` && <B />}</>; }",
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
				output: null,
			},
			{
				code: "class Component extends Base { render() { return <>{super.ready && <A />}{!super.ready && <B />}</>; } }",
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
				output: null,
			},
			{
				code: "class Component extends React.Component { #ready = true; render() { return <>{this.#ready && <A />}{!this.#ready && <B />}</>; } }",
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
				output: null,
			},
			{
				code: "class Component extends React.Component { render() { return <>{this.state && <A />}{!this.state && <B />}</>; } }",
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
				output: null,
			},
			{
				code: `
function Component({ flag }) {
    return (
        <>
            {flag && <A />}
            {!flag && <B />}
        </>
    );
}
`,
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
				output: `
function Component({ flag }) {
    return (
        <>
            {flag ? <A /> : <B />}
        </>
    );
}
`,
			},
		],
		valid: [
			"function Component({ flag }) { return <>{flag ? <A /> : <B />}</>; }",
			"function Component({ first, second }) { return <>{first && <A />}{second && <B />}</>; }",
			"function Component({ flag }) { return <>{flag && doThing()}{!flag && <B />}</>; }",
			"function Component({ flag }) { return <>{flag && <A />}</>; }",
			'function Component({ mode }) { return <>{mode === "x" && <A />}text{mode !== "x" && <B />}</>; }',
			"function Component({ flag }) { return <>{flag && <A />}<Spacer />{!flag && <B />}</>; }",
			"function Component() { return <>{fn(1) && <A />}{!fn(1, 2) && <B />}</>; }",
		],
	});
});
