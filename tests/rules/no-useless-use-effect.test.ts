import { describe } from "bun:test";
import parser from "@typescript-eslint/parser";
import { RuleTester } from "@typescript-eslint/rule-tester";
import rule from "../../src/rules/no-useless-use-effect";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser,
		sourceType: "module",
	},
});

describe("no-useless-use-effect", () => {
	ruleTester.run("no-useless-use-effect", rule, {
		invalid: [
			{
				code: `
import { "useEffect" as useEffectAlias, useState } from "@rbxts/react";

function Component(properties) {
	const [count, setCount] = useState(0);
	useEffectAlias(() => {
		setCount(properties.initialCount);
	}, [properties.initialCount]);
}
`,
				errors: [{ messageId: "derivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component(properties) {
	const [fullName, setFullName] = useState("");
	useEffect(() => {
		setFullName(properties.firstName + properties.lastName);
	}, [properties.firstName, properties.lastName]);
}
`,
				errors: [{ messageId: "derivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component(properties) {
	const [selection, setSelection] = useState("");
	useEffect(() => {
		if (!properties.initialSelection) return;
		setSelection(properties.initialSelection);
	}, [properties.initialSelection]);
}
`,
				errors: [{ messageId: "derivedState" }],
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ onChange, value }) {
	useEffect(() => {
		onChange(value);
	}, [onChange, value]);
}
`,
				errors: [{ messageId: "notifyParent" }],
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component(properties) {
	useEffect(() => {
		properties.onChange?.(properties.value);
	}, [properties.value, properties.onChange]);
}
`,
				errors: [{ messageId: "notifyParent" }],
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ "onChange": handleChange = fallbackChange, value }) {
	useEffect(() => {
		handleChange(value);
	}, [handleChange, value]);
}
`,
				errors: [{ messageId: "notifyParent" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component(properties) {
	const [count, setCount] = useState(0);
	useEffect(() => {
		if (properties.ready) setCount(properties.value);
	}, [properties.ready, properties.value]);
}
`,
				errors: [{ messageId: "derivedState" }],
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ onChange, value }) {
	useEffect(() => {
		if (value) onChange(value);
	}, [onChange, value]);
}
`,
				errors: [{ messageId: "notifyParent" }],
			},
			{
				code: `
import React from "@rbxts/react";

function Component(properties) {
	React.useEffect(() => {
		properties.onChange(properties.value);
	}, [properties.value, properties.onChange]);
}
`,
				errors: [{ messageId: "notifyParent" }],
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component(properties = {}) {
	useEffect(() => {
		properties.onChange(properties.value);
	}, [properties.value, properties.onChange]);
}
`,
				errors: [{ messageId: "notifyParent" }],
			},
			{
				code: `
import * as React from "@rbxts/react";

function Component() {
	const [submitted, setSubmitted] = React.useState(false);
	React.useEffect(() => {
		if (!submitted) return;
		sendForm();
		setSubmitted(false);
	}, [submitted]);
}
`,
				errors: [{ messageId: "eventFlag" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
	const [submitted, setSubmitted] = useState(false);
	useEffect(() => {
		if (submitted) {
			setSubmitted(false);
			sendForm();
		}
	}, [submitted]);
}
`,
				errors: [{ messageId: "eventFlag" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
	const [submitted, setSubmitted] = useState(false);
	useEffect(() => {
		if (submitted) {
			sendForm();
			setSubmitted(false);
		}
	}, [submitted]);
}
`,
				errors: [{ messageId: "eventFlag" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
	const [submitted, setSubmitted] = useState(false);
	useEffect(() => {
		if (!submitted) return;
		setSubmitted(false);
		sendForm();
	}, [submitted]);
}
`,
				errors: [{ messageId: "eventFlag" }],
			},
			{
				code: `
import { useEffect, useReducer } from "@rbxts/react";

function reducer(state, action) {
	return action.type === "set" ? action.value : state;
}

function Component(properties) {
	const [value, dispatch] = useReducer(reducer, 0);
	useEffect(() => {
		if (properties.ready) {
			dispatch({ type: "set", value: properties.value });
		}
	}, [properties.ready, properties.value]);
}
`,
				errors: [{ messageId: "derivedState" }],
			},
			{
				code: `
import { useLayoutEffect, useState } from "react";

function Component(properties) {
	const [count, setCount] = useState(0);
	useLayoutEffect(() => {
		setCount(properties.initialCount);
	}, [properties.initialCount]);
}
`,
				errors: [{ messageId: "derivedState" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useInsertionEffect } from "@rbxts/react";

function Component({ onMount }) {
	useInsertionEffect(() => {
		onMount();
	}, [onMount]);
}
`,
				errors: [{ messageId: "notifyParent" }],
			},
		],
		valid: [
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ onChange, value }) {
	useEffect(() => onChange(value), [onChange, value]);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ [getKey()]: handleChange, value }) {
	useEffect(() => {
		handleChange(value);
	}, [handleChange, value]);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ onChange: { nested }, value }) {
	useEffect(() => {
		nested(value);
	}, [nested, value]);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
	useEffect(() => {
		const connection = connect();
		return () => disconnect(connection);
	}, []);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
	useEffect(async () => {
		await fetchData();
	}, []);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component(properties) {
	const [value, setValue] = useState(0);
	useEffect(() => {
		setValue(properties.count);
		logChange(properties.count);
	}, [properties.count]);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ onChange, value }) {
	useEffect(() => {
		if (!value) return;
		logChange(value);
		onChange(value);
	}, [onChange, value]);
}
`,
			},
			{
				code: `
import React from "@rbxts/react";

function Component(properties) {
	React["useEffect"](() => {
		properties.onChange?.(properties.value);
	}, [properties.value, properties.onChange]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
	const [submitted, setSubmitted] = useState(false);
	useEffect(() => {
		if (!submitted) return;
		sendForm();
		setSubmitted(false);
	}, []);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
	useEffect(() => {
		return () => cleanup();
		function helper() {
			return () => ignored();
		}
	}, []);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
	useEffect(() => {
		for (const item of items) {
			return () => cleanup(item);
		}
	}, [items]);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
	useEffect(() => {
		for (let index = 0; index < 1; index += 1) {
			return () => cleanup(index);
		}
	}, []);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
	useEffect(() => {
		label: {
			return () => cleanup();
		}
	}, []);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
	useEffect(() => {
		switch (getMode()) {
			case "open":
				return () => cleanup();
			default:
				return;
		}
	}, []);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
	useEffect(() => {
		with (configuration) {
			return () => cleanup();
		}
	}, []);
}
`,
				languageOptions: {
					sourceType: "script",
				},
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
	useEffect(() => {
		try {
			start();
		} finally {
			return () => stop();
		}
	}, []);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
	useEffect(() => {
		while (shouldContinue()) {
			return () => stop();
		}
	}, []);
}
`,
			},
		],
	});
});
