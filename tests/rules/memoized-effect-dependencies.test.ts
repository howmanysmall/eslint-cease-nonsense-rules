import { describe } from "vitest";
import rule from "$rules/memoized-effect-dependencies";
import parser from "@typescript-eslint/parser";
import { RuleTester } from "@typescript-eslint/rule-tester";

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
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
	function handleChange() {}
	useEffect(() => {}, [handleChange]);
}
`,
				errors: [{ messageId: "unmemoizedDependency" }],
			},
			{
				code: `
import React from "@rbxts/react";

function Component() {
	const dep = React.useMemo(() => ({}), []);
	React.useEffect(() => {}, [...dep]);
}
`,
				errors: [{ messageId: "unmemoizedDependency" }],
				options: [{ mode: "moderate" }],
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function compute() {
	return {};
}

function Component() {
	useEffect(() => {}, [compute()]);
}
`,
				errors: [{ messageId: "unmemoizedDependency" }],
				options: [{ mode: "moderate" }],
			},
			{
				code: `
import { "useEffect" as effect } from "@rbxts/react";

function Component() {
    const dep = {};
    effect(() => {}, [dep]);
}
`,
				errors: [{ messageId: "unmemoizedDependency" }],
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    const dep = {};
    useEffect(() => {}, [...deps, dep]);
}
`,
				errors: [{ messageId: "unmemoizedDependency" }, { messageId: "unmemoizedDependency" }],
				options: [{ mode: "moderate" }],
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    class LocalClass {}
    useEffect(() => {}, [LocalClass]);
}
`,
				errors: [{ messageId: "unmemoizedDependency" }],
			},
			{
				code: `
import { useCustomEffect } from "@rbxts/react";

function Component() {
    const dep = {};
    useCustomEffect(() => {}, "label", [dep]);
}
`,
				errors: [{ messageId: "unmemoizedDependency" }],
				options: [{ hooks: [{ dependenciesIndex: 2, name: "useCustomEffect" }] }],
			},
			{
				code: `
import { useTrackedEffect } from "@rbxts/react";

function Component() {
    const dep = {};
    useTrackedEffect(() => {}, [dep]);
}
`,
				errors: [{ messageId: "unmemoizedDependency" }],
				options: [{ hooks: [{ name: "" }, { name: "useTrackedEffect" }] }],
			},
			{
				code: `
import React from "@rbxts/react";

function Component() {
    const dep = {};
    React.useEffect?.(() => {}, [dep]);
}
`,
				errors: [{ messageId: "unmemoizedDependency" }],
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    const dep = {};
    useEffect(() => {}, [dep, dep]);
}
`,
				errors: [{ messageId: "unmemoizedDependency" }, { messageId: "unmemoizedDependency" }],
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function compute() {
    return {};
}

function Component() {
    const dep = (0, compute)();
    useEffect(() => {}, [dep]);
}
`,
				errors: [{ messageId: "unmemoizedDependency" }],
				options: [{ mode: "moderate" }],
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component(props: { options: Record<string, unknown> }) {
    useEffect(() => {}, [props.options]);
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
			{
				code: `
import { useEffect } from "@rbxts/react";

function compute() {
    return {};
}

function Component() {
    useEffect(() => {}, [compute()]);
}
`,
			},
			{
				code: `
import React from "@rbxts/react";

function Component() {
	const dep = React.useMemo(() => ({}), []);
	const stableRef = React.useRef({});
	React.useEffect(() => {}, [dep, stableRef]);
}
`,
			},
			{
				code: `
import { useEffect, useRef } from "@rbxts/react";

function Component() {
    const stableRef = useRef({});
    useEffect(() => {}, [stableRef]);
}
`,
			},
			{
				code: `
import React from "@rbxts/react";

function Component() {
    const dep = React["useMemo"](() => ({}), []);
    React.useEffect(() => {}, [dep]);
}
`,
			},
			{
				code: `
import React from "@rbxts/react";

function Component() {
    const stableRef = React["useRef"]({});
    React.useEffect(() => {}, [stableRef]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
	const [count, setCount = () => undefined] = useState(0);
	useEffect(() => {}, [setCount]);
	void count;
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
	const [count, ...rest] = useState(0);
	useEffect(() => {}, [rest]);
	void count;
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
	const derived = condition ? stable : unstable;
	useEffect(() => {}, [derived]);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
	useEffect(() => {}, [externalValue]);
}
`,
			},
			{
				code: `
import { useEffect, useTransition } from "@rbxts/react";

function Component() {
    const [pending, startTransition] = useTransition();
    useEffect(() => {}, [startTransition]);
    void pending;
}
`,
			},
			{
				code: `
import React from "@rbxts/react";

function Component() {
    const [pending, startTransition] = React.useTransition();
    React.useEffect(() => {}, [startTransition]);
    void pending;
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    useEffect(() => {}, deps);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    useEffect(() => {}, [...deps, stable]);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    useEffect(() => {}, [, stable]);
}
`,
			},
			{
				code: `
import { useEffect } from "not-react";

function Component() {
    const dep = {};
    useEffect(() => {}, [dep]);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";
import { importedDep } from "./deps";

function Component() {
    useEffect(() => {}, [importedDep]);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    const dep = {};
    unknown.callee(() => {}, [dep]);
    useEffect(() => {}, [externalValue]);
}
`,
			},
			{
				code: `
import React from "@rbxts/react";

function Component() {
    const dep = {};
    React["useEffect"](() => {}, [dep]);
}
`,
			},
			{
				code: `
import React from "@rbxts/react";

function Component() {
    const dep = {};
    getReact().useEffect(() => {}, [dep]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [value] = useState(0);
    useEffect(() => {}, [value]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [value, { reset }] = useState<[number, { reset: () => void }]>();
    useEffect(() => {}, [reset]);
    void value;
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    let dep;
    useEffect(() => {}, [dep]);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    const dep: {};
    useEffect(() => {}, [dep]);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    enum Dependency {
        Value,
    }

    useEffect(() => {}, [Dependency]);
}
`,
				options: [{ mode: "moderate" }],
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

class Component {
    render() {
        useEffect(() => {}, [this.props.value]);
    }
}
`,
			},
			{
				code: `
import { useEffect, useLayoutEffect } from "@rbxts/react";

function Component() {
    const dep = {};
    (useEffect || useLayoutEffect)(() => {}, [dep]);
}
`,
			},
		],
	});
});
