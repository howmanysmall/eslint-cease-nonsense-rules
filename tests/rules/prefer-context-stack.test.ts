import path from "node:path";
import { describe } from "vitest";
import rule from "$rules/prefer-context-stack";
import tsParser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";

const FIXTURES = path.join(import.meta.dirname, "..", "fixtures", "prefer-context-stack");
const WITH_CONTEXT_STACK = path.join(FIXTURES, "with-context-stack");
const WITHOUT_CONTEXT_STACK = path.join(FIXTURES, "without-context-stack");
const FIXTURE_ONLY_CONTEXT_STACK = path.join(FIXTURES, "fixture-only");

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
				filename: path.join(WITH_CONTEXT_STACK, "src", "screens", "basic.tsx"),
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
				filename: path.join(WITH_CONTEXT_STACK, "src", "screens", "report-only.tsx"),
			},
			{
				code: `import { ContextStack } from "../providers/context-stack";

export function Example(locale: string, theme: string) {
    return <ThemeContext.Provider value={theme}><LocaleContext.Provider value={locale}><App /></LocaleContext.Provider></ThemeContext.Provider>;
}`,
				errors: [{ messageId: "preferContextStack" }],
				filename: path.join(WITH_CONTEXT_STACK, "src", "screens", "named-import.tsx"),
				output: `import { ContextStack } from "../providers/context-stack";

export function Example(locale: string, theme: string) {
    return <ContextStack providers={[<ThemeContext.Provider value={theme} />, <LocaleContext.Provider value={locale} />]}><App /></ContextStack>;
}`,
			},
			{
				code: `import { "ContextStack" as Providers } from "../providers/context-stack";

export function Example(locale: string, theme: string) {
    return <ThemeContext.Provider value={theme}><LocaleContext.Provider value={locale}><App /></LocaleContext.Provider></ThemeContext.Provider>;
}`,
				errors: [{ messageId: "preferContextStack" }],
				filename: path.join(WITH_CONTEXT_STACK, "src", "screens", "string-literal-import.tsx"),
				output: `import { "ContextStack" as Providers } from "../providers/context-stack";

export function Example(locale: string, theme: string) {
    return <Providers providers={[<ThemeContext.Provider value={theme} />, <LocaleContext.Provider value={locale} />]}><App /></Providers>;
}`,
			},
			{
				code: `import ContextStack from "../providers/context-stack";

export function Example(locale: string, theme: string) {
    return <ThemeContext.Provider value={theme}>{/* keep */}<LocaleContext.Provider value={locale}><App /></LocaleContext.Provider></ThemeContext.Provider>;
}`,
				errors: [{ messageId: "preferContextStack" }],
				filename: path.join(WITH_CONTEXT_STACK, "src", "screens", "comment.tsx"),
			},
			{
				code: `import ContextStack from "../providers/context-stack";

export function Example(locale: string, theme: string) {
    return (
        <ThemeContext.Provider value={theme}>
            <LocaleContext.Provider value={locale}>
                <App />
            </LocaleContext.Provider>
        </ThemeContext.Provider>
    );
}`,
				errors: [{ messageId: "preferContextStack" }],
				filename: path.join(WITH_CONTEXT_STACK, "src", "screens", "multiline.tsx"),
				output: `import ContextStack from "../providers/context-stack";

export function Example(locale: string, theme: string) {
    return (
        <ContextStack providers={[<ThemeContext.Provider value={theme} />, <LocaleContext.Provider value={locale} />]}>
                <App />
            </ContextStack>
    );
}`,
			},
			{
				code: `import ContextStack from "../providers/context-stack";

export function Example(locale: string, theme: string) {
    return <ThemeContext.Provider value={theme}><LocaleContext.Provider value={locale} /></ThemeContext.Provider>;
}`,
				errors: [{ messageId: "preferContextStack" }],
				filename: path.join(WITH_CONTEXT_STACK, "src", "screens", "self-closing-inner.tsx"),
				output: null,
			},
			{
				code: `import * as Providers from "../providers/context-stack";

export function Example(locale: string, theme: string) {
    return <ThemeContext.Provider value={theme}><LocaleContext.Provider value={locale}><App /></LocaleContext.Provider></ThemeContext.Provider>;
}`,
				errors: [{ messageId: "preferContextStack" }],
				filename: path.join(WITH_CONTEXT_STACK, "src", "screens", "namespace-import.tsx"),
				output: null,
			},
			{
				code: `import ContextStack from "../providers/context-stack";
import { ContextStack as ProviderStack } from "../providers/context-stack";

export function Example(locale: string, theme: string) {
    return <ThemeContext.Provider value={theme}><LocaleContext.Provider value={locale}><App /></LocaleContext.Provider></ThemeContext.Provider>;
}`,
				errors: [{ messageId: "preferContextStack" }],
				filename: path.join(WITH_CONTEXT_STACK, "src", "screens", "multiple-imports.tsx"),
			},
			{
				code: `import ContextStack from "../providers/context-stack";

export function Example(locale: string, theme: string) {
    return <ThemeContext.Provider value={theme}><LocaleContext.Provider value={locale}><App /></LocaleContext.Provider></ThemeContext.Provider>;
}`,
				errors: [{ messageId: "preferContextStack" }],
				filename: path.join(WITH_CONTEXT_STACK, "src", "screens", "non-jsx-extension.js"),
			},
		],
		valid: [
			{
				code: `import Placeholder from "./placeholder";

export function Example() {
    return <Placeholder />;
}`,
				filename: path.join(WITH_CONTEXT_STACK, "src", "screens", "resolved-non-component-import.tsx"),
			},
			{
				code: `import ContextStack from "context-stack";

export function Example(locale: string, theme: string) {
    return <ThemeContext.Provider value={theme}><LocaleContext.Provider value={locale}><App /></LocaleContext.Provider></ThemeContext.Provider>;
}`,
			},
			{
				code: `import ContextStack from "../providers/context-stack";

export function Example(theme: string) {
    return <ThemeContext.Provider value={theme}><App /></ThemeContext.Provider>;
}`,
				filename: path.join(WITH_CONTEXT_STACK, "src", "screens", "single.tsx"),
			},
			{
				code: `import ContextStack from "../providers/context-stack";

export function Example(locale: string, theme: string) {
    return <ThemeContext.Provider value={theme}><Toolbar /><LocaleContext.Provider value={locale}><App /></LocaleContext.Provider></ThemeContext.Provider>;
}`,
				filename: path.join(WITH_CONTEXT_STACK, "src", "screens", "not-direct.tsx"),
			},
			{
				code: `export function Example(locale: string, theme: string) {
    return <ThemeContext.Provider value={theme}><LocaleContext.Provider value={locale}><App /></LocaleContext.Provider></ThemeContext.Provider>;
}`,
				filename: path.join(WITHOUT_CONTEXT_STACK, "src", "screens", "missing.tsx"),
			},
			{
				code: `export function Example(locale: string, theme: string) {
    return <ThemeContext.Provider value={theme}><LocaleContext.Provider value={locale}><App /></LocaleContext.Provider></ThemeContext.Provider>;
}`,
				filename: path.join(FIXTURE_ONLY_CONTEXT_STACK, "src", "screens", "fixture.tsx"),
			},
			{
				code: `import ContextStack from "../providers/context-stack";

export function Example(theme: string) {
    return <ThemeContext.Provider value={theme}>text</ThemeContext.Provider>;
}`,
				filename: path.join(WITH_CONTEXT_STACK, "src", "screens", "text-child.tsx"),
			},
			{
				code: `import ContextStack from "../providers/context-stack";

export function Example(children: React.ReactNode, theme: string) {
    return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}`,
				filename: path.join(WITH_CONTEXT_STACK, "src", "screens", "expression-child.tsx"),
			},
			{
				code: `import { createContext } from "@rbxts/react";
import ContextStack from "../providers/missing-context-stack";
import { NotContextStack } from "../providers/context-stack";

export function Example(locale: string, theme: string) {
    return <ThemeContext.Provider value={theme}><LocaleContext.Provider value={locale}><App /></LocaleContext.Provider></ThemeContext.Provider>;
}`,
				filename: path.join(WITHOUT_CONTEXT_STACK, "src", "screens", "ignored-imports.tsx"),
			},
		],
	});
});
