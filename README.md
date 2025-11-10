# eslint-cease-nonsense-rules

A bunch of lints to prevent idiot mistakes I encounter with frequency.

**NOTE** I did not write this junk, an LLM did because I do not care.

## Installation

```bash
bun add -D @pobammer-ts/eslint-cease-nonsense-rules
```

## Usage

Add to your ESLint config:

```typescript
import ceaseNonsense from "@pobammer-ts/eslint-cease-nonsense-rules";

export default [
  {
    plugins: {
      "cease-nonsense": ceaseNonsense,
    },
    rules: {
      // Enable all rules (recommended)
      "cease-nonsense/ban-react-fc": "error",
      "cease-nonsense/enforce-ianitor-check-type": "error",
      "cease-nonsense/no-color3-constructor": "error",
      "cease-nonsense/no-instance-methods-without-this": "error",
      "cease-nonsense/no-print": "error",
      "cease-nonsense/no-shorthand-names": "error",
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

// Or just include the preset
export default [
  ceaseNonsense.configs.recommended,
];
```

## Rules

### Type Safety

#### `enforce-ianitor-check-type`

Enforces `Ianitor.Check<T>` type annotations on complex TypeScript types to ensure runtime validation. You don't really need this.

Calculates structural complexity of types and requires Ianitor validators when complexity exceeds thresholds.

**❌ Bad:**

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

**✅ Good:**

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

**Configuration:**

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

### React

#### `ban-react-fc`

Bans React.FC and similar component type annotations. Use explicit function declarations instead.

React.FC (Function Component) and related types break debug information in React DevTools, making profiling exponentially harder. They also encourage poor patterns and add unnecessary complexity.

**❌ Bad:**

```typescript
export const MyComponent: React.FC<Props> = ({ children }) => {
  return <div>{children}</div>;
};

const Button: FC<ButtonProps> = ({ label }) => <button>{label}</button>;

const Modal: React.FunctionComponent = () => <div>Modal</div>;

const Input: VFC = () => <input />;
```

**✅ Good:**

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

#### `require-react-component-keys`

Enforces key props on all React elements except top-level returns from components.

**❌ Bad:**

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

#### `require-named-effect-functions`

Enforce named effect functions for better debuggability. Prevent inline arrow functions in `useEffect` and similar hooks.

Behavior by environment (option `environment`):

- `roblox-ts` (default): only identifiers allowed (e.g., `useEffect(onTick, [...])`). Inline function expressions or arrows are reported.
- `standard`: identifiers and named function expressions are allowed; arrows are still reported.

Default hooks checked: `useEffect`, `useLayoutEffect`, `useInsertionEffect`.

**❌ Bad:**

```typescript
// Arrow function
useEffect(() => {
  doThing();
}, [dep]);

// Anonymous function expression
useEffect(function () {
  doThing();
}, [dep]);
```

**✅ Good:**

```typescript
// Preferred: reference a named function
function onDepChange() {
  doThing();
}
useEffect(onDepChange, [dep]);

// Allowed in `standard` mode
useEffect(function onDepChange() {
  doThing();
}, [dep]);
```

**Configuration:**

```typescript
{
  "cease-nonsense/require-named-effect-functions": ["error", {
    "environment": "roblox-ts", // or "standard"
    "hooks": ["useEffect", "useLayoutEffect", "useInsertionEffect"]
  }]
}
```

**✅ Good:**

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

**Configuration:**

```typescript
{
  "cease-nonsense/require-react-component-keys": ["error", {
    "allowRootKeys": false,                    // Allow keys on root returns
    "ignoreCallExpressions": ["ReactTree.mount"] // Functions to ignore
  }]
}
```

#### `use-exhaustive-dependencies`

Enforces exhaustive and correct dependency specification in React hooks to prevent stale closures and unnecessary re-renders.

**❌ Bad:**

```typescript
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchUser(userId).then(setUser);
  }, []); // Missing userId dependency!
}
```

**✅ Good:**

```typescript
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchUser(userId).then(setUser);
  }, [userId]);
}
```

**Configuration:**

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

#### `use-hook-at-top-level`

