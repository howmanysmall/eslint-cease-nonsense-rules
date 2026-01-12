# misleading-lua-tuple-checks

Disallow the use of LuaTuple in conditional expressions.

## Rule Details

This rule prevents using `LuaTuple` types directly in conditional expressions, which can be misleading. It requires explicit indexing (`[0]`) or array destructuring.

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```typescript
// Direct LuaTuple in conditional
if (getLuaTuple()) {
  // ...
}

// LuaTuple in variable declaration
const result = getLuaTuple();
```

### ✅ Correct

```typescript
// Explicit indexing
if (getLuaTuple()[0]) {
  // ...
}

// Array destructuring
const [result] = getLuaTuple();
```

## Performance

This rule is optimized with:

- Cached type queries per node
- WeakMap-based caching for `isLuaTuple` checks
- Cached constrained type lookups

## Related Rules

- `roblox/misleading-lua-tuple-checks` - Original rule (this is a faster replacement)
