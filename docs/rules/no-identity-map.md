# no-identity-map

Bans pointless identity `.map()` calls that return the parameter unchanged.

## Rule Details

Identity map operations (`array.map(x => x)`) are redundant and should be removed. For arrays, use proper cloning methods. For Bindings, use the original binding directly. This rule detects identity callbacks and provides automatic fixes.

## Options

```typescript
{
  "cease-nonsense/no-identity-map": ["error", {
    "bindingPatterns": ["binding"] // Case-insensitive patterns
  }]
}
```

### Configuration Parameters

- **bindingPatterns** (default: `["binding"]`): Variable name patterns to recognize as Bindings (case-insensitive)

## Examples

### ❌ Incorrect

```typescript
// Identity map on Binding
const result = scaleBinding.map((value) => value);

// Arrow function with block
const data = myBinding.map((x) => {
	return x;
});

// Function expression
const output = someBinding.map(function (item) {
	return item;
});

// Identity map on Array
const copied = items.map((item) => item);
const users = userList.map((user) => user);
```

### ✅ Correct

```typescript
// Bindings - use directly
const result = scaleBinding;
const data = myBinding;

// Arrays - use proper cloning
const copied = table.clone(items);
const copied2 = [...items];

// Actual transformations are fine
const doubled = items.map((x) => x * 2);
const names = users.map((user) => user.name);
```

## Auto-Fix Behavior

This rule provides automatic fixes that remove the pointless `.map()` call:

```typescript
// Before:
const result = myBinding.map((x) => x);

// After (auto-fixed):
const result = myBinding;
```

## Binding Detection

The rule uses multiple strategies to detect Bindings:

### 1. Variable Name Patterns

Case-insensitive matching against configured patterns:

```typescript
{
  "bindingPatterns": ["binding", "signal"]
}

// All detected as Bindings:
const scaleBinding = ...
const positionbinding = ...
const mySignal = ...
const dataSignal = ...
```

### 2. Initialization Analysis

Detects Bindings by looking at how they're created:

```typescript
// Detected as Binding
const myBinding = useBinding(0);
const joined = joinBindings(a, b);
const mapped = otherBinding.map((x) => x * 2);
```

### 3. Chained Map Calls

```typescript
// Detected as Binding (chained from another map)
const doubled = binding.map((x) => x * 2);
const identity = doubled.map((x) => x); // ❌ Flagged
```

## Message Types

The rule provides context-specific messages:

### For Bindings

```typescript
const result = myBinding.map((x) => x);
// Error: Pointless identity `.map()` call on Binding. Use the original binding directly.
```

### For Arrays

```typescript
const copied = items.map((x) => x);
// Error: Pointless identity `.map()` call on Array. Use `table.clone(array)` or `[...array]` instead.
```

## Identity Callback Detection

The rule recognizes these identity patterns:

### Arrow Functions

```typescript
// All detected as identity:
array.map((x) => x);
array.map((item) => item);
array.map((value) => value);

// With block syntax:
array.map((x) => {
	return x;
});
```

### Function Expressions

```typescript
// Detected as identity:
array.map(function (x) {
	return x;
});
```

### Not Detected

These are NOT considered identity operations:

```typescript
// Transformation
array.map((x) => x * 2);
array.map((x) => x.property);

// Multiple parameters
array.map((x, index) => x);

// Block with additional logic
array.map((x) => {
	console.log(x);
	return x;
});
```

## Common Use Cases

### Array Cloning

```typescript
// ❌ Bad - inefficient and unclear
const copy = original.map((x) => x);

// ✅ Good - explicit cloning
const copy = table.clone(original);
const copy2 = [...original];
```

### Binding Passthrough

```typescript
// ❌ Bad - unnecessary map
function MyComponent({ positionBinding }: Props) {
	const localBinding = positionBinding.map((p) => p);
	return <Frame Position={localBinding} />;
}

// ✅ Good - use directly
function MyComponent({ positionBinding }: Props) {
	return <Frame Position={positionBinding} />;
}
```

### Reactive Programming

```typescript
// ❌ Bad
const doubled = signal.map((x) => x * 2);
const identity = doubled.map((x) => x); // Pointless!

// ✅ Good - remove identity map
const doubled = signal.map((x) => x * 2);
const result = doubled; // Use directly
```

## Edge Cases

### Computed Properties

```typescript
// Not checked (not simple identity)
array.map((x) => ({ ...x }));
array.map((x) => [x]);
```

### Destructuring

```typescript
// Not checked (different parameter names)
array.map(({ id }) => id);
```

### Type Assertions

```typescript
// ❌ Still detected as identity
const typed = items.map((x) => x as MyType);

// Use type assertion on the whole result instead:
const typed = items as MyType[];
```

## Performance Considerations

### Arrays

Identity map on arrays creates unnecessary overhead:

```typescript
// Performance cost: iterates entire array + creates new array
const copied = items.map((x) => x);

// Better: O(n) but more explicit and optimized
const copied = table.clone(items);
const copied2 = [...items]; // Even clearer intent
```

### Bindings

Identity map on Bindings is completely pointless:

```typescript
// Unnecessary reactive computation
const identity = binding.map((x) => x);

// Just use the original - no computation
const same = binding;
```

## When Not To Use It

Disable this rule if:

- You need identity maps for type narrowing in very specific cases
- You're working with a custom reactive library that has different semantics
- Identity maps have specific meaning in your framework

## Configuration Examples

### Default Configuration

```typescript
{
  "cease-nonsense/no-identity-map": "error"
}
```

### Custom Binding Patterns

```typescript
{
  "cease-nonsense/no-identity-map": ["error", {
    "bindingPatterns": ["binding", "signal", "observable", "stream"]
  }]
}
```

### Multiple Patterns

```typescript
{
  "cease-nonsense/no-identity-map": ["error", {
    "bindingPatterns": [
      "binding",
      "signal",
      "ref",
      "state"
    ]
  }]
}
```

## Related Rules

- [no-useless-use-spring](./no-useless-use-spring.md) - Detects static spring configurations
- [prefer-pattern-replacements](./prefer-pattern-replacements.md) - Optimizes constructor patterns

## Further Reading

- [Array Cloning Methods](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array)
- [Reactive Programming Patterns](https://www.reactivemanifesto.org/)
- [Roblox Bindings](https://roblox-ts.com/docs/guides/roact#bindings)
