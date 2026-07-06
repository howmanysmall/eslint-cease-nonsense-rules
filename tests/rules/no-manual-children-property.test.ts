import nodePath from "node:path";
import { describe, vi } from "vitest";
import rule from "$rules/no-manual-children-property";
import parser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";

const __dirname = import.meta.dirname;

vi.setConfig({ testTimeout: 30_000 });

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

const fixturesDir = nodePath.join(__dirname, "../fixtures/no-manual-children-property");

const typeAwareRuleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser,
		parserOptions: {
			ecmaFeatures: {
				jsx: true,
			},
			projectService: {
				allowDefaultProject: ["*.ts", "*.tsx"],
				defaultProject: nodePath.join(fixturesDir, "tsconfig.json"),
				maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 64,
			},
			tsconfigRootDir: fixturesDir,
		},
		sourceType: "module",
	},
});

describe("no-manual-children-property", () => {
	// @ts-expect-error RuleTester types are stricter than runtime usage.
	ruleTester.run("no-manual-children-property-fast", rule, {
		invalid: [
			{
				code: `
import type { PropsWithChildren } from "react";

type FrameProperties = PropsWithChildren<{ readonly position: UDim2 }>;

function Frame(props: FrameProperties) {
	return <div>{props.children}</div>;
}
`,
				errors: [{ messageId: "manualChildrenProperty" }],
			},
			{
				code: `
type FrameProperties = React.PropsWithChildren<{ readonly position: UDim2 }>;

function Frame(props: FrameProperties) {
	return <div>{props.children}</div>;
}
`,
				errors: [{ messageId: "manualChildrenProperty" }],
			},
			{
				code: `
import type { PropsWithChildren } from "react";

interface FrameProperties extends React.PropsWithChildren<{ readonly position: UDim2 }> {}

function Frame(props: FrameProperties) {
	return <div>{props.children}</div>;
}
`,
				errors: [{ messageId: "manualChildrenProperty" }],
			},
			{
				code: `
import type { ReactNode } from "react";

interface FrameProperties {
	readonly position: UDim2;
	readonly children?: ReactNode;
}

function Frame(props: FrameProperties) {
	return <div>{props.children}</div>;
}
`,
				errors: [{ messageId: "manualChildrenProperty" }],
			},
			{
				code: `
import type { ReactNode } from "react";

type FrameProperties = {
	readonly position: UDim2;
	readonly children?: ReactNode;
};

const Frame = (props: FrameProperties) => <div>{props.children}</div>;
`,
				errors: [{ messageId: "manualChildrenProperty" }],
			},
			{
				code: `
import type { ReactNode } from "react";

const Frame = (props: { readonly position: UDim2; readonly children?: ReactNode }) => <div>{props.children}</div>;
`,
				errors: [{ messageId: "manualChildrenProperty" }],
			},
			{
				code: `
import type { ReactNode } from "react";

type ExtraProperties = { readonly children?: ReactNode };
type FrameProperties = { readonly position: UDim2 } & ExtraProperties;

function Frame(props: FrameProperties) {
	return <div>{props.children}</div>;
}
`,
				errors: [{ messageId: "manualChildrenProperty" }],
			},
			{
				code: `
import type { PropsWithChildren } from "react";

interface FrameProperties extends PropsWithChildren<{ readonly position: UDim2 }> {}

function Frame(props: FrameProperties) {
	return <div>{props.children}</div>;
}
`,
				errors: [{ messageId: "manualChildrenProperty" }],
			},
			{
				code: `
import type { ReactNode } from "react";

interface BaseProperties {
	readonly children?: ReactNode;
}

interface FrameProperties extends BaseProperties {
	readonly position: UDim2;
}

function Frame(props: FrameProperties) {
	return <div>{props.children}</div>;
}
`,
				errors: [{ messageId: "manualChildrenProperty" }],
			},
			{
				code: `
import type { ReactNode } from "react";

interface FrameProperties {
	readonly position: UDim2;
	readonly children?: ReactNode;
}

function Frame(props: FrameProperties = { position: new UDim2() }) {
	return <div>{props.children}</div>;
}
`,
				errors: [{ messageId: "manualChildrenProperty" }],
			},
			{
				code: `
import type { ReactNode } from "react";

type FrameProperties = {
	readonly position: UDim2;
	readonly children?: ReactNode;
};

const Frame = function(props: FrameProperties) {
	return <div>{props.children}</div>;
};
`,
				errors: [{ messageId: "manualChildrenProperty" }],
				options: [{ mode: "fast" }],
			},
		],
		valid: [
			{
				code: `
import type { ReactNode } from "react";

interface FrameProperties {
	readonly position: UDim2;
	readonly [children]?: ReactNode;
}

function Frame(props: FrameProperties) {
	return <div>{props.position}</div>;
}
`,
			},
			{
				code: `
import type { ReactNode } from "react";

interface FrameProperties {
	readonly position: UDim2;
	readonly children?: ReactNode;
}

export default function(props: FrameProperties) {
	return <div>{props.children}</div>;
}
`,
			},
			{
				code: `
function Frame() {
	return <div />;
}
`,
			},
			{
				code: `
function Frame(props) {
	return <div>{props.children}</div>;
}
`,
			},
			{
				code: `
type LoopA = LoopB;
type LoopB = LoopA;

function Frame(props: LoopA) {
	return <div>{props}</div>;
}
`,
			},
			{
				code: `
import type { ReactNode } from "react";

interface FrameProperties {
	readonly children?: ReactNode;
}

const [Frame] = [(props: FrameProperties) => <div>{props.children}</div>];
`,
			},
			{
				code: `
const Frame = 1;
void Frame;
`,
			},
			{
				code: `
import type { PropertiesWithChildren } from "react";

interface FrameProperties extends PropertiesWithChildren {
	readonly position: UDim2;
}

function Frame(props: FrameProperties) {
	return <div>{props.children}</div>;
}
`,
			},
			{
				code: `
import type { PropertiesWithChildren } from "react";

type FrameProperties = PropertiesWithChildren<{ readonly position: UDim2 }>;

const Frame = (props: FrameProperties) => <div>{props.children}</div>;
`,
			},
			{
				code: `
import type { ReactNode } from "react";

interface SlotData {
	readonly children?: ReactNode;
}

const slotData: SlotData = {};
void slotData;
`,
			},
			{
				code: `
import type { ReactNode } from "react";

interface FrameProperties {
	readonly position: UDim2;
	readonly children?: ReactNode;
}

function makeFrameProperties(props: FrameProperties) {
	return props;
}
`,
			},
			{
				code: `
import type { PropsWithChildren } from "react";

type FrameProperties = PropsWithChildren<{ readonly position: UDim2 }>;

const Frame = (props: FrameProperties) => <div>{props.children}</div>;
`,
				options: [{ wrapperNames: ["PropsWithChildren"] }],
			},
			{
				code: `
import type { ReactNode } from "react";

interface FrameProperties {
	readonly position: UDim2;
	readonly children?: ReactNode;
}

function Frame(props: FrameProperties) {
	return <div>{props.children}</div>;
}
`,
				options: [{ mode: "accurate" }],
			},
			{
				code: `
import type { ReactNode } from "react";

interface FrameProperties {
	readonly children?: ReactNode;
}

function Frame(...props: Array<FrameProperties>) {
	return <div>{props.length}</div>;
}
`,
			},
			{
				code: `
import type { ReactNode } from "react";

interface FrameProperties {
	readonly children?: ReactNode;
}

function Frame({ children }: FrameProperties) {
	return <div>{children}</div>;
}
`,
			},
			{
				code: `
interface FrameProperties {
	getChildren(): JSX.Element;
}

function Frame(props: FrameProperties) {
	return <div>{props.getChildren()}</div>;
}
`,
			},
			{
				code: `
import type { ReactNode } from "react";

interface FrameProperties {
	readonly [children]?: ReactNode;
}

function Frame(props: FrameProperties) {
	return <div>{props}</div>;
}
`,
			},
			{
				code: `
import type { ReactNode } from "react";

interface FrameProperties {
	readonly 0?: ReactNode;
}

function Frame(props: FrameProperties) {
	return <div>{props}</div>;
}
`,
			},
			{
				code: `
import type { ReactNode } from "react";

interface FrameProperties {
	readonly #children?: ReactNode;
}

function Frame(props: FrameProperties) {
	return <div>{props}</div>;
}
`,
			},
			{
				code: `
function Frame(props: this) {
	return <div>{props}</div>;
}
`,
			},
			{
				code: `
interface BaseProperties extends FrameProperties {}

interface FrameProperties extends BaseProperties {
	readonly position: UDim2;
}

function Frame(props: FrameProperties) {
	return <div>{props.position}</div>;
}
`,
			},
		],
	});

	// @ts-expect-error RuleTester types are stricter than runtime usage.
	typeAwareRuleTester.run("no-manual-children-property-accurate", rule, {
		invalid: [
			{
				code: `
import type { ReactNode } from "react";

type BaseChildren = {
	readonly children?: ReactNode;
};

interface FrameProperties extends BaseChildren {
	readonly position: UDim2;
}

function Frame(props: FrameProperties): JSX.Element {
	return <div>{props.children}</div>;
}
`,
				errors: [{ messageId: "manualChildrenProperty" }],
			},
			{
				code: `
import type { ReactNode } from "react";

interface FrameProperties {
	(): void;
	readonly children?: ReactNode;
}

function Frame(props: FrameProperties): JSX.Element {
	return <div>{props.children}</div>;
}
`,
				errors: [{ messageId: "manualChildrenProperty" }],
			},
			{
				code: `
import type { PropertiesWithChildren as Wrapper, ReactNode } from "react";

type AliasWrapper<TProps> = Wrapper<TProps>;
type ManualChildren = { readonly children?: ReactNode };
type FrameProperties = AliasWrapper<{ readonly position: UDim2 }> & ManualChildren;

function Frame(props: FrameProperties): JSX.Element {
	return <div>{props.children}</div>;
}
`,
				errors: [{ messageId: "manualChildrenProperty" }],
			},
			{
				code: `
import type { ReactNode } from "react";

interface FrameProperties {
	readonly position: UDim2;
	readonly "children"?: ReactNode;
}

const Frame = (props: FrameProperties): JSX.Element => {
	return <div>{props.children}</div>;
};
`,
				errors: [{ messageId: "manualChildrenProperty" }],
			},
			{
				code: `
import type { ReactNode } from "react";

type FrameProperties = {
	readonly position: UDim2;
	readonly "children"?: ReactNode;
};

function Frame(props: FrameProperties): JSX.Element {
	return <div>{props.children}</div>;
}
`,
				errors: [{ messageId: "manualChildrenProperty" }],
			},
			{
				code: `
import type { ReactNode } from "react";

interface FrameProperties {
	readonly position: UDim2;
	readonly children?: ReactNode;
}

function Frame(props: FrameProperties): JSX.Element {
	return <div>{props.children}</div>;
}
`,
				errors: [{ messageId: "manualChildrenProperty" }],
			},
			{
				code: `
import type { PropsWithChildren } from "react";

function Frame(props: PropsWithChildren<{ readonly position: UDim2 }>): JSX.Element {
	return <div>{props.children}</div>;
}
`,
				errors: [{ messageId: "manualChildrenProperty" }],
			},
			{
				code: `
import type { PropsWithChildren } from "react";

interface FrameProperties extends PropsWithChildren<{ readonly position: UDim2 }> {}

function Frame(props: FrameProperties): JSX.Element {
	return <div>{props.children}</div>;
}
`,
				errors: [{ messageId: "manualChildrenProperty" }],
			},
			{
				code: `
type PropsWithChildren<TProperties> = TProperties & {
	readonly children?: JSX.Element;
};

type FrameProperties = PropsWithChildren<{ readonly position: UDim2 }>;

function Frame(props: FrameProperties): JSX.Element {
	return <div>{props.children}</div>;
}
`,
				errors: [{ messageId: "manualChildrenProperty" }],
			},
		],
		valid: [
			{
				code: `
import type { PropertiesWithChildren as Wrapper } from "react";

type AliasWrapper<TProps> = Wrapper<TProps>;
type FrameProperties = AliasWrapper<{ readonly position: UDim2 }>;

function Frame(props: FrameProperties): JSX.Element {
	return <div>{props.children}</div>;
}
`,
			},
			{
				code: `
import type { PropertiesWithChildren as Wrapper } from "react";

interface SharedFrameProps extends Wrapper<{ readonly position: UDim2 }> {}

				function Frame(props: SharedFrameProps): JSX.Element {
	return <div>{props.children}</div>;
}
`,
			},
			{
				code: `
import type { PropsWithChildren } from "react";

const Frame = (props: PropsWithChildren<{ readonly position: UDim2 }>): JSX.Element => {
	return <div>{props.children}</div>;
};
`,
				options: [{ mode: "accurate", wrapperNames: ["PropsWithChildren"] }],
			},
			{
				code: `
type CustomChildren<TProperties> = TProperties & {
	readonly children?: JSX.Element;
};

function Frame(props: CustomChildren<{ readonly position: UDim2 }>): JSX.Element {
	return <div>{props.children}</div>;
}
`,
				options: [{ mode: "accurate", wrapperNames: ["CustomChildren"] }],
			},
			{
				code: `
type LoopA = LoopB;
type LoopB = LoopA;

function Frame(props: LoopA): JSX.Element {
	return <div>{props}</div>;
}
`,
				options: [{ mode: "accurate" }],
			},
			{
				code: `
function Frame(props: string): JSX.Element {
	return <div>{props}</div>;
}
`,
				options: [{ mode: "accurate" }],
			},
			{
				code: `
type ImportedProperties = React.ReactNode;

function Frame(props: ImportedProperties): JSX.Element {
	return <div>{props}</div>;
}
`,
				options: [{ mode: "accurate" }],
			},
			{
				code: `
interface FrameProperties extends MissingBase {
	readonly position: UDim2;
}

function Frame(props: FrameProperties): JSX.Element {
	return <div>{props.position}</div>;
}
`,
				options: [{ mode: "accurate" }],
			},
			{
				code: `
type FrameProperties = MissingProperties;

function Frame(props: FrameProperties): JSX.Element {
	return <div>{props}</div>;
}
`,
				options: [{ mode: "accurate" }],
			},
			{
				code: `
import type { ReactNode } from "react";

interface FrameProperties {
	readonly position: UDim2;
	readonly children?: ReactNode;
}

export default function(props: FrameProperties): JSX.Element {
	return <div>{props.children}</div>;
}
`,
				options: [{ mode: "accurate" }],
			},
			{
				code: `
type FrameProperties = {
	getChildren(): JSX.Element;
};

function Frame(props: FrameProperties): JSX.Element {
	return <div>{props.getChildren()}</div>;
}
`,
				options: [{ mode: "accurate" }],
			},
			{
				code: `
function Frame(): JSX.Element {
	return <div />;
}
`,
				options: [{ mode: "accurate" }],
			},
			{
				code: `
type FrameProperties = {
	readonly position: UDim2;
};

function Frame(props: FrameProperties): JSX.Element {
	return <div>{props.position}</div>;
}
`,
				options: [{ mode: "accurate" }],
			},
			{
				code: `
class FrameProperties {
	readonly position = new UDim2();
}

function Frame(props: FrameProperties): JSX.Element {
	return <div>{props.position}</div>;
}
`,
				options: [{ mode: "accurate" }],
			},
			{
				code: `
const Frame = 1;
const Button = () => <div />;
`,
				options: [{ mode: "accurate" }],
			},
			{
				code: `
let Frame;
const { Button } = components;
`,
				options: [{ mode: "accurate" }],
			},
		],
	});
});
