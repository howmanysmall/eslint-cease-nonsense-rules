import { describe } from "bun:test";
import { RuleTester } from "eslint";
import rule from "../../src/rules/prefer-ternary-conditional-rendering";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parserOptions: {
			ecmaFeatures: {
				jsx: true,
			},
		},
		sourceType: "module",
	},
});

describe("prefer-ternary-conditional-rendering", () => {
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
				// oxlint-disable-next-line no-null -- RuleTester requires null for no-fix invalid cases
				output: null,
			},
			{
				code: "function Component({ mode }) { return <>{mode === getMode() && <A />}{mode !== getMode() && <B />}</>; }",
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
				// oxlint-disable-next-line no-null -- RuleTester requires null for no-fix invalid cases
				output: null,
			},
			{
				code: "function Component({ state }) { return <>{state.value === 1 && <A />}{state.value !== 1 && <B />}</>; }",
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
				// oxlint-disable-next-line no-null -- RuleTester requires null for no-fix invalid cases
				output: null,
			},
		],
		valid: [
			"function Component({ flag }) { return <>{flag ? <A /> : <B />}</>; }",
			"function Component({ first, second }) { return <>{first && <A />}{second && <B />}</>; }",
			"function Component({ flag }) { return <>{flag && doThing()}{!flag && <B />}</>; }",
			"function Component({ flag }) { return <>{flag && <A />}</>; }",
			'function Component({ mode }) { return <>{mode === "x" && <A />}text{mode !== "x" && <B />}</>; }',
			"function Component({ flag }) { return <>{flag && <A />}<Spacer />{!flag && <B />}</>; }",
		],
	});
});
