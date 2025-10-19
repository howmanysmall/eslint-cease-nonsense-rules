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
      "cease-nonsense/enforce-ianitor-check-type": "error",
      "cease-nonsense/no-color3-constructor": "error",
      "cease-nonsense/no-print": "error",
      "cease-nonsense/no-shorthand-names": "error",
      "cease-nonsense/no-warn": "error",
      "cease-nonsense/prefer-sequence-overloads": "error",
      "cease-nonsense/prefer-udim2-shorthand": "error",
      "cease-nonsense/require-named-effect-functions": "error",
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

### Code Quality

#### `no-color3-constructor`

Bans `new Color3(...)` except for `new Color3()` or `new Color3(0, 0, 0)`. Use `Color3.fromRGB()` instead for better performance.

**✨ Has auto-fix**

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
