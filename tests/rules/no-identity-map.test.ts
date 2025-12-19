import { describe } from "bun:test";
import tsParser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import rule from "../../src/rules/no-identity-map";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser: tsParser,
		sourceType: "module",
	},
});

describe("no-identity-map", () => {
	ruleTester.run("no-identity-map", rule, {
		invalid: [
			// ==========================================
			// Binding identity maps (identityBindingMap)
			// ==========================================

			// Variable name contains "binding"
			{
				code: `scaleBinding.map(v => v)`,
				errors: [{ messageId: "identityBindingMap" }],
				output: `scaleBinding`,
			},
			{
				code: `const result = shadowTransparencyBinding.map((trans: number) => trans);`,
				errors: [{ messageId: "identityBindingMap" }],
				output: `const result = shadowTransparencyBinding;`,
			},
			{
				code: `myBinding.map(v => { return v; })`,
				errors: [{ messageId: "identityBindingMap" }],
				output: `myBinding`,
			},

			// From useBinding hook
			{
				code: `
const [binding] = useBinding(0);
binding.map(v => v);
`,
				errors: [{ messageId: "identityBindingMap" }],
				output: `
const [binding] = useBinding(0);
binding;
`,
			},
			// From React.useBinding (member expression hook call)
			{
				code: `
const [b] = React.useBinding(0);
b.map(v => v);
`,
				errors: [{ messageId: "identityBindingMap" }],
				output: `
const [b] = React.useBinding(0);
b;
`,
			},
			// Variable initialized from .map() result
			{
				code: `
const mapped = source.map(x => x + 1);
mapped.map(v => v);
`,
				errors: [{ messageId: "identityBindingMap" }],
				output: `
const mapped = source.map(x => x + 1);
mapped;
`,
			},

			// From React.joinBindings
			{
				code: `React.joinBindings({ a, b }).map(v => v)`,
				errors: [{ messageId: "identityBindingMap" }],
				output: `React.joinBindings({ a, b })`,
			},
			{
				code: `joinBindings({ a }).map(x => x)`,
				errors: [{ messageId: "identityBindingMap" }],
				output: `joinBindings({ a })`,
			},

			// Chained .map() calls
			{
				code: `binding.map(x => x + 1).map(y => y)`,
				errors: [{ messageId: "identityBindingMap" }],
				output: `binding.map(x => x + 1)`,
			},

			// ==========================================
			// Array identity maps (identityArrayMap)
			// ==========================================

			// Simple arrow expression
			{
				code: `items.map(v => v)`,
				errors: [{ messageId: "identityArrayMap" }],
				output: `items`,
			},
			{
				code: `array.map((v) => v)`,
				errors: [{ messageId: "identityArrayMap" }],
				output: `array`,
			},

			// With type annotation
			{
				code: `data.map((v: number) => v)`,
				errors: [{ messageId: "identityArrayMap" }],
				output: `data`,
			},
			{
				code: `items.map((item: Readonly<T>) => item)`,
				errors: [{ messageId: "identityArrayMap" }],
				output: `items`,
			},

			// Block body
			{
				code: `list.map(v => { return v; })`,
				errors: [{ messageId: "identityArrayMap" }],
				output: `list`,
			},
			{
				code: `arr.map((x: string) => { return x; })`,
				errors: [{ messageId: "identityArrayMap" }],
				output: `arr`,
			},

			// Function expression
			{
				code: `data.map(function(v) { return v; })`,
				errors: [{ messageId: "identityArrayMap" }],
				output: `data`,
			},
			{
				code: `items.map(function foo(v) { return v; })`,
				errors: [{ messageId: "identityArrayMap" }],
				output: `items`,
			},

			// Default parameter (still identity if returns the param)
			{
				code: `arr.map((x = 0) => x)`,
				errors: [{ messageId: "identityArrayMap" }],
				output: `arr`,
			},

			// Variable from joinBindings stored in variable
			{
				code: `
const joined = joinBindings({ a, b });
joined.map(v => v);
`,
				errors: [{ messageId: "identityBindingMap" }],
				output: `
const joined = joinBindings({ a, b });
joined;
`,
			},

			// In JSX context (from user examples)
			{
				code: `
<frame
	BackgroundTransparency={shadowTransparency.map((trans: number) => {
		return trans;
	})}
/>
`,
				errors: [{ messageId: "identityArrayMap" }],
				languageOptions: {
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
				output: `
<frame
	BackgroundTransparency={shadowTransparency}
/>
`,
			},
			{
				code: `
<component
	gap={glowWidthBinding.map((value: number) => {
		return value;
	})}
/>
`,
				errors: [{ messageId: "identityBindingMap" }],
				languageOptions: {
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
				output: `
<component
	gap={glowWidthBinding}
/>
`,
			},
		],
		valid: [
			// ==========================================
			// Actual transformations (not identity)
			// ==========================================

			// Arithmetic operations
			`binding.map(v => v + 1)`,
			`binding.map(v => v * 2)`,
			`array.map(x => x - 1)`,

			// Method calls
			`binding.map(v => v.toString())`,
			`items.map(item => item.toUpperCase())`,

			// Property access
			`binding.map(v => v.x)`,
			`items.map(item => item.name)`,

			// Object creation
			`items.map(v => ({ ...v }))`,
			`binding.map(v => ({ value: v }))`,

			// Array creation
			`binding.map(v => [v])`,

			// Function calls
			`binding.map(v => String(v))`,
			`items.map(v => transform(v))`,

			// ==========================================
			// Not identity functions
			// ==========================================

			// Multiple parameters (even if only first is used)
			`binding.map((v, i) => v)`,
			`array.map((item, index) => item)`,
			`array.map(function(v, i) { return v; })`,

			// Destructuring
			`binding.map(({ x }) => x)`,
			`items.map(([first]) => first)`,
			`array.map(function({ x }) { return x; })`,

			// Rest parameter
			`array.map((...args) => args[0])`,

			// Block body with side effects
			`binding.map(v => { console.log(v); return v; })`,
			`items.map(v => { doSomething(); return v; })`,

			// Block body with multiple statements
			`binding.map(v => { const x = v; return x; })`,

			// No return statement
			`items.map(v => { v; })`,

			// Empty block
			`array.map(v => {})`,

			// ==========================================
			// Not .map() calls
			// ==========================================

			// Different method names
			`binding.filter(v => v)`,
			`binding.forEach(v => v)`,
			`binding.find(v => v)`,
			`binding.reduce(v => v)`,

			// Standalone function named map
			`map(v => v)`,

			// Computed property (dynamic method name)
			`binding["map"](v => v)`,

			// ==========================================
			// Other valid patterns
			// ==========================================

			// No arguments
			`array.map()`,

			// Multiple arguments
			`array.map(v => v, thisArg)`,

			// Spread argument
			`array.map(...callbacks)`,
		],
	});
});
