# eslint-cease-nonsense-rules

An ESLint plugin that catches common mistakes before they reach production. This collection of rules helps prevent patterns that lead to bugs, performance issues, and maintainability problems.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [Rules](#rules)
  - [Type Safety](#type-safety)
  - [Roblox-TS](#roblox-ts)
  - [React](#react)
  - [Logging](#logging)
  - [Resource Management](#resource-management)
  - [Code Quality](#code-quality)
  - [Performance](#performance)
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
			"cease-nonsense/misleading-lua-tuple-checks": "error",
			"cease-nonsense/no-async-constructor": "error",
			"cease-nonsense/no-color3-constructor": "error",
			"cease-nonsense/no-commented-code": "error",
			"cease-nonsense/no-god-components": "error",
			"cease-nonsense/no-identity-map": "error",
			"cease-nonsense/no-instance-methods-without-this": "error",
			"cease-nonsense/no-print": "error",
			"cease-nonsense/no-shorthand-names": "error",
			"cease-nonsense/no-useless-use-spring": "error",
			"cease-nonsense/no-warn": "error",
			"cease-nonsense/prefer-sequence-overloads": "error",
			"cease-nonsense/prefer-udim2-shorthand": "error",
			"cease-nonsense/require-named-effect-functions": "error",
			"cease-nonsense/require-paired-calls": "error",
			"cease-nonsense/require-react-component-keys": "error",
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

### Roblox-TS

#### `misleading-lua-tuple-checks`

Detects misleading LuaTuple usage in conditional and logical expressions. LuaTuple (array) is always truthy in JavaScript, which can lead to bugs when checking the first element.

**Features**

- ✨ Has auto-fix
- Requires TypeScript type information (parserOptions.project)
- Multi-level caching for optimal performance

**Detected patterns**

- LuaTuple in if/while/for/do-while conditions
- LuaTuple in ternary expressions
- LuaTuple in logical expressions (&&, ||)
- LuaTuple in unary negation (!)
- LuaTuple variable declarations without destructuring
- LuaTuple assignments without destructuring

**❌ Bad**

```typescript
// LuaTuple in condition - always truthy!
const result = pcall(() => doSomething());
if (result) {
	// This always runs because arrays are truthy
	console.log("success");
}

// Assigning LuaTuple to a variable without destructuring
const tuple = getLuaTuple();

// Using LuaTuple in logical expressions
const check = pcall(() => {}) && true;
```

**✅ Good**

```typescript
// Destructure to get the success boolean
const [success, value] = pcall(() => doSomething());
if (success) {
	console.log("success", value);
}

// Or use index access in conditions
if (pcall(() => doSomething())[0]) {
	console.log("success");
}

// Proper destructuring
const [result] = getLuaTuple();

// Destructured values in logical expressions
const [success] = pcall(() => {});
const check = success && true;
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

#### `no-shorthand-names`

Bans shorthand variable names in favor of descriptive full names.

**Default mappings**

- `plr` → `player` (or `localPlayer` for `Players.LocalPlayer`)
- `args` → `parameters`
- `dt` → `deltaTime`
- `char` → `character`
- `btn` → `button`

**Configuration**

```typescript
{
  "cease-nonsense/no-shorthand-names": ["error", {
    "shorthands": {
      "plr": "player",
      "args": "parameters",
      "dt": "deltaTime",
      "char": "character",
      "btn": "button"
    },
    "allowPropertyAccess": ["char"]  // Allow as property
  }]
}
```

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

## License

MIT License - feel free to use this code however you want.