Enforces that React hooks are only called at the top level of components or custom hooks, never conditionally or in nested functions.

**❌ Bad:**

```typescript
function UserProfile({ userId }) {
  if (userId) {
    useEffect(() => {  // Hook in conditional!
      fetchUser(userId);
    }, [userId]);
  }
}
```

**✅ Good:**

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

**❌ Bad:**

```typescript
print("Debug message");
```

**✅ Good:**

```typescript
Log.info("Debug message");
```

#### `no-warn`

Bans use of `warn()` function calls. Use `Log` instead.

**❌ Bad:**

```typescript
warn("Warning message");
```

**✅ Good:**

```typescript
Log.warn("Warning message");
```

### Resource Management

#### `require-paired-calls`

Enforces that paired function calls (opener/closer) are properly balanced across all execution paths with LIFO ordering. Prevents resource leaks, unbalanced operations, and control flow errors.

**Key features:**

- Control flow analysis across all paths (if/else, switch, try/catch, loops)
- Early exit detection (return, throw, break, continue)
- LIFO validation for nested pairs
- Async operation detection (await/yield) with `requireSync`
- Roblox-specific auto-close detection for yielding functions

**❌ Bad:**

```typescript
// Missing closer on early return
function test() {
  debug.profilebegin("task");
  if (error) return; // profilebegin never closed on this path
  debug.profileend();
}

// Unpaired closer (no matching opener)
function test() {
  doWork();
  debug.profileend(); // No matching profilebegin
}

// Wrong LIFO order
function test() {
  debug.profilebegin("outer");
  debug.profilebegin("inner");
  debug.profileend(); // closes inner
  // outer is never closed
}

// Async operation with requireSync: true
async function test() {
  debug.profilebegin("task");
  await fetch("/api"); // Cannot await between profilebegin/end
  debug.profileend();
}

// Roblox yielding function auto-closes
function test() {
  debug.profilebegin("task");
  task.wait(1); // Auto-closes all profiles
  debug.profileend(); // This will error - already closed
}

// Conditional branch missing closer
function test() {
  debug.profilebegin("task");
  if (condition) {
    debug.profileend();
  } else {
    return; // Missing closer on this path
  }
}

// Break/continue skip closer
function test() {
  debug.profilebegin("loop");
  for (const item of items) {
    if (item.stop) break; // Skips closer
  }
  debug.profileend();
}
```

**✅ Good:**

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
  debug.profileend(); // closes inner
  debug.profileend(); // closes outer
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

// Try-catch with alternative closers
function test() {
  db.transaction();
  try {
    db.users.insert({ name: "test" });
    db.commit(); // Normal closer
  } catch (err) {
    db.rollback(); // Alternative closer
    throw err;
  }
}

// Closer in all branches
function test() {
  debug.profilebegin("task");
  if (condition) {
    debug.profileend();
  } else {
    debug.profileend();
  }
}

// Pairs inside loop iterations (not across)
function test() {
  for (const item of items) {
    debug.profilebegin("item");
    process(item);
    debug.profileend();
  }
}

