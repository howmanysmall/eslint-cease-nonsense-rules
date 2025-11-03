import { describe } from "bun:test";
import parser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import rule from "../../src/rules/require-named-effect-functions";

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

describe("require-named-effect-functions", () => {
	ruleTester.run("require-named-effect-functions", rule, {
		invalid: [
			// Arrow functions
			{
				code: `
					useEffect(() => {
						console.log("effect");
					}, []);
				`,
				errors: [{ messageId: "arrowFunction" }],
			},
			// Anonymous function expressions
			{
				code: `
					useEffect(function() {
						console.log("effect");
					}, []);
				`,
				errors: [{ messageId: "anonymousFunction" }],
			},
			// Arrow function with dependencies
			{
				code: `
					useEffect(() => {
						console.log(count);
					}, [count]);
				`,
				errors: [{ messageId: "arrowFunction" }],
			},
			// useLayoutEffect with arrow function
			{
				code: `
					useLayoutEffect(() => {
						console.log("layout effect");
					}, []);
				`,
				errors: [{ messageId: "arrowFunction" }],
			},
			// useInsertionEffect with arrow function
			{
				code: `
					useInsertionEffect(() => {
						console.log("insertion effect");
					}, []);
				`,
				errors: [{ messageId: "arrowFunction" }],
			},
			// Named function expression in roblox-ts mode (default)
			{
				code: `
					useEffect(function handleEffect() {
						console.log("effect");
					}, []);
				`,
				errors: [{ messageId: "functionExpression" }],
			},
			// Member expression hook with arrow function
			{
				code: `
					React.useEffect(() => {
						console.log("effect");
					}, []);
				`,
				errors: [{ messageId: "arrowFunction" }],
			},
			// Member expression hook with anonymous function (for line 29 coverage)
			{
				code: `
					React.useLayoutEffect(function() {
						console.log("layout effect");
					}, []);
				`,
				errors: [{ messageId: "anonymousFunction" }],
			},
			// Anonymous function with return
			{
				code: `
					useEffect(function() {
						return () => {
							console.log("cleanup");
						};
					}, []);
				`,
				errors: [{ messageId: "anonymousFunction" }],
			},
			// Arrow function assigned to variable is invalid (doesn't have a real name)
			{
				code: `
					const handleEffect = () => {
						console.log("effect");
					};
					useEffect(handleEffect, []);
				`,
				errors: [{ messageId: "identifierReferencesArrow" }],
			},
			// Arrow function assigned to const in more complex case
			{
				code: `
					const effect = () => {
						console.log("effect");
					};
					useEffect(effect, []);
				`,
				errors: [{ messageId: "identifierReferencesArrow" }],
			},
			// Named function expression via identifier in roblox-ts mode
			{
				code: `
					const effect = function handleEffect() {
						console.log("effect");
					};
					useEffect(effect, []);
				`,
				errors: [{ messageId: "functionExpression" }],
			},
			// Async arrow function inline
			{
				code: `
					useEffect(async () => {
						await fetchData();
					}, []);
				`,
				errors: [{ messageId: "asyncArrowFunction" }],
			},
			// Async named function expression inline
			{
				code: `
					useEffect(async function handleEffect() {
						await fetchData();
					}, []);
				`,
				errors: [{ messageId: "asyncFunctionExpression" }],
			},
			// Async anonymous function expression inline
			{
				code: `
					useEffect(async function() {
						await fetchData();
					}, []);
				`,
				errors: [{ messageId: "asyncAnonymousFunction" }],
			},
			// Async function declaration referenced via identifier
			{
				code: `
					async function handleEffect() {
						await fetchData();
					}
					useEffect(handleEffect, []);
				`,
				errors: [{ messageId: "identifierReferencesAsyncFunction" }],
			},
			// Async arrow via identifier (not allowed by default)
			{
				code: `
					const effect = async () => {
						await fetchData();
					};
					useEffect(effect, []);
				`,
				errors: [{ messageId: "identifierReferencesAsyncArrow" }],
			},
		],
		valid: [
			// Named function reference (function declaration)
			{
				code: `
					function handleEffect() {
						console.log("effect");
					}
					useEffect(handleEffect, []);
				`,
			},
			// Function declaration referenced with cleanup
			{
				code: `
					function myEffect() {
						console.log("effect");
						return () => console.log("cleanup");
					}
					useEffect(myEffect, []);
				`,
			},
			// useLayoutEffect with named function reference
			{
				code: `
					function layoutHandler() {
						console.log("layout");
					}
					useLayoutEffect(layoutHandler, []);
				`,
			},
			// useInsertionEffect with named function reference
			{
				code: `
					function insertionHandler() {
						console.log("insertion");
					}
					useInsertionEffect(insertionHandler, []);
				`,
			},
			// Member expression hook with named function
			{
				code: `
					function handleEffect() {
						console.log("effect");
					}
					React.useEffect(handleEffect, []);
				`,
			},
			// Without dependencies array
			{
				code: `
					function handleEffect() {
						console.log("effect");
					}
					useEffect(handleEffect);
				`,
			},
			// Non-effect hooks should not be checked
			{
				code: `
					useCallback(() => {
						console.log("callback");
					}, []);
				`,
			},
			// Regular function calls shouldn't be checked
			{
				code: `
					myFunction(() => {
						console.log("not a hook");
					});
				`,
			},
			// Named function expression in standard mode
			{
				code: `
					useEffect(function handleEffect() {
						console.log("effect");
					}, []);
				`,
				options: [{ environment: "standard" }],
			},
			// Named function expression via identifier in standard mode
			{
				code: `
					const effect = function handleEffect() {
						console.log("effect");
					};
					useEffect(effect, []);
				`,
				options: [{ environment: "standard" }],
			},
			// Imported function reference (can't resolve, assume valid)
			{
				code: `
					import { handleEffect } from './effects';
					useEffect(handleEffect, []);
				`,
			},
			// Async arrow via identifier with allowAsyncFunctionDeclarations enabled
			{
				code: `
					const effect = async () => {
						await fetchData();
					};
					useEffect(effect, []);
				`,
				options: [{ allowAsyncFunctionDeclarations: true }],
			},
			// Async function declaration with allowAsyncFunctionDeclarations enabled
			{
				code: `
					async function handleEffect() {
						await fetchData();
					}
					useEffect(handleEffect, []);
				`,
				options: [{ allowAsyncFunctionDeclarations: true }],
			},
			// Computed member access (getHookName returns undefined, rule doesn't check)
			{
				code: `
				const hooks = { useEffect };
				hooks['useEffect'](() => {
					console.log("effect");
				}, []);
			`,
			},
			// Outer scope function reference
			{
				code: `
				function makeComponent() {
					function handleEffect() {
						console.log("effect");
					}
					return useEffect(handleEffect, []);
				}
			`,
			},
		],
	});

	describe("configuration options", () => {
		const ruleTestStandard = new RuleTester({
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

		ruleTestStandard.run("require-named-effect-functions-standard-mode", rule, {
			invalid: [
				// Arrow functions should still fail in standard mode
				{
					code: `
						useEffect(() => {
							console.log("effect");
						}, []);
					`,
					errors: [{ messageId: "arrowFunction" }],
					options: [{ environment: "standard" }],
				},
				// Anonymous functions should still fail in standard mode
				{
					code: `
						useEffect(function() {
							console.log("effect");
						}, []);
					`,
					errors: [{ messageId: "anonymousFunction" }],
					options: [{ environment: "standard" }],
				},
			],
			valid: [
				// Named function expression is allowed in standard mode
				{
					code: `
						useEffect(function handleEffect() {
							console.log("effect");
						}, []);
					`,
					options: [{ environment: "standard" }],
				},
				// Named function reference still works
				{
					code: `
						function effect() {
							console.log("effect");
						}
						useEffect(effect, []);
					`,
					options: [{ environment: "standard" }],
				},
			],
		});

		const ruleTestCustomHooks = new RuleTester({
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

		ruleTestCustomHooks.run("require-named-effect-functions-custom-hooks", rule, {
			invalid: [
				// Custom hook with arrow function
				{
					code: `
						useCustomHook(() => {
							console.log("custom");
						}, []);
					`,
					errors: [{ messageId: "arrowFunction" }],
					options: [{ hooks: ["useCustomHook"] }],
				},
			],
			valid: [
				// Custom hook with named function
				{
					code: `
						function handleCustom() {
							console.log("custom");
						}
						useCustomHook(handleCustom, []);
					`,
					options: [{ hooks: ["useCustomHook"] }],
				},
				// Default hooks should not be checked when custom hooks are specified
				{
					code: `
						useEffect(() => {
							console.log("effect");
						}, []);
					`,
					options: [{ hooks: ["useCustomHook"] }],
				},
			],
		});
	});
});
