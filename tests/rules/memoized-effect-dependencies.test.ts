import { describe } from "bun:test";
import parser from "@typescript-eslint/parser";
import { RuleTester } from "@typescript-eslint/rule-tester";
import rule from "../../src/rules/memoized-effect-dependencies";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser,
		sourceType: "module",
	},
});

describe("memoized-effect-dependencies", () => {
	ruleTester.run("memoized-effect-dependencies", rule, {
		invalid: [
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
	const dep = {};
	useEffect(() => {}, [dep]);
}
`,
				errors: [{ messageId: "unmemoizedDependency" }],
			},
			{
				code: `
import React from "@rbxts/react";

function Component() {
	const dep = () => {};
	React.useEffect(() => {}, [dep]);
}
`,
				errors: [{ messageId: "unmemoizedDependency" }],
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

class Foo {}

function Component() {
	useEffect(() => {}, [() => {}, {}, [], new Foo()]);
}
`,
				errors: [
					{ messageId: "unmemoizedDependency" },
					{ messageId: "unmemoizedDependency" },
					{ messageId: "unmemoizedDependency" },
					{ messageId: "unmemoizedDependency" },
				],
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function compute() {
	return {};
}

function Component() {
	const dep = compute();
	useEffect(() => {}, [dep]);
}
`,
				errors: [{ messageId: "unmemoizedDependency" }],
				options: [{ mode: "moderate" }],
			},
			{
				code: `
import { useEffect, useRef } from "@rbxts/react";

function Component() {
	const stableRef = useRef({});
	let dep = stableRef;
	useEffect(() => {}, [dep]);
}
`,
				errors: [{ messageId: "unmemoizedDependency" }],
				options: [{ mode: "aggressive" }],
			},
		],
		valid: [
			{
				code: `
import { useEffect, useMemo, useCallback } from "@rbxts/react";

function Component() {
	const memo = useMemo(() => ({}), []);
	const callback = useCallback(() => {}, []);
	useEffect(() => {}, [memo, callback]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
	const [count, setCount] = useState(0);
	useEffect(() => {}, [setCount]);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

const stable = {};

function Component() {
	useEffect(() => {}, [stable]);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component(props: { value: number }) {
	useEffect(() => {}, [props.value]);
}
`,
			},
		],
	});
});
