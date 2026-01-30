# prefer-single-get

Enforces combining multiple `world.get()` calls on the same entity into a single call for better Jecs performance.

## Rule Details

In Jecs (a Roblox ECS library), calling `world.get()` multiple times on the same entity results in multiple archetype lookups. Combining these calls into a single `world.get(entity, ComponentA, ComponentB, ...)` call improves performance by reducing the number of lookups and cache misses.

This rule detects consecutive `world.get()` calls on the same world and entity, and provides an automatic fix to merge them.

## Examples

### ❌ Incorrect

```typescript
// Multiple lookups - inefficient
const position = world.get(entity, Position);
const velocity = world.get(entity, Velocity);
const health = world.get(entity, Health);
```

### ✅ Correct

```typescript
// Single lookup - efficient
const [position, velocity, health] = world.get(entity, Position, Velocity, Health);
```

## Performance Benefits

### Reduced Archetype Lookups

Each `world.get()` call performs an archetype lookup. Combining calls reduces overhead:

```typescript
// ❌ 3 archetype lookups
const position = world.get(entity, Position);
const velocity = world.get(entity, Velocity);
const health = world.get(entity, Health);

// ✅ 1 archetype lookup
const [position, velocity, health] = world.get(entity, Position, Velocity, Health);
```

### Cache Efficiency

Jecs caches archetype information. Multiple calls on the same entity benefit from cache locality when combined:

```typescript
// ❌ Cache may be invalidated between calls
const transform = world.get(entity, Transform);
// ... other code ...
const model = world.get(entity, Model);

// ✅ Cache remains valid for single lookup
const [transform, model] = world.get(entity, Transform, Model);
```

## Auto-Fix Behavior

This rule provides automatic fixes that merge multiple `world.get()` calls:

```typescript
// Before:
const position = world.get(entity, Position);
const velocity = world.get(entity, Velocity);

// After (auto-fixed):
const [position, velocity] = world.get(entity, Position, Velocity);
```

## Supported Patterns

### Basic Variable Declarations

```typescript
// Detected and fixed
const position = world.get(entity, Position);
const velocity = world.get(entity, Velocity);
```

### Method Chains

```typescript
// Detected when world is a member expression
const position = this.world.get(entity, Position);
const velocity = this.world.get(entity, Velocity);
```

### Complex Entity Expressions

```typescript
// Detected when entity expression matches
const a = world.get(entities[0], ComponentA);
const b = world.get(entities[0], ComponentB);
```

## Limitations

### Maximum Components

Jecs supports up to 4 components per `get()` call. The rule will not combine more than 4 calls on the same entity:

```typescript
// These 5 calls will NOT be combined (exceeds Jecs limit)
const a = world.get(entity, A);
const b = world.get(entity, B);
const c = world.get(entity, C);
const d = world.get(entity, D);
const e = world.get(entity, E);
```

### Non-Consecutive Calls

Currently, the rule only detects calls within the same program/file scope. Calls separated by unrelated code may not be detected in all cases.

### Non-Identifier Variables

The rule only optimizes simple variable declarations with identifiers:

```typescript
// ❌ Not optimized (destructuring)
const { x } = world.get(entity, ComponentA);
const { y } = world.get(entity, ComponentB);

// ❌ Not optimized (let declaration)
let x = world.get(entity, ComponentA);
let y = world.get(entity, ComponentB);
```

## When Not To Use It

Disable this rule if:

- You intentionally want separate lookups for debugging purposes
- You're using a custom ECS implementation with different `get()` semantics
- You prefer explicit single-component lookups for code clarity

## Related Rules

- [prefer-pattern-replacements](./prefer-pattern-replacements.md) - Optimizes constructor patterns
- [no-identity-map](./no-identity-map.md) - Detects pointless identity operations

## Further Reading

- [Jecs Documentation](https://github.com/ukendio/jecs)
- [ECS Architecture Patterns](https://en.wikipedia.org/wiki/Entity_component_system)
