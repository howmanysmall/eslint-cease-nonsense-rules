import { describe } from "vitest";
import rule from "$rules/no-unused-use-memo";
import parser from "@typescript-eslint/parser";
import { RuleTester } from "@typescript-eslint/rule-tester";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser,
		sourceType: "module",
	},
});

describe("no-unused-use-memo", () => {
	ruleTester.run("no-unused-use-memo", rule, {
		invalid: [
			{
				code: `
import { useMemo } from "react";

useMemo(() => 1, []);
`,
				errors: [{ messageId: "unusedUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import * as React from "react";

React.useMemo(() => 1, []);
`,
				errors: [{ messageId: "unusedUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

void useMemo(() => 1, []);
`,
				errors: [{ messageId: "unusedUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { "useMemo" as memo } from "react";

memo(() => 1, []);
`,
				errors: [{ messageId: "unusedUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import * as React from "react";

void React.useMemo(() => 1, []);
`,
				errors: [{ messageId: "unusedUseMemo" }],
				options: [{ environment: "standard" }],
			},
		],
		valid: [
			{
				code: `
import { useMemo } from "react";

const value = useMemo(() => 1, []);
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

function Component() {
    return useMemo(() => 1, []);
}
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

function use(value) {
    return value;
}

const value = useMemo(() => 1, []);
use(value);
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
function useMemo(factory) {
    return factory();
}

useMemo(() => 1);
`,
			},
			{
				code: `
import("react");
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
class Component extends BaseComponent {
    constructor() {
        super();
    }
}
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import * as React from "react";

React["useMemo"](() => 1, []);
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import * as React from "react";

getReact().useMemo(() => 1, []);
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import * as React from "react";

class Component {
    #useMemo() {
        return 1;
    }

    render() {
        return React.#useMemo();
    }
}
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import * as React from "react";

React.useEffect(() => 1, []);
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useEffect } from "react";

useEffect(() => undefined, []);
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "other-react";

useMemo(() => 1, []);
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import React from "react";

const value = void React.useMemo(() => 1, []);
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import React from "react";

React.memo(() => null);
`,
				options: [{ environment: "standard" }],
			},
		],
	});
});
