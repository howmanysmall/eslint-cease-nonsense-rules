import parser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import exhaustiveRule from "./src/rules/use-exhaustive-dependencies";
import hookRule from "./src/rules/use-hook-at-top-level";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser,
		parserOptions: { ecmaFeatures: { jsx: true } },
		sourceType: "module",
	},
});

// MetaProperty tests (import.meta, new.target)
ruleTester.run("metaproperty-tests", hookRule, {
	invalid: [
		// Hook inside conditional with import.meta check
		{
			code: `
function Component() {
    if (import.meta.env.DEV) {
        useState(0);
    }
}
`,
			errors: [{ messageId: "conditionalHook" }],
		},
	],
	valid: [
		// Import.meta usage at top level is fine
		`
function Component() {
    const isDev = import.meta.env.DEV;
    useState(0);
}
`,
		// New.target in constructor (not a component)
		`
function MyConstructor() {
    if (new.target === undefined) {
        throw new Error("Must use new");
    }
}
`,
	],
});

console.log("MetaProperty tests passed!");

// ChainExpression (optional chaining) tests
ruleTester.run("chain-expression-tests", exhaustiveRule, {
	invalid: [
		// Optional chaining should still be tracked as dependency
		{
			code: `
function Component() {
    const obj = { value: 1 };
    useEffect(() => {
        console.log(obj?.value);
    }, []);
}
`,
			errors: [{ messageId: "missingDependency" }],
		},
		// Deep optional chaining
		{
			code: `
function Component() {
    const obj = { a: { b: { c: 1 } } };
    useEffect(() => {
        console.log(obj?.a?.b?.c);
    }, []);
}
`,
			errors: [{ messageId: "missingDependency" }],
		},
		// Optional method call
		{
			code: `
function Component() {
    const obj = { method: () => 1 };
    useEffect(() => {
        obj?.method?.();
    }, []);
}
`,
			errors: [{ messageId: "missingDependency" }],
		},
	],
	valid: [
		// Optional chaining with proper dependency
		`
function Component() {
    const obj = { value: 1 };
    useEffect(() => {
        console.log(obj?.value);
    }, [obj]);
}
`,
	],
});

console.log("ChainExpression tests passed!");