// Multiple closers with requireAll
function test() {
  resource.init();
  resource.setup();
  // Both cleanup1 and cleanup2 must be called
  resource.cleanup1();
  resource.cleanup2();
}
```

**Configuration:**

```typescript
{
  "cease-nonsense/require-paired-calls": ["error", {
    "pairs": [{
      "opener": "debug.profilebegin",        // Opener function name
      "closer": "debug.profileend",          // Closer function name(s)
      "alternatives": ["db.rollback"],       // Alternative closers (any one)
      "requireSync": true,                   // Disallow await/yield
      "platform": "roblox",                  // Platform-specific behavior
      "yieldingFunctions": [                 // Custom yielding patterns
        "task.wait",
        "*.WaitForChild"                     // Supports wildcards
      ]
    }],
    "allowConditionalClosers": false,        // Allow closers in some branches
    "allowMultipleOpeners": true,            // Allow consecutive openers
    "maxNestingDepth": 0                     // Nesting limit (0 = unlimited)
  }]
}
```

**Configuration Options:**

**Pair Configuration** (per-pair settings in the `pairs` array):

- `opener` (required, string) - Function name that starts the paired operation (e.g., `"debug.profilebegin"`). Must be an exact function name including member access (e.g., `"obj.method"`).

- `closer` (required, string | string[]) - Function name(s) that close the paired operation. Can be:
  - Single string: `"debug.profileend"` - only this function can close
  - Array of strings: `["lock.release", "lock.free"]` - ANY of these functions can close (alternatives within closer)

- `alternatives` (optional, string[]) - Alternative closer function names used for error paths. When present, ANY ONE of the `closer` or `alternatives` satisfies the requirement. Example: `"closer": "db.commit", "alternatives": ["db.rollback"]` means either commit OR rollback closes the transaction.

- `requireSync` (optional, boolean, default: `false`) - When `true`, disallows `await` or `yield` expressions between opener and closer. Reports error if async operations occur within the paired scope.

- `platform` (optional, `"roblox"`) - Enables Roblox-specific behavior:
  - Auto-detects yielding function calls (configured via `yieldingFunctions`)
  - When a yielding function is called, ALL open profiles are automatically closed
  - Subsequent closer calls after yielding will report errors (already closed)

- `yieldingFunctions` (optional, string[], only with `platform: "roblox"`) - Custom patterns for Roblox yielding functions. Supports wildcards:
  - Exact match: `"task.wait"` matches only `task.wait()`
  - Wildcard method: `"*.WaitForChild"` matches `instance.WaitForChild()`, `player.WaitForChild()`, etc.
  - Default: `["task.wait", "wait", "*.WaitForChild"]`

**Top-Level Options:**

- `pairs` (required, array) - Array of pair configurations to enforce. Rule checks all configured pairs simultaneously.

- `allowConditionalClosers` (optional, boolean, default: `false`) - Controls whether closers must be called on ALL execution paths:
  - `false` (strict): Requires closer on every path (if/else both branches, all switch cases, etc.)
  - `true` (permissive): Allows closers in some but not all branches

- `allowMultipleOpeners` (optional, boolean, default: `true`) - Controls consecutive opener calls:
  - `true`: Allows multiple opener calls before closers (nesting)
  - `false`: Reports error if opener is called again before closer

- `maxNestingDepth` (optional, number, default: `0`) - Maximum nesting depth for paired calls:
  - `0`: Unlimited nesting
  - `> 0`: Reports error if nesting exceeds this depth

**Default configuration (Roblox profiling):**

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

**Real-world examples:**

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

// Multiple pairs
{
  "pairs": [
    { "opener": "debug.profilebegin", "closer": "debug.profileend" },
    { "opener": "db.transaction", "closer": "db.commit", "alternatives": ["db.rollback"] },
    { "opener": "file.open", "closer": "file.close" }
  ]
}

// Strict nesting
{
  "pairs": [{ "opener": "begin", "closer": "end" }],
  "maxNestingDepth": 2,
  "allowMultipleOpeners": false
}
```

**Use cases:**

- Roblox/Luau profiling (debug.profilebegin/end)
- Database transactions (transaction/commit/rollback)
- Resource locks (acquire/release)
- File handles (open/close)
- Network connections (connect/disconnect)
- Any begin/end API pattern

### Code Quality

#### `no-color3-constructor`

Bans `new Color3(...)` except for `new Color3()` or `new Color3(0, 0, 0)`. Use `Color3.fromRGB()` instead for better performance.

##### ✨ Has auto-fix

**❌ Bad:**

```typescript
const red = new Color3(255, 0, 0);
const blue = new Color3(0.5, 0.5, 1);
```

**✅ Good:**

```typescript
const red = Color3.fromRGB(255, 0, 0);
const blue = Color3.fromRGB(127, 127, 255);
const black = new Color3(0, 0, 0); // Allowed
```

#### `prefer-udim2-shorthand`

Prefer `UDim2.fromScale()` or `UDim2.fromOffset()` when all offsets or all scales are zero. Leaves `new UDim2(0, 0, 0, 0)` alone. Includes auto-fix.

