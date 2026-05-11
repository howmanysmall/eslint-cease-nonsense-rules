import { describe } from "vitest";
import rule from "@rules/no-underscore-react-properties";
import parser from "@typescript-eslint/parser";
import { RuleTester } from "@typescript-eslint/rule-tester";

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

describe("no-underscore-react-properties", () => {
	ruleTester.run("no-underscore-react-properties", rule, {
		invalid: [
			{
				code: `
<InventoryItemTooltip
    key="inventory-tooltip"
    _tooltipGradient={tooltipGradient}
/>;
`,
				errors: [{ data: { propName: "_tooltipGradient" }, messageId: "noUnderscoreReactProperty" }],
			},
			{
				code: `
function Component() {
    return <Widget _private mode="enabled" _version={1} />;
}
`,
				errors: [
					{ data: { propName: "_private" }, messageId: "noUnderscoreReactProperty" },
					{ data: { propName: "_version" }, messageId: "noUnderscoreReactProperty" },
				],
			},
			{
				code: `
const view = <panel _ />;
`,
				errors: [{ data: { propName: "_" }, messageId: "noUnderscoreReactProperty" }],
			},
		],
		valid: [
			{
				code: `
<InventoryItemTooltip
    key="inventory-tooltip"
    tooltipGradient={tooltipGradient}
/>;
`,
			},
			{
				code: `
function Component() {
    return <Widget tooltipGradient={tooltipGradient} />;
}
`,
			},
			{
				code: `
const view = <Widget {...props} />;
`,
			},
			{
				code: `
const view = <Widget tooltip_gradient={gradient} />;
`,
			},
			{
				code: `
const _tooltipGradient = "gradient";
const view = <Widget tooltipGradient={_tooltipGradient} />;
`,
			},
			{
				code: `
const view = <Widget xml:lang="en" />;
`,
			},
		],
	});
});
