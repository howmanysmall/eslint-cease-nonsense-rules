import { describe } from "bun:test";
import parser from "@typescript-eslint/parser";
import { RuleTester } from "@typescript-eslint/rule-tester";
import rule from "../../src/rules/no-underscore-react-props";

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

describe("no-underscore-react-props", () => {
	ruleTester.run("no-underscore-react-props", rule, {
		invalid: [
			{
				code: `
<InventoryItemTooltip
	key="inventory-tooltip"
	_tooltipGradient={tooltipGradient}
/>;
`,
				errors: [{ data: { propName: "_tooltipGradient" }, messageId: "noUnderscoreReactProp" }],
			},
			{
				code: `
function Component() {
	return <Widget _private mode="enabled" _version={1} />;
}
`,
				errors: [
					{ data: { propName: "_private" }, messageId: "noUnderscoreReactProp" },
					{ data: { propName: "_version" }, messageId: "noUnderscoreReactProp" },
				],
			},
			{
				code: `
const view = <panel _ />;
`,
				errors: [{ data: { propName: "_" }, messageId: "noUnderscoreReactProp" }],
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
