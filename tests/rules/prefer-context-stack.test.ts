import { describe } from "bun:test";
import { join } from "node:path";
import tsParser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";

import rule from "../../src/rules/prefer-context-stack";

const FIXTURES = join(import.meta.dir, "..", "fixtures", "prefer-context-stack");
const WITH_CONTEXT_STACK = join(FIXTURES, "with-context-stack");
const WITHOUT_CONTEXT_STACK = join(FIXTURES, "without-context-stack");
const FIXTURE_ONLY_CONTEXT_STACK = join(FIXTURES, "fixture-only");

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser: tsParser,
		parserOptions: {
			ecmaFeatures: { jsx: true },
		},
		sourceType: "module",
	},
});

describe("prefer-context-stack", () => {
	// @ts-expect-error RuleTester types incompatible with runtime rule shape
	ruleTester.run("prefer-context-stack", rule, {
		invalid: [
			{
				code: `import ContextStack from "../providers/context-stack";

export function Example(locale: string, theme: string) {
	return <ThemeContext.Provider value={theme}><LocaleContext.Provider value={locale}><App /></LocaleContext.Provider></ThemeContext.Provider>;
}`,
				errors: [{ messageId: "preferContextStack" }],
				filename: join(WITH_CONTEXT_STACK, "src", "screens", "basic.tsx"),
				output: `import ContextStack from "../providers/context-stack";

export function Example(locale: string, theme: string) {
	return <ContextStack providers={[<ThemeContext.Provider value={theme} />, <LocaleContext.Provider value={locale} />]}><App /></ContextStack>;
}`,
			},
			{
				code: `export function Example(locale: string, theme: string) {
	return <ThemeContext.Provider value={theme}><LocaleContext.Provider value={locale}><App /></LocaleContext.Provider></ThemeContext.Provider>;
}`,
				errors: [{ messageId: "preferContextStack" }],
				filename: join(WITH_CONTEXT_STACK, "src", "screens", "report-only.tsx"),
			},
			{
				code: `import ContextStack from "../providers/context-stack";

export function Example(locale: string, theme: string) {
	return <ThemeContext.Provider value={theme}>{/* keep */}<LocaleContext.Provider value={locale}><App /></LocaleContext.Provider></ThemeContext.Provider>;
}`,
				errors: [{ messageId: "preferContextStack" }],
				filename: join(WITH_CONTEXT_STACK, "src", "screens", "comment.tsx"),
			},
		],
		valid: [
			{
				code: `import ContextStack from "../providers/context-stack";

export function Example(theme: string) {
	return <ThemeContext.Provider value={theme}><App /></ThemeContext.Provider>;
}`,
				filename: join(WITH_CONTEXT_STACK, "src", "screens", "single.tsx"),
			},
			{
				code: `import ContextStack from "../providers/context-stack";

export function Example(locale: string, theme: string) {
	return <ThemeContext.Provider value={theme}><Toolbar /><LocaleContext.Provider value={locale}><App /></LocaleContext.Provider></ThemeContext.Provider>;
}`,
				filename: join(WITH_CONTEXT_STACK, "src", "screens", "not-direct.tsx"),
			},
			{
				code: `export function Example(locale: string, theme: string) {
	return <ThemeContext.Provider value={theme}><LocaleContext.Provider value={locale}><App /></LocaleContext.Provider></ThemeContext.Provider>;
}`,
				filename: join(WITHOUT_CONTEXT_STACK, "src", "screens", "missing.tsx"),
			},
			{
				code: `export function Example(locale: string, theme: string) {
	return <ThemeContext.Provider value={theme}><LocaleContext.Provider value={locale}><App /></LocaleContext.Provider></ThemeContext.Provider>;
}`,
				filename: join(FIXTURE_ONLY_CONTEXT_STACK, "src", "screens", "fixture.tsx"),
			},
		],
	});
});