**❌ Bad:**

```typescript
new UDim2(1, 0, 1, 0);
new UDim2(0, 100, 0, 50);
```

**✅ Good:**

```typescript
UDim2.fromScale(1, 1);
UDim2.fromOffset(100, 50);
new UDim2(0, 0, 0, 0); // Allowed
```

#### `prefer-sequence-overloads`

Prefer the optimized `ColorSequence` and `NumberSequence` constructor overloads instead of building an array of `*SequenceKeypoint`s for the 0/1 endpoints. Includes auto-fix.

**❌ Bad:**

```typescript
new ColorSequence([
  new ColorSequenceKeypoint(0, Color3.fromRGB(100, 200, 255)),
  new ColorSequenceKeypoint(1, Color3.fromRGB(255, 100, 200)),
]);

new NumberSequence([
  new NumberSequenceKeypoint(0, 0),
  new NumberSequenceKeypoint(1, 100),
]);
```

**✅ Good:**

```typescript
new ColorSequence(Color3.fromRGB(100, 200, 255), Color3.fromRGB(255, 100, 200));

new ColorSequence(Color3.fromRGB(255, 255, 255));

new NumberSequence(0, 100);

new NumberSequence(42);
```

Automatically collapses identical 0/1 endpoints to the single-argument overload.

#### `no-instance-methods-without-this`

Detects instance methods that don't use `this` and should be converted to standalone functions for better performance in roblox-ts.

In roblox-ts, instance methods create metatable objects with significant performance overhead. Methods that don't use `this` can be moved outside the class and called as standalone functions, eliminating this overhead entirely.

**❌ Bad:**

```typescript
type OnChange = (currentValue: number, previousValue: number) => void;

class MyClass {
  private readonly onChanges = new Array<OnChange>();
  private value = 0;

  public increment(): void {
    const previousValue = this.value;
    const value = previousValue + 1;
    this.value = value;
    this.notifyChanges(value, previousValue); // ← Bad: method doesn't use this
  }

  private notifyChanges(value: number, previousValue: number): void {
    for (const onChange of this.onChanges) onChange(value, previousValue);
  }
}
```

**✅ Good:**

```typescript
type OnChange = (currentValue: number, previousValue: number) => void;

function notifyChanges(value: number, previousValue: number, onChanges: ReadonlyArray<OnChange>): void {
  for (const onChange of onChanges) onChange(value, previousValue);
}

class MyClass {
  private readonly onChanges = new Array<OnChange>();
  private value = 0;

  public increment(): void {
    const previousValue = this.value;
    const value = previousValue + 1;
    this.value = value;
    notifyChanges(value, previousValue, this.onChanges); // ← Standalone function call
  }
}
```

**Configuration:**

```typescript
{
  "cease-nonsense/no-instance-methods-without-this": ["error", {
    "checkPrivate": true,       // Check private methods (default: true)
    "checkProtected": true,     // Check protected methods (default: true)
    "checkPublic": true         // Check public methods (default: true)
  }]
}
```

#### `no-shorthand-names`

Bans shorthand variable names in favor of descriptive full names.

**Default mappings:**

- `plr` → `player` (or `localPlayer` for `Players.LocalPlayer`)
- `args` → `parameters`
- `dt` → `deltaTime`
- `char` → `character`

**❌ Bad:**

```typescript
const plr = getPlayer();
const args = [1, 2, 3];
const dt = 0.016;
```

**✅ Good:**

```typescript
const player = getPlayer();
const localPlayer = Players.LocalPlayer;
const parameters = [1, 2, 3];
const deltaTime = 0.016;
const model = entity.char; // Property access is allowed
```

**Configuration:**

```typescript
{
  "cease-nonsense/no-shorthand-names": ["error", {
    "shorthands": {
      "plr": "player",
      "args": "parameters",
      "dt": "deltaTime",
      "char": "character",
      "btn": "button"  // Add custom mappings
    },
    "allowPropertyAccess": ["char"]  // Allow as property
  }]
}
```

## License

Do whatever you want with this code. I don't care. I know it says MIT but that is genuinely just a formality.
