import { describe } from "bun:test";
import parser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import rule from "../../src/rules/no-god-components";

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

describe("no-god-components", () => {
	// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
	// and this test file intentionally passes the rule as-is for runtime validation.
	ruleTester.run("no-god-components", rule, {
			valid: [
				{
					code: `
function Small({ a, b }) {
    const [count, setCount] = useState(0);
    if (count > 0) setCount(count - 1);
    return <div><span>{a}{b}</span></div>;
}
`,
					languageOptions: {
						parser,
						parserOptions: {
							ecmaFeatures: { jsx: true },
						},
					},
				},
				{
					code: `
function TypeNull() {
    type N = null;
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
				{
					code: `
function Ignored() {
    const value = null;
    return <div>{value}</div>;
}
`,
					options: [
						{
							ignoreComponents: ["Ignored"],
							maxLines: 1000,
							targetLines: 1000,
							enforceTargetLines: false,
							maxStateHooks: 1000,
							maxTsxNesting: 1000,
							maxDestructuredProps: 1000,
						},
					],
					languageOptions: {
						parser,
						parserOptions: {
							ecmaFeatures: { jsx: true },
						},
					},
				},
				{
					code: `
function helper() {
    const value = null;
    return value;
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
			{
				code: `
function Big() {
    const a = 1;
    const b = 2;
    const c = 3;
    return <div />;
}
`,
				options: [{ maxLines: 5, targetLines: 5, enforceTargetLines: false }],
				errors: [{ messageId: "exceedsMaxLines" }],
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			{
				code: `
function OverTarget() {
    const a = 1;
    const b = 2;
    return <div />;
}
`,
				options: [{ targetLines: 3, maxLines: 10, enforceTargetLines: true }],
				errors: [{ messageId: "exceedsTargetLines" }],
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			{
				code: `
function Deep() {
    return (
        <div>
            <span>
                <b />
            </span>
        </div>
    );
}
`,
				options: [
					{
						maxTsxNesting: 2,
						maxLines: 1000,
						targetLines: 1000,
						enforceTargetLines: false,
						maxStateHooks: 1000,
					},
				],
				errors: [{ messageId: "tsxNestingTooDeep" }],
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			{
				code: `
function Statey() {
    const [a, setA] = useState(0);
    const [b, setB] = useState(0);
    return <div />;
}
`,
				options: [
					{
						maxStateHooks: 1,
						stateHooks: ["useState"],
						maxLines: 1000,
						targetLines: 1000,
						enforceTargetLines: false,
					},
				],
				errors: [{ messageId: "tooManyStateHooks" }],
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			{
				code: `
function Propsy({ a, b, c }) {
    return <div />;
}
`,
				options: [
					{
						maxDestructuredProps: 2,
						maxLines: 1000,
						targetLines: 1000,
						enforceTargetLines: false,
					},
				],
				errors: [{ messageId: "tooManyProps" }],
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
				{
					code: `
function Nullish() {
    const value = null;
    return <div>{value}</div>;
}
`,
				options: [
					{
						maxLines: 1000,
						targetLines: 1000,
						enforceTargetLines: false,
						maxStateHooks: 1000,
						maxTsxNesting: 1000,
					},
				],
				errors: [{ messageId: "nullLiteral" }],
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
					},
				},
				{
					code: `
const MemberState = () => {
    const [a, setA] = React.useState(0);
    const [b, setB] = React.useState(0);
    return <div />;
};
`,
					options: [
						{
							maxStateHooks: 1,
							stateHooks: ["useState"],
							maxLines: 1000,
							targetLines: 1000,
							enforceTargetLines: false,
							maxTsxNesting: 1000,
							maxDestructuredProps: 1000,
						},
					],
					errors: [{ messageId: "tooManyStateHooks" }],
					languageOptions: {
						parser,
						parserOptions: {
							ecmaFeatures: { jsx: true },
						},
					},
				},
				{
					code: `
const BadMemo = memo(() => {
    const [a, setA] = useState(0);
    const [b, setB] = useState(0);
    return <div />;
});
`,
					options: [
						{
							maxStateHooks: 1,
							stateHooks: ["useState"],
							maxLines: 1000,
							targetLines: 1000,
							enforceTargetLines: false,
							maxTsxNesting: 1000,
							maxDestructuredProps: 1000,
						},
					],
					errors: [{ messageId: "tooManyStateHooks" }],
					languageOptions: {
						parser,
						parserOptions: {
							ecmaFeatures: { jsx: true },
						},
					},
				},
				{
					code: `
const ReactBad = React.memo(function ReactBad() {
    const value = null;
    return <div>{value}</div>;
});
`,
					options: [
						{
							maxLines: 1000,
							targetLines: 1000,
							enforceTargetLines: false,
							maxStateHooks: 1000,
							maxTsxNesting: 1000,
							maxDestructuredProps: 1000,
						},
					],
					errors: [{ messageId: "nullLiteral" }],
					languageOptions: {
						parser,
						parserOptions: {
							ecmaFeatures: { jsx: true },
						},
					},
				},
				{
					code: `
export default memo(function DefaultBad() {
    const a = 1;
    const b = 2;
    const c = 3;
    return <div />;
});
`,
					options: [{ maxLines: 3, targetLines: 3, enforceTargetLines: false }],
					errors: [{ messageId: "exceedsMaxLines" }],
					languageOptions: {
						parser,
						parserOptions: {
							ecmaFeatures: { jsx: true },
						},
					},
				},
				{
					code: `
const Components = {
    BigProp: function () {
        const value = null;
        return <div>{value}</div>;
    },
};
`,
					options: [
						{
							maxLines: 1000,
							targetLines: 1000,
							enforceTargetLines: false,
							maxStateHooks: 1000,
							maxTsxNesting: 1000,
							maxDestructuredProps: 1000,
						},
					],
					errors: [{ messageId: "nullLiteral" }],
					languageOptions: {
						parser,
						parserOptions: {
							ecmaFeatures: { jsx: true },
						},
					},
				},
				{
					code: `
class View {
    BigClassMethod() {
        const value = null;
        return <div>{value}</div>;
    }
}
`,
					options: [
						{
							maxLines: 1000,
							targetLines: 1000,
							enforceTargetLines: false,
							maxStateHooks: 1000,
							maxTsxNesting: 1000,
							maxDestructuredProps: 1000,
						},
					],
					errors: [{ messageId: "nullLiteral" }],
					languageOptions: {
						parser,
						parserOptions: {
							ecmaFeatures: { jsx: true },
						},
					},
				},
				{
					code: `
let Assigned;
Assigned = memo(function Assigned() {
    const a = 1;
    const b = 2;
    const c = 3;
    return <div />;
});
`,
					options: [{ maxLines: 3, targetLines: 3, enforceTargetLines: false }],
					errors: [{ messageId: "exceedsMaxLines" }],
					languageOptions: {
						parser,
						parserOptions: {
							ecmaFeatures: { jsx: true },
						},
					},
				},
			],
		});
	});
