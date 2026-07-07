import nodePath from "node:path";
import { describe } from "vitest";
import rule from "$rules/prefer-local-portal-component";
import tsParser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";

const FIXTURES = nodePath.join(import.meta.dirname, "..", "fixtures", "prefer-local-portal-component");
const WITH_PORTAL = nodePath.join(FIXTURES, "with-portal");
const WITHOUT_PORTAL = nodePath.join(FIXTURES, "without-portal");
const AMBIGUOUS_PORTAL = nodePath.join(FIXTURES, "ambiguous-portal");
const FIXTURE_ONLY_PORTAL = nodePath.join(FIXTURES, "fixture-only");

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

describe("prefer-local-portal-component", () => {
	// @ts-expect-error RuleTester types incompatible with runtime rule shape
	ruleTester.run("prefer-local-portal-component", rule, {
		invalid: [
			{
				code: `import Portal from "../components/portal";
import { createPortal } from "@rbxts/react-roblox";

export function Example(target: Instance) {
    return createPortal(<frame />, target);
}`,
				errors: [{ messageId: "preferPortalComponent" }],
				filename: nodePath.join(WITH_PORTAL, "src", "screens", "example.tsx"),
				output: `import Portal from "../components/portal";
import { createPortal } from "@rbxts/react-roblox";

export function Example(target: Instance) {
    return <Portal target={target}><frame /></Portal>;
}`,
			},
			{
				code: `import PortalComponent from "../components/portal";
import { createPortal as mountPortal } from "@rbxts/react-roblox";

export function Example(content: React.ReactNode, target: Instance) {
    return mountPortal(content, target);
}`,
				errors: [{ messageId: "preferPortalComponent" }],
				filename: nodePath.join(WITH_PORTAL, "src", "screens", "aliased.tsx"),
				output: `import PortalComponent from "../components/portal";
import { createPortal as mountPortal } from "@rbxts/react-roblox";

export function Example(content: React.ReactNode, target: Instance) {
    return <PortalComponent target={target}>{content}</PortalComponent>;
}`,
			},
			{
				code: `import { Portal } from "../components/portal";
import { createPortal } from "@rbxts/react-roblox";

export function Example(target: Instance) {
    return createPortal(<frame />, target);
}`,
				errors: [{ messageId: "preferPortalComponent" }],
				filename: nodePath.join(WITH_PORTAL, "src", "screens", "named.tsx"),
				output: `import { Portal } from "../components/portal";
import { createPortal } from "@rbxts/react-roblox";

export function Example(target: Instance) {
    return <Portal target={target}><frame /></Portal>;
}`,
			},
			{
				code: `import { "Portal" as LocalPortal } from "../components/portal";
import { "createPortal" as mountPortal } from "@rbxts/react-roblox";

export function Example(target: Instance) {
    return mountPortal(<frame />, target);
}`,
				errors: [{ messageId: "preferPortalComponent" }],
				filename: nodePath.join(WITH_PORTAL, "src", "screens", "string-imports.tsx"),
				output: `import { "Portal" as LocalPortal } from "../components/portal";
import { "createPortal" as mountPortal } from "@rbxts/react-roblox";

export function Example(target: Instance) {
    return <LocalPortal target={target}><frame /></LocalPortal>;
}`,
			},
			{
				code: `import Portal from "../components/portal";
import * as ReactDOM from "react-dom";

export function Example(container: HTMLElement) {
    return ReactDOM.createPortal(<div />, container);
}`,
				errors: [{ messageId: "preferPortalComponent" }],
				filename: nodePath.join(WITH_PORTAL, "src", "screens", "standard.tsx"),
				output: `import Portal from "../components/portal";
import * as ReactDOM from "react-dom";

export function Example(container: HTMLElement) {
    return <Portal target={container}><div /></Portal>;
}`,
			},
			{
				code: `import { createPortal } from "@rbxts/react-roblox";

export function Example(target: Instance) {
    return createPortal(<frame />, target);
}`,
				errors: [{ messageId: "preferPortalComponent" }],
				filename: nodePath.join(WITH_PORTAL, "src", "screens", "report-only.tsx"),
			},
			{
				code: `import { NotPortal } from "../components/portal";
import { createPortal } from "@rbxts/react-roblox";

export function Example(target: Instance) {
    return createPortal(<frame />, target);
}`,
				errors: [{ messageId: "preferPortalComponent" }],
				filename: nodePath.join(WITH_PORTAL, "src", "screens", "named-nonportal.tsx"),
				output: null,
			},
			{
				code: `import Portal from "../components/portal";
import { createPortal } from "@rbxts/react-roblox";

export function Example(target: Instance) {
    return createPortal(<></>, target);
}`,
				errors: [{ messageId: "preferPortalComponent" }],
				filename: nodePath.join(WITH_PORTAL, "src", "screens", "fragment.tsx"),
				output: `import Portal from "../components/portal";
import { createPortal } from "@rbxts/react-roblox";

export function Example(target: Instance) {
    return <Portal target={target}><></></Portal>;
}`,
			},
			{
				code: `import Portal from "../components/portal";
import { createPortal } from "@rbxts/react-roblox";

export function Example(content: React.ReactNode, target: Instance) {
    return createPortal(content ?? <frame />, target);
}`,
				errors: [{ messageId: "preferPortalComponent" }],
				filename: nodePath.join(WITH_PORTAL, "src", "screens", "expression-child.tsx"),
				output: `import Portal from "../components/portal";
import { createPortal } from "@rbxts/react-roblox";

export function Example(content: React.ReactNode, target: Instance) {
    return <Portal target={target}>{content ?? <frame />}</Portal>;
}`,
			},
			{
				code: `import Portal from "components/portal";
import { createPortal } from "@rbxts/react-roblox";

export function Example(target: Instance) {
    return createPortal(<frame />, target);
}`,
				errors: [{ messageId: "preferPortalComponent" }],
				filename: nodePath.join(WITH_PORTAL, "src", "screens", "bare-local.tsx"),
				output: null,
			},
			{
				code: `import "./placeholder";
import { createPortal } from "@rbxts/react-roblox";

export function Example(target: Instance) {
    return createPortal(<frame />, target);
}`,
				errors: [{ messageId: "preferPortalComponent" }],
				filename: nodePath.join(WITH_PORTAL, "src", "screens", "nearby-nonportal-import.tsx"),
				output: null,
			},
			{
				code: `import * as LocalPortal from "../components/portal";
import { createPortal } from "@rbxts/react-roblox";

export function Example(target: Instance) {
    return createPortal(<frame />, target);
}`,
				errors: [{ messageId: "preferPortalComponent" }],
				filename: nodePath.join(WITH_PORTAL, "src", "screens", "namespace-local-portal.tsx"),
				output: null,
			},
		],
		valid: [
			{
				code: `import { createPortal } from "@rbxts/react-roblox";

export function Example(target: Instance) {
    return createPortal(<frame />, target);
}`,
				filename: nodePath.join(WITHOUT_PORTAL, "src", "screens", "example.tsx"),
			},
			{
				code: `import { createPortal } from "@rbxts/react-roblox";

export function Example(target: Instance) {
    return createPortal(<frame />, target);
}`,
				filename: nodePath.join(AMBIGUOUS_PORTAL, "src", "screens", "example.tsx"),
			},
			{
				code: `import { createPortal } from "@rbxts/react-roblox";

export function Example(target: Instance) {
        function createPortal() {
            return target;
        }

                    return createPortal();
    }`,
				filename: nodePath.join(WITH_PORTAL, "src", "screens", "shadowed.tsx"),
			},
			{
				code: `import { createPortal } from "@rbxts/react-roblox";

export function Example(target: Instance) {
    return createPortal(<frame />, target);
}`,
				filename: nodePath.join(FIXTURE_ONLY_PORTAL, "src", "screens", "example.tsx"),
			},
			{
				code: `import Portal from "../components/portal";

export function Example(target: Instance) {
    return createPortal(<frame />, target);
}`,
				filename: nodePath.join(WITH_PORTAL, "src", "screens", "unbound.tsx"),
			},
			{
				code: `import Portal from "../components/portal";
import { createPortal } from "@rbxts/react-roblox";

export function Example(target: Instance) {
    return createPortal(<frame />);
}`,
				filename: nodePath.join(WITH_PORTAL, "src", "screens", "wrong-arity.tsx"),
			},
			{
				code: `import Portal from "../components/portal";
import ReactDOM from "react-dom";

export function Example(container: HTMLElement) {
    return ReactDOM.createPortal(<div />, container);
}`,
				filename: nodePath.join(WITH_PORTAL, "src", "screens", "default-member.tsx"),
			},
			{
				code: `import Portal from "../components/portal";
import { createPortal } from "other-renderer";

export function Example(target: Instance) {
    return createPortal(<frame />, target);
}`,
				filename: nodePath.join(WITH_PORTAL, "src", "screens", "wrong-source.tsx"),
			},
			{
				code: `import Portal from "../components/portal";
import { render as createPortal } from "@rbxts/react-roblox";

export function Example(target: Instance) {
    return createPortal(<frame />, target);
}`,
				filename: nodePath.join(WITH_PORTAL, "src", "screens", "wrong-import-name.tsx"),
			},
			{
				code: `import Portal from "../components/portal";
import createPortal from "@rbxts/react-roblox";

export function Example(target: Instance) {
    return createPortal(<frame />, target);
}`,
				filename: nodePath.join(WITH_PORTAL, "src", "screens", "default-create-portal.tsx"),
			},
			{
				code: `import Portal from "../components/portal";
import * as ReactDOM from "other-renderer";

export function Example(container: HTMLElement) {
    return ReactDOM.createPortal(<div />, container);
}`,
				filename: nodePath.join(WITH_PORTAL, "src", "screens", "wrong-namespace-source.tsx"),
			},
			{
				code: `import Portal from "../components/portal";
import * as ReactDOM from "react-dom";

export function Example(container: HTMLElement) {
    return ReactDOM["createPortal"](<div />, container);
}`,
				filename: nodePath.join(WITH_PORTAL, "src", "screens", "computed-member.tsx"),
			},
			{
				code: `import Portal from "../components/portal";

declare function getRenderer(): { createPortal(children: unknown, target: unknown): unknown };

export function Example(container: HTMLElement) {
    return getRenderer().createPortal(<div />, container);
}`,
				filename: nodePath.join(WITH_PORTAL, "src", "screens", "call-object.tsx"),
			},
			{
				code: `import Portal from "../components/portal";
import * as ReactDOM from "react-dom";

export function Example(container: HTMLElement) {
    return ReactDOM.render(<div />, container);
}`,
				filename: nodePath.join(WITH_PORTAL, "src", "screens", "wrong-member.tsx"),
			},
			{
				code: `import MissingPortal from "../components/missing-portal";
import { createPortal } from "@rbxts/react-roblox";

export function Example(target: Instance) {
    return createPortal(<frame />, target);
}`,
				filename: nodePath.join(WITHOUT_PORTAL, "src", "screens", "missing-import.tsx"),
			},
			{
				code: `import Portal from "../components/portal";
import { createPortal } from "@rbxts/react-roblox";

export function Example(target: Instance) {
    return createPortal(<frame />, target);
}`,
				filename: "",
			},
			{
				code: `import Portal from "../components/portal";
import { createPortal } from "@rbxts/react-roblox";

declare const fallbackPortal: typeof createPortal;

export function Example(target: Instance) {
    return (createPortal ?? fallbackPortal)(<frame />, target);
}`,
				filename: nodePath.join(WITH_PORTAL, "src", "screens", "indirect-call.tsx"),
			},
			{
				code: `import Portal from "../components/portal";

const ReactDOM = {
    createPortal(children: React.ReactNode, target: HTMLElement) {
        return { children, target };
    },
};

export function Example(container: HTMLElement) {
    return ReactDOM.createPortal(<div />, container);
}`,
				filename: nodePath.join(WITH_PORTAL, "src", "screens", "local-namespace.tsx"),
			},
			{
				code: `import Portal from "../components/portal";

export function Example(container: HTMLElement) {
    return ReactDOM.createPortal(<div />, container);
}`,
				filename: nodePath.join(WITH_PORTAL, "src", "screens", "unbound-namespace.tsx"),
			},
			{
				code: `import Portal from "../components/portal";

class Renderer {
    #createPortal(children: React.ReactNode, target: HTMLElement) {
        return { children, target };
    }

    render(renderer: Renderer, container: HTMLElement) {
        return renderer.#createPortal(<div />, container);
    }
}`,
				filename: nodePath.join(WITH_PORTAL, "src", "screens", "private-member.tsx"),
			},
			{
				code: `import Portal from "../components/portal";
import createPortal = require("@rbxts/react-roblox");

export function Example(target: Instance) {
    return createPortal(<frame />, target);
}`,
				filename: nodePath.join(WITH_PORTAL, "src", "screens", "import-equals-call.tsx"),
			},
			{
				code: `import Portal from "../components/portal";
import ReactDOM = require("react-dom");

export function Example(container: HTMLElement) {
    return ReactDOM.createPortal(<div />, container);
}`,
				filename: nodePath.join(WITH_PORTAL, "src", "screens", "import-equals-namespace.tsx"),
			},
		],
	});
});
