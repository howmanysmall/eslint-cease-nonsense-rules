import { describe } from "vitest";
import rule from "$rules/no-useless-use-memo";
import parser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser,
		sourceType: "module",
	},
});

describe("no-useless-use-memo", () => {
	// @ts-expect-error -- This is a dumb problem.
	ruleTester.run("no-useless-use-memo", rule, {
		invalid: [
			{
				code: `
import React from "react";

const value = React.useMemo(() => 1, []);
`,
				errors: [{ messageId: "uselessUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

const value = useMemo(function () {
	return 1;
}, []);
`,
				errors: [{ messageId: "uselessUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

const value = useMemo(() => 1);
`,
				errors: [{ messageId: "uselessUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

const COLORS = { red: 1 } as const;
const value = useMemo(() => COLORS["red"], []);
`,
				errors: [{ messageId: "uselessUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

const COLORS = { red: 1 } as const;
const value = useMemo(() => COLORS[red], []);
`,
				errors: [{ messageId: "uselessUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

const value = useMemo(() => ({ ["enabled"]: true }), []);
`,
				errors: [{ messageId: "uselessUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";
import { AnimationLibrary, SpringConfiguration, getAnimationConfiguration } from "./animation-config";

const rotationConfiguration = useMemo(
	() => getAnimationConfiguration(SpringConfiguration.Sharp, AnimationLibrary.ReactSpring),
	[],
);
`,
				errors: [{ messageId: "uselessUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import * as React from "react";
import { AnimationLibrary } from "./animation-config";

const glowConfiguration = React.useMemo(() => AnimationLibrary.ReactSpring, []);
`,
				errors: [{ messageId: "uselessUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";
import { AnimationLibrary, SpringConfiguration, getAnimationConfiguration } from "./animation-config";

const COLOR = Color3.fromRGB(255, 255, 255);

const accent = useMemo(() => COLOR, []);
`,
				errors: [{ messageId: "uselessUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

const COLOR = Color3.fromRGB(255, 255, 255);

const accent = useMemo(() => COLOR, [COLOR]);
`,
				errors: [{ messageId: "uselessUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";
import { AnimationLibrary, SpringConfiguration, getAnimationConfiguration } from "./animation-config";

const value = useMemo(() => ({ enabled: true, label: "Ready" }), ["Ready"]);
`,
				errors: [{ messageId: "uselessUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";
import { AnimationLibrary, SpringConfiguration, getAnimationConfiguration } from "./animation-config";

const value = useMemo(() => [1, 2, 3], []);
`,
				errors: [{ messageId: "uselessUseMemo" }],
				options: [{ dependencyMode: "empty-or-omitted", environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

const value = useMemo(() => \`ready\`, []);
`,
				errors: [{ messageId: "uselessUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

const value = useMemo(() => 1 + 2, []);
`,
				errors: [{ messageId: "uselessUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

const value = useMemo(() => true ? "a" : "b", []);
`,
				errors: [{ messageId: "uselessUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

const value = useMemo(() => (1, 2), []);
`,
				errors: [{ messageId: "uselessUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";
import { AnimationLibrary } from "./animation-config";

const value = useMemo(() => AnimationLibrary?.ReactSpring, []);
`,
				errors: [{ messageId: "uselessUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

const value = useMemo(() => -1, []);
`,
				errors: [{ messageId: "uselessUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { "useMemo" as memo } from "react";

const value = memo(() => -1, []);
`,
				errors: [{ messageId: "uselessUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";
import { factories } from "./factories";

const value = useMemo(() => factories["make"](), []);
`,
				errors: [{ messageId: "uselessUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

const value = useMemo(() => new Vector3(1, 2, 3), []);
`,
				errors: [{ messageId: "uselessUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";
import { AnimationLibrary, SpringConfiguration, getAnimationConfiguration } from "./animation-config";

const value = useMemo(() => (getAnimationConfiguration(SpringConfiguration.Sharp, AnimationLibrary.ReactSpring) as const)!, []);
`,
				errors: [{ messageId: "uselessUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";
import { AnimationLibrary, SpringConfiguration, getAnimationConfiguration } from "./animation-config";

const value = useMemo(() => (getAnimationConfiguration(SpringConfiguration.Sharp, AnimationLibrary.ReactSpring) satisfies unknown), []);
`,
				errors: [{ messageId: "uselessUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";
import { AnimationLibrary, SpringConfiguration, getAnimationConfiguration } from "./animation-config";

const value = useMemo(() => (<unknown>getAnimationConfiguration(SpringConfiguration.Sharp, AnimationLibrary.ReactSpring)), []);
`,
				errors: [{ messageId: "uselessUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";
import { AnimationLibrary, SpringConfiguration, getAnimationConfiguration } from "./animation-config";

const value = useMemo(() => getAnimationConfiguration<string>(SpringConfiguration.Sharp, AnimationLibrary.ReactSpring), []);
`,
				errors: [{ messageId: "uselessUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";
import { AnimationLibrary, SpringConfiguration, getAnimationConfiguration } from "./animation-config";

const value = useMemo(() => getAnimationConfiguration(SpringConfiguration.Sharp, AnimationLibrary.ReactSpring), [theme]);
`,
				errors: [{ messageId: "uselessUseMemo" }],
				options: [{ dependencyMode: "aggressive", environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

const value = useMemo(() => makeStaticValue(), [theme]);
`,
				errors: [{ messageId: "uselessUseMemo" }],
				options: [
					{
						dependencyMode: "aggressive",
						environment: "standard",
						staticGlobalFactories: ["makeStaticValue"],
					},
				],
			},
		],
		valid: [
			{
				code: `
import { useMemo } from "react";

useMemo();
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

const value = useMemo();
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

const factory = () => 1;
const value = useMemo(factory, []);
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import * as React from "react";

const value = React["useMemo"](() => 1, []);
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

declare const key: string;
const value = useMemo(() => ({ [key]: true }), []);
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import * as React from "react";

const value = React.memo.useMemo(() => 1, []);
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

const value = (useMemo ?? fallback)(() => 1, []);
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

class Component {
	#useMemo() {}

	render() {
		return this.#useMemo(() => 1, []);
	}
}
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";
import { AnimationLibrary, SpringConfiguration, getAnimationConfiguration } from "./animation-config";

function Component({ theme }) {
	const value = useMemo(() => getAnimationConfiguration(theme, AnimationLibrary.ReactSpring), [theme]);
	return value;
}
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";
import { AnimationLibrary, SpringConfiguration, getAnimationConfiguration } from "./animation-config";

function Component({ theme }) {
	const value = useMemo(() => {
		const localValue = getAnimationConfiguration(SpringConfiguration.Sharp, AnimationLibrary.ReactSpring);
		return localValue;
	}, []);
	return value;
}
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";
import { AnimationLibrary, SpringConfiguration, getAnimationConfiguration } from "./animation-config";

const value = useMemo(() => getAnimationConfiguration(SpringConfiguration.Sharp, AnimationLibrary.ReactSpring), [theme]);
`,
				options: [{ dependencyMode: "empty-or-omitted", environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";
import { AnimationLibrary, SpringConfiguration, getAnimationConfiguration } from "./animation-config";

const value = useMemo(() => getAnimationConfiguration(SpringConfiguration.Sharp, AnimationLibrary.ReactSpring), [theme]);
`,
				options: [{ dependencyMode: "non-updating", environment: "standard" }],
			},
			{
				code: `
import { useMemo as useMemoHook } from "react";

useMemoHook(() => 1, []);
`,
			},
			{
				code: `
import { useMemo } from "react";

const value = useMemo(() => (() => 1), []);
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

const first = second;
const second = first;
const value = useMemo(() => first, []);
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

let VALUE = 1;

const value = useMemo(() => VALUE, []);
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

function getValue() {
	return 1;
}

const value = useMemo(() => getValue, []);
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

const value = useMemo(() => ({
	...base,
}), []);
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

const value = useMemo(() => ({
	get label() {
		return "Ready";
	},
}), []);
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

const value = useMemo(() => ({ [theme]: true }), []);
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

const value = useMemo(() => ({ label: theme }), []);
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

const value = useMemo(() => [1, ...items], []);
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

const value = useMemo(() => (1 + 2)(), []);
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

function Component({ localFactory }) {
	return useMemo(() => localFactory.make(), []);
}
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

class Component {
	#ready = true;

	render() {
		return useMemo(() => #ready in this, []);
	}
}
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

const value = useMemo(() => 1, deps);
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

const value = useMemo(() => 1, ...deps);
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

declare const VALUE: number;

const value = useMemo(() => VALUE, []);
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

const value = useMemo(function () {
	1;
}, []);
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useCallback, useMemo } from "react";

const value = useMemo(function () {
	return;
}, []);
void useCallback;
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

const value = useMemo(() => [1, , 2], []);
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

void useMemo(() => 1, []);
`,
				options: [{ environment: "standard" }],
			},
		],
	});
});
