import { describe, setDefaultTimeout } from "bun:test";
import { join } from "node:path";
import tsParser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import rule from "../../src/rules/no-memo-children";

// Type-aware tests have cold-start overhead from TypeScript project service initialization
setDefaultTimeout(30_000);

const fixturesDir = join(__dirname, "../fixtures/no-memo-children");

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser: tsParser,
		parserOptions: {
			ecmaFeatures: { jsx: true },
			projectService: {
				allowDefaultProject: ["*.ts", "*.tsx"],
				defaultProject: join(fixturesDir, "tsconfig.json"),
			},
			tsconfigRootDir: fixturesDir,
		},
		sourceType: "module",
	},
});

describe("no-memo-children", () => {
	// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
	ruleTester.run("no-memo-children", rule, {
		invalid: [
			// Direct children property
			{
				code: `
import { memo, ReactNode } from "@rbxts/react";

interface PropsWithKids {
    readonly id: string;
    readonly children?: ReactNode;
}

const MemoizedComponent = memo<PropsWithKids>((props) => null);`,
				errors: [{ messageId: "memoWithChildren" }],
			},
			// Using a component reference with children in props
			{
				code: `
import { memo, ReactNode } from "@rbxts/react";

interface ChildProps {
    readonly children?: ReactNode;
}

function ComponentWithChildren(props: ChildProps) { return null; }
const MemoizedComponent = memo(ComponentWithChildren);`,
				errors: [{ messageId: "memoWithChildren" }],
			},
			// Interface extends with children
			{
				code: `
import { memo, ReactNode } from "@rbxts/react";

interface BaseWithChildren {
    readonly children?: ReactNode;
}

interface ExtendedProps extends BaseWithChildren {
    readonly id: string;
}

const MemoizedComponent = memo<ExtendedProps>((props) => null);`,
				errors: [{ messageId: "memoWithChildren" }],
			},
			// Multi-level inheritance with children
			{
				code: `
import { memo, ReactNode } from "@rbxts/react";

interface GrandparentProps {
    readonly children?: ReactNode;
}

interface ParentProps extends GrandparentProps {
    readonly parentId: string;
}

interface ChildProps extends ParentProps {
    readonly childId: string;
}

const MemoizedComponent = memo<ChildProps>((props) => null);`,
				errors: [{ messageId: "memoWithChildren" }],
			},
			// Multi-level inheritance via component reference
			{
				code: `
import { memo, ReactNode } from "@rbxts/react";

interface GrandparentProps {
    readonly children?: ReactNode;
}

interface ParentProps extends GrandparentProps {
    readonly parentId: string;
}

interface ChildProps extends ParentProps {
    readonly childId: string;
}

function InheritedComponent(props: ChildProps) { return null; }
const MemoizedComponent = memo(InheritedComponent);`,
				errors: [{ messageId: "memoWithChildren" }],
			},
			// Intersection type with children
			{
				code: `
import { memo, ReactNode } from "@rbxts/react";

interface BaseProps {
    readonly id: string;
}

type IntersectionWithChildren = BaseProps & { readonly children?: ReactNode };

const MemoizedComponent = memo<IntersectionWithChildren>((props) => null);`,
				errors: [{ messageId: "memoWithChildren" }],
			},
			// Complex intersection with children
			{
				code: `
import { memo, ReactNode } from "@rbxts/react";

interface BaseProps {
    readonly id: string;
}

interface BaseWithChildren {
    readonly children?: ReactNode;
}

type ComplexIntersection = BaseProps & BaseWithChildren & { readonly extra: number };

const MemoizedComponent = memo<ComplexIntersection>((props) => null);`,
				errors: [{ messageId: "memoWithChildren" }],
			},
			// Union where one branch has children
			{
				code: `
import { memo, ReactNode } from "@rbxts/react";

interface BaseProps {
    readonly id: string;
}

interface PropsWithKids {
    readonly id: string;
    readonly children?: ReactNode;
}

type UnionWithChildren = BaseProps | PropsWithKids;

const MemoizedComponent = memo<UnionWithChildren>((props) => null);`,
				errors: [{ messageId: "memoWithChildren" }],
			},
			// Generic props with children
			{
				code: `
import { memo, ReactNode } from "@rbxts/react";

interface GenericProps<T> {
    readonly data: T;
    readonly children?: ReactNode;
}

const MemoizedComponent = memo<GenericProps<string>>((props) => null);`,
				errors: [{ messageId: "memoWithChildren" }],
			},
			// NOTE: PropsWithChildren<T> from module imports is a known limitation.
			// The generic type resolution through memo's return type doesn't always work.
			// Users should define their own intersection type instead.
			// Required children (not optional)
			{
				code: `
import { memo, ReactNode } from "@rbxts/react";

interface RequiredChildrenProps {
    id: string;
    children: ReactNode;
}

const MemoizedComponent = memo<RequiredChildrenProps>((props) => null);`,
				errors: [{ messageId: "memoWithChildren" }],
			},
			// Inline arrow function with children in props type
			{
				code: `
import { memo, ReactNode } from "@rbxts/react";

const MemoizedComponent = memo((props: { id: string; children?: ReactNode }) => null);`,
				errors: [{ messageId: "memoWithChildren" }],
			},
			// Function expression with children
			{
				code: `
import { memo, ReactNode } from "@rbxts/react";

interface PropsWithKids {
    readonly id: string;
    readonly children?: ReactNode;
}

const MemoizedComponent = memo(function MyComponent(props: PropsWithKids) { return null; });`,
				errors: [{ messageId: "memoWithChildren" }],
			},
			// React namespace import pattern
			{
				code: `
import React from "@rbxts/react";

interface PropsWithKids {
    readonly children?: React.ReactNode;
}

const MemoizedComponent = React.memo<PropsWithKids>((props) => null);`,
				errors: [{ messageId: "memoWithChildren" }],
			},
			// Aliased memo import
			{
				code: `
import { memo as memoize, ReactNode } from "@rbxts/react";

interface PropsWithKids {
    readonly children?: ReactNode;
}

const MemoizedComponent = memoize<PropsWithKids>((props) => null);`,
				errors: [{ messageId: "memoWithChildren" }],
			},
		],
		valid: [
			// No children - should be allowed
			{
				code: `
import { memo } from "@rbxts/react";

interface NoChildrenProps {
    readonly id: string;
    readonly value: number;
}

const MemoizedComponent = memo<NoChildrenProps>((props) => null);`,
			},
			// Component reference without children
			{
				code: `
import { memo } from "@rbxts/react";

interface SafeProps {
    readonly id: string;
}

function ComponentWithoutChildren(props: SafeProps) { return null; }
const MemoizedComponent = memo(ComponentWithoutChildren);`,
			},
			// Base props without children
			{
				code: `
import { memo } from "@rbxts/react";

interface BaseProps {
    readonly id: string;
    readonly name: string;
}

const MemoizedComponent = memo<BaseProps>((props) => null);`,
			},
			// Empty props
			{
				code: `
import { memo } from "@rbxts/react";

interface EmptyProps {}

const MemoizedComponent = memo<EmptyProps>((props) => null);`,
			},
			// Inline props without children
			{
				code: `
import { memo } from "@rbxts/react";

const MemoizedComponent = memo((props: { id: string; value: number }) => null);`,
			},
			// React namespace without children
			{
				code: `
import React from "@rbxts/react";

interface SafeProps {
    readonly id: string;
}

const MemoizedComponent = React.memo<SafeProps>((props) => null);`,
			},
			// Allowed component via options
			{
				code: `
import { memo, ReactNode } from "@rbxts/react";

interface PropsWithKids {
    readonly id: string;
    readonly children?: ReactNode;
}

const AllowedComponent = memo<PropsWithKids>((props) => null);`,
				options: [{ allowedComponents: ["AllowedComponent"] }],
			},
			// Standard environment
			{
				code: `
import { memo } from "react";

interface SafeProps {
    readonly id: string;
}

const MemoizedComponent = memo<SafeProps>((props) => null);`,
				options: [{ environment: "standard" }],
			},
			// Non-React memo function (different import)
			{
				code: `
function memo<T>(fn: T): T { return fn; }

interface PropsWithKids {
    readonly children?: unknown;
}

const MemoizedComponent = memo<PropsWithKids>((props) => null);`,
			},
			// Nested children property (not direct children prop)
			{
				code: `
import { memo, ReactNode } from "@rbxts/react";

interface NestedSlot {
    readonly slot: { readonly children?: ReactNode };
}

const MemoizedComponent = memo<NestedSlot>((props) => null);`,
			},
		],
	});
});
