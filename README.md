# eslint-cease-nonsense-rules

An ESLint plugin that catches common mistakes before they reach production. This collection of rules helps prevent patterns that lead to bugs, performance issues, and maintainability problems.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [Rules](#rules)
  - [Type Safety](#type-safety)
  - [React](#react)
  - [Logging](#logging)
  - [Resource Management](#resource-management)
  - [Code Quality](#code-quality)
  - [Performance](#performance)
  - [Module Boundaries](#module-boundaries)
  - [TypeScript](#typescript)
- [License](#license)

## Installation

```bash
bun add -D @pobammer-ts/eslint-cease-nonsense-rules
```

## Usage

### Basic Setup

Add the plugin to your ESLint configuration:

```typescript
import ceaseNonsense from "@pobammer-ts/eslint-cease-nonsense-rules";

export default [
	{
		plugins: {
			"cease-nonsense": ceaseNonsense,
		},
		rules: {
			// Enable all rules (recommended)
			"cease-nonsense/ban-instances": "error",
			"cease-nonsense/ban-react-fc": "error",
			"cease-nonsense/enforce-ianitor-check-type": "error",
			"cease-nonsense/fast-format": "error",
			"cease-nonsense/no-array-size-assignment": "error",
			"cease-nonsense/no-async-constructor": "error",
			"cease-nonsense/no-color3-constructor": "error",
			"cease-nonsense/no-commented-code": "error",
			"cease-nonsense/no-god-components": "error",
			"cease-nonsense/no-identity-map": "error",
			"cease-nonsense/no-instance-methods-without-this": "error",
			"cease-nonsense/no-memo-children": "error",
			"cease-nonsense/no-print": "error",
			"cease-nonsense/prefer-enum-item": "error",
			"cease-nonsense/prefer-enum-member": "error",
			"cease-nonsense/no-shorthand-names": "error",
			"cease-nonsense/no-unused-imports": "error",
			"cease-nonsense/no-unused-use-memo": "error",
			"cease-nonsense/no-useless-use-spring": "error",
			"cease-nonsense/no-warn": "error",
			"cease-nonsense/prefer-class-properties": "error",
			"cease-nonsense/prefer-early-return": "error",
			"cease-nonsense/prefer-module-scope-constants": "error",
			"cease-nonsense/prefer-pascal-case-enums": "error",
			"cease-nonsense/prefer-pattern-replacements": "error",
			"cease-nonsense/prefer-sequence-overloads": "error",
			"cease-nonsense/prefer-singular-enums": "error",
			"cease-nonsense/prefer-udim2-shorthand": "error",
			"cease-nonsense/react-hooks-strict-return": "error",
			"cease-nonsense/require-module-level-instantiation": "error",
			"cease-nonsense/require-named-effect-functions": "error",
			"cease-nonsense/require-paired-calls": "error",
			"cease-nonsense/require-react-component-keys": "error",
			"cease-nonsense/require-react-display-names": "error",
			"cease-nonsense/prefer-read-only-props": "error",
			"cease-nonsense/strict-component-boundaries": "error",
			"cease-nonsense/use-exhaustive-dependencies": "error",
			"cease-nonsense/use-hook-at-top-level": "error",
		},
	},
];
```

### Using the Preset

```typescript
export default [ceaseNonsense.configs.recommended];
```

## Rules

### Type Safety

#### `enforce-ianitor-check-type`

Enforces `Ianitor.Check<T>` type annotations on complex TypeScript types to ensure runtime validation.

Calculates structural complexity of types and requires Ianitor validators when complexity exceeds thresholds.

**Configuration**

```typescript
{
  "cease-nonsense/enforce-ianitor-check-type": ["error", {
    "baseThreshold": 10,      // Minimum complexity to require validation
    "warnThreshold": 15,      // Warning threshold
    "errorThreshold": 25,     // Error threshold
    "interfacePenalty": 20,   // Complexity penalty for interfaces
    "performanceMode": true   // Enable performance optimizations
  }]
}
```

**❌ Bad**

```typescript
// Complex type without runtime validation
type UserConfig = {
	id: number;
	name: string;
	settings: {
		theme: string;
		notifications: boolean;
	};
};

const config = getUserConfig(); // No runtime check!
```

**✅ Good**

```typescript
const userConfigValidator = Ianitor.interface({
	id: Ianitor.number(),
	name: Ianitor.string(),
	settings: Ianitor.interface({
		theme: Ianitor.string(),
		notifications: Ianitor.boolean(),
	}),
});

type UserConfig = Ianitor.Static<typeof userConfigValidator>;

const config = userConfigValidator.check(getUserConfig());
```

#### `prefer-enum-item`

Enforce using EnumItem values instead of string or number literals when the type expects an EnumItem. Provides type safety and avoids magic values in roblox-ts code.

**Configuration**

```typescript
{
  "cease-nonsense/prefer-enum-item": ["error", {
    "fixNumericToValue": false,  // When true, numbers fix to Enum.X.Y.Value
    "performanceMode": false     // When true, cache enum lookups
  }]
}
```

**❌ Bad**

```typescript
// Magic string
<uiflexitem FlexMode="Fill" />

// Magic number
const props: ImageProps = { ScaleType: 1 };
```

**✅ Good**

```typescript
// Explicit enum
<uiflexitem FlexMode={Enum.UIFlexMode.Fill} />

// Explicit enum in object
	const props: ImageProps = { ScaleType: Enum.ScaleType.Slice };
```

#### `prefer-enum-member`

Enforce using enum member references instead of raw string or number values when the type expects a TypeScript enum. Covers both `enum` and `const enum`, including object literal keys used with mapped types like `Record<Color, T>`.

**Configuration**

```typescript
{
  "cease-nonsense/prefer-enum-member": "error"
}
```

**❌ Bad**

```typescript
enum Color {
	Blue = "Blue",
	Green = "Green",
}

const meta: Record<Color, number> = {
	Blue: 1,
	Green: 2,
};

const selected: Color = "Blue";
```

**✅ Good**

```typescript
enum Color {
	Blue = "Blue",
	Green = "Green",
}

const meta: Record<Color, number> = {
	[Color.Blue]: 1,
	[Color.Green]: 2,
};

const selected: Color = Color.Blue;
```

#### `require-serialized-numeric-data-type`

Require specific serialized numeric data types (`DataType.*`) instead of generic `number` for ECS components and other serialization contexts.

**Configuration**

```typescript
{
  "cease-nonsense/require-serialized-numeric-data-type": ["error", {
    "mode": "type-arguments",           // "type-arguments" (default) or "all"
    "functionNames": ["registerComponent"],  // Functions to check in type-arguments mode
    "strict": false                     // Enable type checker resolution for aliases
  }]
}
```

**❌ Bad**

```typescript
// Generic number type
export const Wave = registerComponent<number>({ replicated: true });

// Object with number property
export const WaveTime = registerComponent<{ elapsed: number }>({ replicated: true });
```

**✅ Good**

```typescript
import type { DataType } from "@rbxts/flamework-binary-serializer";

// Specific DataType variants
export const Wave = registerComponent<DataType.u8>({ replicated: true });
export const WaveTime = registerComponent<DataType.f32>({ replicated: true });
export const Yen = registerComponent<DataType.u32>({ replicated: true });

// Object with DataType properties
export const Position = registerComponent<{
	x: DataType.f32;
	y: DataType.f32;
	z: DataType.f32;
}>({ replicated: true });
```

#### `no-unused-imports`

Disallow unused imports. Uses ESLint's scope analysis to detect unused imports and optionally checks JSDoc comments for references.

**Configuration**

```typescript
{
  "cease-nonsense/no-unused-imports": ["error", {
    "checkJSDoc": true  // Check if imports are referenced in JSDoc comments
  }]
}
```

**Features**

- ✨ Has auto-fix
- Cached JSDoc comment parsing per file
- Pre-compiled regex patterns
- Efficient scope analysis using ESLint's built-in mechanisms

**❌ Bad**

```typescript
import { unusedFunction } from "./utils";
import { AnotherUnused } from "./types";

// unusedFunction and AnotherUnused are never used
```

**✅ Good**

```typescript
import { usedFunction } from "./utils";

usedFunction();

// Or used in JSDoc
/**
 * @see {usedFunction}
 */
```

### React

#### `ban-react-fc`

Bans React.FC and similar component type annotations. Use explicit function declarations instead.

React.FC types break debug information in React DevTools and encourage poor patterns.

**❌ Bad**

```typescript
export const MyComponent: React.FC<Props> = ({ children }) => {
  return <div>{children}</div>;
};

const Button: FC<ButtonProps> = ({ label }) => <button>{label}</button>;

const Modal: React.FunctionComponent = () => <div>Modal</div>;

const Input: VFC = () => <input />;
```

**✅ Good**

```typescript
export function MyComponent({ children }: Props) {
  return <div>{children}</div>;
}

function Button({ label }: ButtonProps) {
  return <button>{label}</button>;
}

function Modal() {
  return <div>Modal</div>;
}

function Input() {
  return <input />;
}
```

#### `no-memo-children`

Disallow `React.memo` on components that accept a `children` prop, since children typically change on every render and defeat memoization.

**Why**

`React.memo` performs a shallow comparison of props. When a component accepts `children`, the `children` prop is typically a new JSX element on every parent render. This causes the shallow comparison to fail every time, making `memo` useless while adding overhead.

**Configuration**

```typescript
{
  "cease-nonsense/no-memo-children": ["error", {
    "allowedComponents": ["Modal", "Drawer"],  // Allow specific components
    "environment": "roblox-ts"                  // or "standard"
  }]
}
```

**❌ Bad**

```typescript
import { memo, ReactNode } from "@rbxts/react";

interface CardProps {
	readonly title: string;
	readonly children?: ReactNode;
}

// memo is useless - children change every render
const Card = memo<CardProps>(({ title, children }) => {
	return (
		<frame>
			<textlabel Text={title} />
			{children}
		</frame>
	);
});
```

**✅ Good**

```typescript
import { memo, ReactNode } from "@rbxts/react";

// Option 1: Remove memo if you need children
interface CardProps {
	readonly title: string;
	readonly children?: ReactNode;
}

function Card({ title, children }: CardProps) {
	return (
		<frame>
			<textlabel Text={title} />
			{children}
		</frame>
	);
}

// Option 2: Use render prop instead of children
interface ListProps<T> {
	readonly items: ReadonlyArray<T>;
	readonly renderItem: (item: T) => ReactNode;
}

const List = memo(<T,>({ items, renderItem }: ListProps<T>) => {
	return <frame>{items.map(renderItem)}</frame>;
});
```

#### `no-unused-use-memo`

Disallow standalone `useMemo` calls that ignore the memoized value.

**Why**

`useMemo` is for deriving values. When you call it as a standalone statement, you are running side effects in the wrong
hook and often trying to bypass effect-related rules. Use `useEffect` for side effects.

**Configuration**

```typescript
{
  "cease-nonsense/no-unused-use-memo": ["error", {
    "environment": "roblox-ts" // or "standard"
  }]
}
```

**❌ Bad**

```typescript
import { useMemo } from "react";

useMemo(() => {
	trackAnalytics();
}, [eventName]);
```

**✅ Good**

```typescript
import { useEffect, useMemo } from "react";

useEffect(() => {
	trackAnalytics();
}, [eventName]);

const config = useMemo(() => buildConfig(eventName), [eventName]);
```

#### `no-useless-use-effect` (Experimental)

Disallow effects that only derive state, reset or adjust state from properties, notify parents, or route event flags.

**Why**

`useEffect` is for synchronizing with external systems. If an effect only sets local state based on properties or state,
only calls a property callback, or only runs because a state flag was toggled, it adds extra renders without providing
real synchronization.

**Configuration**

```typescript
{
  "cease-nonsense/no-useless-use-effect": ["error", {
    "environment": "roblox-ts", // or "standard"
    "hooks": ["useEffect", "useLayoutEffect", "useInsertionEffect"],
    "reportDerivedState": true,
    "reportNotifyParent": true,
    "reportEventFlag": true,
    "propertyCallbackPrefixes": ["on"]
  }]
}
```

**❌ Bad**

```typescript
import { useEffect, useState } from "@rbxts/react";

function Profile(properties) {
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    setFullName(`${properties.first} ${properties.last}`);
  }, [properties.first, properties.last]);
}

function Form(properties) {
  useEffect(() => {
    properties.onChange(properties.value);
  }, [properties.value, properties.onChange]);
}

function SubmitButton() {
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!submitted) return;
    submitForm();
    setSubmitted(false);
  }, [submitted]);
}
```

**✅ Good**

```typescript
function Profile(properties) {
  const fullName = `${properties.first} ${properties.last}`;
  return <textlabel Text={fullName} />;
}

function Form(properties) {
  function handleSubmit() {
    properties.onChange(properties.value);
  }

  return <textbutton Event={{ Activated: handleSubmit }} />;
}

function SubmitButton() {
  function handleSubmit() {
    submitForm();
  }

  return <textbutton Event={{ Activated: handleSubmit }} />;
}
```

#### `no-god-components`

Flags React components that are too large or doing too much, encouraging better separation of concerns.

**Default thresholds**

- Component body line count: target `120`, hard max `200`
- TSX nesting depth ≤ `3`
- Stateful hooks ≤ `5`
- Destructured props in parameters ≤ `5`
- Runtime `null` literals are always banned

**Configuration**

```typescript
{
  "cease-nonsense/no-god-components": ["error", {
    targetLines: 120,
    maxLines: 200,
    maxTsxNesting: 3,
    maxStateHooks: 5,
    stateHooks: ["useState", "useReducer", "useBinding"],
    maxDestructuredProps: 5,
    enforceTargetLines: true,
    ignoreComponents: ["LegacyComponent"]
  }]
}
```

#### `require-react-component-keys`

Enforces key props on all React elements except top-level returns from components.

**Configuration**

```typescript
{
  "cease-nonsense/require-react-component-keys": ["error", {
    "allowRootKeys": false,                    // Allow keys on root returns
    "ignoreCallExpressions": ["ReactTree.mount"] // Functions to ignore
  }]
}
```

**❌ Bad**

```typescript
function UserList({ users }) {
  return (
    <div>
      {users.map(user => (
        <UserCard user={user} /> // Missing key!
      ))}
    </div>
  );
}
```

**✅ Good**

```typescript
function UserList({ users }) {
  return (
    <div>
      {users.map(user => (
        <UserCard key={user.id} user={user} />
      ))}
    </div>
  );
}
```

#### `require-named-effect-functions`

Enforce named effect functions for better debuggability. Prevent inline arrow functions in `useEffect` and similar hooks.

**Behavior by environment**

- `roblox-ts` (default): Only identifiers allowed (e.g., `useEffect(onTick, [...])`)
- `standard`: Identifiers and named function expressions allowed

**Configuration**

```typescript
{
  "cease-nonsense/require-named-effect-functions": ["error", {
    "environment": "roblox-ts", // or "standard"
    "hooks": ["useEffect", "useLayoutEffect", "useInsertionEffect"]
  }]
}
```

**❌ Bad**

```typescript
// Arrow function
useEffect(() => {
	doThing();
}, [dep]);

// Anonymous function expression
useEffect(
	function () {
		doThing();
	},
	[dep],
);
```

**✅ Good**

```typescript
// Preferred: reference a named function
function onDepChange() {
	doThing();
}
useEffect(onDepChange, [dep]);

// Allowed in `standard` mode
useEffect(
	function onDepChange() {
		doThing();
	},
	[dep],
);
```

#### `use-exhaustive-dependencies`

Enforces exhaustive and correct dependency specification in React hooks to prevent stale closures and unnecessary re-renders.

**Configuration**

```typescript
{
  "cease-nonsense/use-exhaustive-dependencies": ["error", {
    "reportMissingDependenciesArray": true,
    "reportUnnecessaryDependencies": true,
    "hooks": [
      {
        "name": "useCustomHook",
        "closureIndex": 0,
        "dependenciesIndex": 1,
        "stableResult": true
      }
    ]
  }]
}
```

**❌ Bad**

```typescript
function UserProfile({ userId }) {
	const [user, setUser] = useState(null);

	useEffect(() => {
		fetchUser(userId).then(setUser);
	}, []); // Missing userId dependency!
}
```

**✅ Good**

```typescript
function UserProfile({ userId }) {
	const [user, setUser] = useState(null);

	useEffect(() => {
		fetchUser(userId).then(setUser);
	}, [userId]);
}
```

#### `no-useless-use-spring`

Flags `useSpring`-style hooks that never change (static config plus non-updating deps).

**Configuration**

```typescript
{
  "cease-nonsense/no-useless-use-spring": ["error", {
    "springHooks": ["useSpring", "useMotion"],
    "treatEmptyDepsAsViolation": true
  }]
}
```

**❌ Bad**

```typescript
const spring = useSpring({ opacity: 1 }, []);
```

**✅ Good**

```typescript
const spring = useSpring({ opacity: isOpen ? 1 : 0 }, [isOpen]);
```

#### `use-hook-at-top-level`

Enforces that React hooks are only called at the top level of components or custom hooks, never conditionally or in nested functions.

**Configuration**

```typescript
{
  "cease-nonsense/use-hook-at-top-level": ["error", {
    // Strategy 1: Ignore hooks by name
    "ignoreHooks": ["useEntity", "useComponent"],

    // Strategy 2: Control by import source
    "importSources": {
      "react": true,           // Check hooks from React
      "my-ecs-library": false  // Ignore ECS hooks
    },

    // Strategy 3: Whitelist mode
    "onlyHooks": ["useState", "useEffect", "useContext"]
  }]
}
```

**❌ Bad**

```typescript
function UserProfile({ userId }) {
	if (userId) {
		useEffect(() => {
			// Hook in conditional!
			fetchUser(userId);
		}, [userId]);
	}
}
```

**✅ Good**

```typescript
function UserProfile({ userId }) {
	useEffect(() => {
		if (userId) {
			fetchUser(userId);
		}
	}, [userId]);
}
```

#### `require-react-display-names`

Require `displayName` property on exported `React.memo` components and `React.createContext` contexts for better debugging.

**Configuration**

```typescript
{
  "cease-nonsense/require-react-display-names": ["error", {
    "environment": "roblox-ts"  // or "standard" for regular React
  }]
}
```

**❌ Bad**

```typescript
import { memo } from "@rbxts/react";

function CoolFrameNoMemo() {
	return <frame />;
}

// Direct export without displayName
export default memo(CoolFrameNoMemo);
```

```typescript
import React from "@rbxts/react";

// Missing displayName
const ErrorBoundaryContext = React.createContext<unknown>(undefined);
export default ErrorBoundaryContext;
```

**✅ Good**

```typescript
import { memo } from "@rbxts/react";

function CoolFrameNoMemo() {
	return <frame />;
}

export const CoolFrame = memo(CoolFrameNoMemo);
CoolFrame.displayName = "CoolFrame";
export default CoolFrame;
```

```typescript
import React from "@rbxts/react";

const ErrorBoundaryContext = React.createContext<unknown>(undefined);
ErrorBoundaryContext.displayName = "ErrorBoundaryContext";
export default ErrorBoundaryContext;
```

#### `prefer-read-only-props`

Enforce that React component props are typed as `readonly` in TypeScript, preventing accidental mutation of props.

**Features**

- ✨ Has auto-fix
- Direct AST pattern matching (no global component analysis)
- Component detection caching
- Focused on common React component patterns

**❌ Bad**

```typescript
interface Props {
	name: string;
	age: number;
}

function Component({ name, age }: Props) {
	// ...
}
```

**✅ Good**

```typescript
interface Props {
	readonly name: string;
	readonly age: number;
}

function Component({ name, age }: Props) {
	// ...
}
```

#### `react-hooks-strict-return`

React hooks must return a tuple of ≤2 elements or a single object. Prevents unwieldy hook return types.

**❌ Bad**

```typescript
function useMyHook() {
	return [a, b, c]; // 3+ elements
}

function useData() {
	const items = [1, 2, 3];
	return items; // Variable reference to 3+ element array
}
```

**✅ Good**

```typescript
function useMyHook() {
	return [state, setState]; // 2 elements max
}

function useData() {
	return { a, b, c }; // Objects are fine regardless of size
}
```

### Logging

#### `no-print`

Bans use of `print()` function calls. Use `Log` instead.

**❌ Bad**

```typescript
print("Debug message");
```

**✅ Good**

```typescript
Log.info("Debug message");
```

#### `no-warn`

Bans use of `warn()` function calls. Use `Log` instead.

**❌ Bad**

```typescript
warn("Warning message");
```

**✅ Good**

```typescript
Log.warn("Warning message");
```

### Resource Management

#### `require-paired-calls`

Enforces that paired function calls (opener/closer) are properly balanced across all execution paths with LIFO ordering.

**Configuration**

```typescript
{
  "cease-nonsense/require-paired-calls": ["error", {
    "pairs": [{
      "opener": "debug.profilebegin",
      "closer": "debug.profileend",
      "alternatives": ["db.rollback"],
      "requireSync": true,
      "platform": "roblox",
      "yieldingFunctions": [
        "task.wait",
        "*.WaitForChild"
      ]
    }],
    "allowConditionalClosers": false,
    "allowMultipleOpeners": true,
    "maxNestingDepth": 0
  }]
}
```

**Pair configuration options**

- `opener` (required): Function name that starts the paired operation
- `openerAlternatives` (optional): Additional opener names sharing the same closer
- `closer` (required): Function name(s) that close the operation
- `alternatives` (optional): Alternative closers for error paths
- `requireSync` (optional): Disallow `await`/`yield` between opener and closer
- `platform` (optional): Enables `"roblox"`-specific behavior
- `yieldingFunctions` (optional): Custom patterns for Roblox yielding functions (supports wildcards)

**Top-level options**

- `pairs` (required): Array of pair configurations
- `allowConditionalClosers` (optional): Allow closers in some but not all branches
- `allowMultipleOpeners` (optional): Allow consecutive opener calls
- `maxNestingDepth` (optional): Maximum nesting depth (0 = unlimited)

**Default configuration (Roblox profiling)**

```typescript
{
  "cease-nonsense/require-paired-calls": ["error", {
    "pairs": [{
      "opener": "debug.profilebegin",
      "closer": "debug.profileend",
      "platform": "roblox",
      "requireSync": true,
      "yieldingFunctions": ["task.wait", "wait", "*.WaitForChild"]
    }]
  }]
}
```

**❌ Bad**

```typescript
// Missing closer on early return
function test() {
	debug.profilebegin("task");
	if (error) return; // Never closed on this path
	debug.profileend();
}

// Wrong LIFO order
function test() {
	debug.profilebegin("outer");
	debug.profilebegin("inner");
	debug.profileend(); // closes inner
	// outer is never closed
}

// Async operation with requireSync
async function test() {
	debug.profilebegin("task");
	await fetch("/api");
	debug.profileend();
}
```

**✅ Good**

```typescript
// Simple pairing
function test() {
	debug.profilebegin("task");
	doWork();
	debug.profileend();
}

// Proper LIFO nesting
function test() {
	debug.profilebegin("outer");
	debug.profilebegin("inner");
	debug.profileend();
	debug.profileend();
}

// Try-finally ensures closer on all paths
function test() {
	debug.profilebegin("task");
	try {
		riskyOperation();
	} finally {
		debug.profileend();
	}
}
```

**Real-world examples**

```typescript
// Database transactions
{
  "pairs": [{
    "opener": "db.transaction",
    "closer": "db.commit",
    "alternatives": ["db.rollback"]
  }]
}

// Lock acquire/release
{
  "pairs": [{
    "opener": "lock.acquire",
    "closer": ["lock.release", "lock.free"]
  }]
}

// Roblox Iris widgets
{
  "pairs": [{
    "opener": "Iris.CollapsingHeader",
    "openerAlternatives": ["Iris.Window", "Iris.TreeNode", "Iris.Table"],
    "closer": "Iris.End",
    "platform": "roblox",
    "requireSync": true
  }]
}
```

### Code Quality

#### `ban-instances`

Bans specified Roblox Instance classes in `new Instance()` calls and JSX elements.

**Configuration**

```typescript
// Array format (default message)
{
  "cease-nonsense/ban-instances": ["error", {
    "bannedInstances": ["Part", "Script", "LocalScript"]
  }]
}

// Object format (custom messages)
{
  "cease-nonsense/ban-instances": ["error", {
    "bannedInstances": {
      "Part": "Use MeshPart instead for better performance",
      "Script": "Scripts should not be created at runtime"
    }
  }]
}
```

**❌ Bad**

```typescript
// With config: { bannedInstances: ["Part", "Script"] }
const part = new Instance("Part");
const script = new Instance("Script");

// JSX (lowercase = Roblox Instance)
<part Size={new Vector3(1, 1, 1)} />
```

**✅ Good**

```typescript
const meshPart = new Instance("MeshPart");
<meshpart Size={new Vector3(1, 1, 1)} />
```

#### `fast-format`

Enforces oxfmt code formatting. Reports INSERT, DELETE, and REPLACE operations for formatting differences.

**Features**

- ✨ Has auto-fix
- Uses an LRU cache to avoid re-formatting unchanged files

#### `no-async-constructor`

Disallows asynchronous operations inside class constructors.

**Why**

Constructors return immediately, so async work causes race conditions, unhandled rejections, and incomplete object states.

**Detected violations**

- `await` expressions
- Promise chains (`.then()`, `.catch()`, `.finally()`)
- Async IIFEs (`(async () => {})()`)
- Unhandled async method calls (`this.asyncMethod()`)
- Orphaned promises (`const p = this.asyncMethod()`)

**❌ Bad**

```typescript
class UserService {
	constructor() {
		await this.initialize(); // Direct await
		this.loadData().then((data) => (this.data = data)); // Promise chain
		(async () => {
			await this.setup();
		})(); // Async IIFE
	}

	async initialize() {
		/* ... */
	}
	async loadData() {
		/* ... */
	}
	async setup() {
		/* ... */
	}
}
```

**✅ Good**

```typescript
class UserService {
	private initPromise: Promise<void>;

	constructor() {
		this.initPromise = this.initialize();
	}

	async initialize() {
		/* ... */
	}

	// Factory pattern
	static async create(): Promise<UserService> {
		const service = new UserService();
		await service.initPromise;
		return service;
	}
}
```

#### `no-commented-code`

Detects and reports commented-out code.

**Features**

- 💡 Has suggestions
- Groups adjacent line comments and block comments
- Uses heuristic detection combined with parsing to minimize false positives

**❌ Bad**

```typescript
function calculate(x: number) {
	// const result = x * 2;
	// return result;

	/* if (x > 10) {
    return x;
  } */

	return x + 1;
}
```

**✅ Good**

```typescript
function calculate(x: number) {
	// TODO: Consider multiplying by 2 instead
	// Note: This is a simplified version
	return x + 1;
}
```

#### `no-identity-map`

Bans pointless identity `.map()` calls that return the parameter unchanged.

**Features**

- ✨ Has auto-fix
- Context-aware messages for Bindings vs Arrays

**❌ Bad**

```typescript
// Bindings
const result = scaleBinding.map((value) => value);

// Arrays - pointless shallow copy
const copied = items.map((item) => item);
```

**✅ Good**

```typescript
// Bindings - use directly
const result = scaleBinding;

// Arrays - use table.clone or spread
const copied = table.clone(items);
const copied2 = [...items];

// Actual transformations are fine
const doubled = items.map((x) => x * 2);
```

**Configuration**

```typescript
{
  "cease-nonsense/no-identity-map": ["error", {
    "bindingPatterns": ["binding"]  // Case-insensitive patterns
  }]
}
```

#### `prevent-abbreviations`

Prevent abbreviations in variable and property names. Provides suggestions for replacements and can automatically fix single-replacement cases.

**Configuration**

```typescript
{
  "cease-nonsense/prevent-abbreviations": ["error", {
    "checkFilenames": true,
    "checkProperties": false,
    "checkVariables": true,
    "replacements": {},
    "allowList": {},
    "ignore": []
  }]
}
```

**Features**

- ✨ Has auto-fix (for single replacements)
- Aggressive caching of word and name replacements
- Pre-compiled regex patterns
- Early exits for constants and allow-listed names

**❌ Bad**

```typescript
const err = new Error();
const fn = () => {};
const dist = calculateDistance();
```

**✅ Good**

```typescript
const error = new Error();
const func = () => {};
const distance = calculateDistance();
```

#### `no-shorthand-names`

Bans shorthand variable names in favor of descriptive full names.

**Features**

- Matches shorthands within compound identifiers (e.g., `plrData` → `playerData`)
- Supports glob patterns (`*`, `?`) for flexible matching
- Supports regex patterns (`/pattern/flags`) for advanced matching
- Automatically ignores import specifiers (external packages control their naming)

**Default mappings**

- `plr` → `player` (or `localPlayer` for `Players.LocalPlayer`)
- `args` → `parameters`
- `dt` → `deltaTime`
- `char` → `character`

**Configuration**

```typescript
{
  "cease-nonsense/no-shorthand-names": ["error", {
    "shorthands": {
      "plr": "player",
      "*Props": "*Properties"
    },
    "allowPropertyAccess": ["char", "Props"],  // Allow as property/qualified name
    "ignoreShorthands": ["PropsWithoutRef"]    // Ignore completely
  }]
}
```

**Options**

- `shorthands`: Map of shorthand patterns to replacements (exact, glob `*`/`?`, or regex `/pattern/flags`)
- `allowPropertyAccess`: Words allowed in property access (`obj.prop`) or type qualified names (`React.Props`)
- `ignoreShorthands`: Words to ignore completely, regardless of context (supports same pattern syntax)

**Pattern syntax**

Glob patterns use `*` (any characters) and `?` (single character):

```typescript
{
  "shorthands": {
    "str*": "string*",         // strValue → stringValue
    "*Props": "*Properties",   // DataProps → DataProperties
    "*Btn*": "*Button*"        // myBtnClick → myButtonClick
  }
}
```

Regex patterns use `/pattern/flags` syntax:

```typescript
{
  "shorthands": {
    "/^str(.*)$/": "string$1",  // strName → stringName
    "/^props$/i": "properties"  // Props or props → properties
  }
}
```

**Compound identifier matching**

Identifiers are split at camelCase/PascalCase boundaries, and each word is checked independently:

- `propsData` with `{ "props": "properties" }` → `propertiesData`
- `UnitBoxBadgeInfoProps` with `{ "Props": "Properties" }` → `UnitBoxBadgeInfoProperties`

**❌ Bad**

```typescript
const plr = getPlayer();
const args = [1, 2, 3];
const dt = 0.016;
```

**✅ Good**

```typescript
const player = getPlayer();
const localPlayer = Players.LocalPlayer;
const parameters = [1, 2, 3];
const deltaTime = 0.016;
const model = entity.char; // Property access is allowed
```

#### `prefer-pattern-replacements`

Enforces replacement of verbose constructor/method patterns with simpler alternatives.

**Features**

- ✨ Has auto-fix
- Type-safe `pattern()` API with compile-time capture validation
- Supports captures (`$x`), optional args (`0?`), wildcards (`_`)
- Constant expression evaluation (`1 - 1` matches `0`)
- Same-variable matching (`$x, $x` requires identical arguments)
- Scope-aware: skips fix if replacement would shadow local variable

**Configuration**

```typescript
import { pattern } from "@pobammer-ts/eslint-cease-nonsense-rules";

{
  "cease-nonsense/prefer-pattern-replacements": ["error", {
    "patterns": [
      // Simple patterns
      pattern({
        match: "UDim2.fromScale(1, 1)",
        replacement: "oneScale"
      }),
      pattern({
        match: "UDim2.fromScale($x, $x)",
        replacement: "scale($x)"
      }),

      // Captures and conditions
      pattern({
        match: "new Vector2($x, $x)",
        replacement: "fromUniform($x)",
        when: { x: "!= 0" }
      }),

      // Optional args (0? matches 0 or missing)
      pattern({
        match: "new Vector2($x, 0?)",
        replacement: "fromX($x)"
      }),

      // Wildcards (match any value, don't capture)
      pattern({
        match: "new UDim2(_, 0, _, 0)",
        replacement: "UDim2.fromScale"
      })
    ]
  }]
}
```

**Pattern syntax**

- `$name` - Capture variable, stores value for replacement
- `0?` - Optional: matches literal `0` or missing argument
- `_` - Wildcard: matches any value, not captured
- `when` clause - Conditions on captures (`== 0`, `!= 0`, `> 5`, etc.)

**Ordering tip**

Put the most specific patterns first. For example, keep exact shorthands like
`UDim2.fromScale(1, 1)` before the general fallback
`UDim2.fromScale($x, $x)` so the specific ones win.

**Replacement types**

- Identifier: `oneScale`
- Static access: `Vector2.one`
- Call: `fromUniform($x)` or `Vector2.fromUniform($x, $y)`

**❌ Bad**

```typescript
const scale = UDim2.fromScale(1, 1);
const vec = new Vector2(5, 5);
const offset = new Vector2(10, 0);
```

**✅ Good**

```typescript
const scale = oneScale;
const vec = fromUniform(5);
const offset = fromX(10);
```

**Scope awareness**

The rule automatically skips fixes when the replacement would conflict with a local variable:

```typescript
function example() {
	const oneScale = 5; // Local variable shadows replacement
	const scale = UDim2.fromScale(1, 1); // No fix applied (would shadow)
}
```

#### `prefer-class-properties`

Prefer class properties over assignment of literals in constructors.

**Options:** `['always' | 'never']` (default: `'always'`)

**❌ Bad**

```typescript
class Foo {
	constructor() {
		this.bar = "literal"; // Assignment in constructor
		this.obj = { key: "value" };
	}
}
```

**✅ Good**

```typescript
class Foo {
	bar = "literal"; // Class property
	obj = { key: "value" };
}
```

#### `prefer-early-return`

Prefer early returns over full-body conditional wrapping in function declarations.

**Options:** `{ maximumStatements: number }` (default: `1`)

**❌ Bad**

```typescript
function foo() {
	if (condition) {
		doA();
		doB();
		doC();
	}
}
```

**✅ Good**

```typescript
function foo() {
	if (!condition) return;
	doA();
	doB();
	doC();
}
```

#### `prefer-module-scope-constants`

SCREAMING_SNAKE_CASE variables must be `const` at module scope.

**❌ Bad**

```typescript
let FOO = 1; // Not const
function bar() {
	const BAZ = 2; // Not module scope
}
```

**✅ Good**

```typescript
const FOO = 1; // Const at module scope

// Destructuring patterns are allowed anywhere
function bar() {
	const { FOO } = config;
}
```

### Performance

#### `no-color3-constructor`

Bans `new Color3(...)` except for `new Color3()` or `new Color3(0, 0, 0)`. Use `Color3.fromRGB()` instead.

**Features**

- ✨ Has auto-fix

**❌ Bad**

```typescript
const red = new Color3(255, 0, 0);
const blue = new Color3(0.5, 0.5, 1);
```

**✅ Good**

```typescript
const red = Color3.fromRGB(255, 0, 0);
const blue = Color3.fromRGB(127, 127, 255);
const black = new Color3(0, 0, 0); // Allowed
```

#### `no-array-size-assignment`

Disallow Roblox-style append assignment with `.size()` indexing. Prefer explicit append operations.

**Configuration**

```typescript
{
  "cease-nonsense/no-array-size-assignment": ["error", {
    "allowAutofix": false // When true, rewrites safe expression statements to .push(...)
  }]
}
```

**❌ Bad**

```typescript
inventory[inventory.size()] = item;
state.items[state.items.size()] = next;
```

**✅ Good**

```typescript
inventory.push(item);
state.items.push(next);
```

#### `prefer-udim2-shorthand`

Prefer `UDim2.fromScale()` or `UDim2.fromOffset()` when all offsets or all scales are zero.

**Features**

- ✨ Has auto-fix
- Leaves `new UDim2(0, 0, 0, 0)` alone

**❌ Bad**

```typescript
new UDim2(1, 0, 1, 0);
new UDim2(0, 100, 0, 50);
```

**✅ Good**

```typescript
UDim2.fromScale(1, 1);
UDim2.fromOffset(100, 50);
new UDim2(0, 0, 0, 0); // Allowed
```

#### `prefer-sequence-overloads`

Prefer the optimized `ColorSequence` and `NumberSequence` constructor overloads instead of building an array of `*SequenceKeypoint`s.

**Features**

- ✨ Has auto-fix
- Automatically collapses identical 0/1 endpoints

**❌ Bad**

```typescript
new ColorSequence([
	new ColorSequenceKeypoint(0, Color3.fromRGB(100, 200, 255)),
	new ColorSequenceKeypoint(1, Color3.fromRGB(255, 100, 200)),
]);

new NumberSequence([new NumberSequenceKeypoint(0, 0), new NumberSequenceKeypoint(1, 100)]);
```

**✅ Good**

```typescript
new ColorSequence(Color3.fromRGB(100, 200, 255), Color3.fromRGB(255, 100, 200));

new ColorSequence(Color3.fromRGB(255, 255, 255));

new NumberSequence(0, 100);

new NumberSequence(42);
```

#### `no-instance-methods-without-this`

Detects instance methods that don't use `this` and should be converted to standalone functions.

**Why**

In roblox-ts, instance methods create metatable objects with significant performance overhead. Methods that don't use `this` can be moved outside the class.

**Configuration**

```typescript
{
  "cease-nonsense/no-instance-methods-without-this": ["error", {
    "checkPrivate": true,   // Default: true
    "checkProtected": true, // Default: true
    "checkPublic": true     // Default: true
  }]
}
```

**❌ Bad**

```typescript
type OnChange = (currentValue: number, previousValue: number) => void;

class MyClass {
	private readonly onChanges = new Array<OnChange>();
	private value = 0;

	public increment(): void {
		const previousValue = this.value;
		const value = previousValue + 1;
		this.value = value;
		this.notifyChanges(value, previousValue); // Doesn't use this
	}

	private notifyChanges(value: number, previousValue: number): void {
		for (const onChange of this.onChanges) {
			onChange(value, previousValue);
		}
	}
}
```

**✅ Good**

```typescript
type OnChange = (currentValue: number, previousValue: number) => void;

function notifyChanges(value: number, previousValue: number, onChanges: ReadonlyArray<OnChange>): void {
	for (const onChange of onChanges) {
		onChange(value, previousValue);
	}
}

class MyClass {
	private readonly onChanges = new Array<OnChange>();
	private value = 0;

	public increment(): void {
		const previousValue = this.value;
		const value = previousValue + 1;
		this.value = value;
		notifyChanges(value, previousValue, this.onChanges);
	}
}
```

#### `require-module-level-instantiation`

Require certain classes to be instantiated at module level rather than inside functions.

Classes like Log should be instantiated once at module scope, not recreated on every function call.

**Configuration**

```typescript
{
  "cease-nonsense/require-module-level-instantiation": ["error", {
    "classes": {
      "Log": "@rbxts/rbxts-sleitnick-log",
      "Server": "@rbxts/net"
    }
  }]
}
```

**❌ Bad**

```typescript
import Log from "@rbxts/rbxts-sleitnick-log";

function useStoryModesState() {
	const log = new Log(); // Recreated on every call!
	log.Info("Create Match clicked");
}
```

**✅ Good**

```typescript
import Log from "@rbxts/rbxts-sleitnick-log";

const log = new Log(); // Module level - created once

function useStoryModesState() {
	log.Info("Create Match clicked");
}
```

#### `prefer-single-world-query`

Enforces combining multiple `world.get()` or `world.has()` calls on the same entity into a single call for better Jecs performance.

**Why**

In Jecs (a Roblox ECS library), calling `world.get()` or `world.has()` multiple times on the same entity results in multiple archetype lookups. Combining these calls improves performance by reducing lookups and cache misses.

**Features**

- ✨ Has auto-fix
- Detects consecutive `world.get()` calls on same world and entity
- Detects `world.has()` calls when ANDed together
- Merges up to 4 components per call (Jecs limit)

**❌ Bad**

```typescript
const position = world.get(entity, Position);
const velocity = world.get(entity, Velocity);
const health = world.get(entity, Health);
```

**✅ Good**

```typescript
const [position, velocity, health] = world.get(entity, Position, Velocity, Health);
```

### Module Boundaries

#### `strict-component-boundaries`

Prevent reaching into sibling component folders for nested modules.

**Options:** `{ allow: string[], maxDepth: number }` (default: `maxDepth: 1`)

**❌ Bad**

```typescript
// Reaching into another component's internals
import { helper } from "../OtherComponent/utils/helper";
import { thing } from "./components/Foo/internal";
```

**✅ Good**

```typescript
// Import from shared location
import { helper } from "../../shared/helper";

// Index import from component
import { OtherComponent } from "../OtherComponent";

// Direct component import (within maxDepth)
import { Foo } from "./components/Foo";
```

**Configuration**

```typescript
{
  "cease-nonsense/strict-component-boundaries": ["error", {
    "allow": ["components/\\w+$"],  // Regex patterns to allow
    "maxDepth": 2                    // Maximum import depth
  }]
}
```

### TypeScript

#### `naming-convention`

Enforce naming conventions for TypeScript constructs. Optimized for common use cases like interface prefix checking without requiring type checking.

**Configuration**

```typescript
{
  "cease-nonsense/naming-convention": ["error", {
    "custom": {
      "match": false,
      "regex": "^I[A-Z]"
    },
    "format": ["PascalCase"],
    "selector": "interface"
  }]
}
```

**Features**

- No type checking required (fast AST-only analysis)
- Pre-compiled regex patterns
- Focused on common use cases

**❌ Bad**

```typescript
// With custom: { match: false, regex: "^I[A-Z]" }
interface IUser {
	name: string;
}
```

**✅ Good**

```typescript
interface User {
	name: string;
}
```

#### `misleading-lua-tuple-checks`

Disallow the use of `LuaTuple` types directly in conditional expressions, which can be misleading. Requires explicit indexing (`[0]`) or array destructuring.

**Features**

- ✨ Has auto-fix
- Cached type queries per node
- WeakMap-based caching for `isLuaTuple` checks
- Cached constrained type lookups

**❌ Bad**

```typescript
// Direct LuaTuple in conditional
if (getLuaTuple()) {
	// ...
}

// LuaTuple in variable declaration
const result = getLuaTuple();
```

**✅ Good**

```typescript
// Explicit indexing
if (getLuaTuple()[0]) {
	// ...
}

// Array destructuring
const [result] = getLuaTuple();
```

#### `prefer-pascal-case-enums`

Enum names and members must be PascalCase.

**❌ Bad**

```typescript
enum my_enum {
	foo_bar,
}
enum MyEnum {
	FOO_BAR,
}
enum COLORS {
	red,
}
```

**✅ Good**

```typescript
enum MyEnum {
	FooBar,
}
enum Color {
	Red,
	Blue,
}
```

#### `prefer-singular-enums`

Enum names should be singular, not plural.

**❌ Bad**

```typescript
enum Colors {
	Red,
	Blue,
}
enum Commands {
	Up,
	Down,
}
enum Feet {
	Left,
	Right,
} // Irregular plural
```

**✅ Good**

```typescript
enum Color {
	Red,
	Blue,
}
enum Command {
	Up,
	Down,
}
enum Foot {
	Left,
	Right,
}
```

## License

MIT License - feel free to use this code however you want.
