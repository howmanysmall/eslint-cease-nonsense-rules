# prefer-udim2-shorthand

Prefer `UDim2.fromScale()` or `UDim2.fromOffset()` when all offsets or all scales are zero.

## Rule Details

When creating a `UDim2` with all scales or all offsets set to zero, the shorthand constructors are clearer and more concise than the full 4-argument constructor.

## Features

- ✨ Has auto-fix
- Leaves `new UDim2(0, 0, 0, 0)` alone (explicit zero initialization)

## Examples

### ❌ Incorrect

```typescript
new UDim2(1, 0, 1, 0); // Pure scale
new UDim2(0.5, 0, 0.5, 0); // Pure scale

new UDim2(0, 100, 0, 50); // Pure offset
new UDim2(0, 200, 0, 150); // Pure offset
```

### ✅ Correct

```typescript
UDim2.fromScale(1, 1); // Pure scale
UDim2.fromScale(0.5, 0.5); // Pure scale

UDim2.fromOffset(100, 50); // Pure offset
UDim2.fromOffset(200, 150); // Pure offset

// Mixed scale and offset - not affected
new UDim2(0.5, 10, 0.5, 10);

// Explicit zero - not affected
new UDim2(0, 0, 0, 0);
```

## Why Use Shorthands?

### Clarity

The shorthand methods make intent clear:

```typescript
// Unclear: what are these numbers?
new UDim2(1, 0, 0.5, 0);

// Clear: scaling
UDim2.fromScale(1, 0.5);
```

```typescript
// Unclear: what are these numbers?
new UDim2(0, 100, 0, 50);

// Clear: pixel offsets
UDim2.fromOffset(100, 50);
```

### Consistency

Using shorthands establishes a pattern:

```typescript
// Inconsistent
const a = new UDim2(1, 0, 1, 0);
const b = UDim2.fromScale(0.5, 0.5);

// Consistent
const a = UDim2.fromScale(1, 1);
const b = UDim2.fromScale(0.5, 0.5);
```

### Less Error-Prone

Fewer arguments means fewer mistakes:

```typescript
// Easy to swap scale/offset by accident
new UDim2(1, 100, 0, 0); // Bug: meant (1, 0, 0, 100)?

// Clear: can't mix up
UDim2.fromScale(1, 0);
UDim2.fromOffset(0, 100);
```

## API Reference

### UDim2.fromScale

Creates a UDim2 with only scale components (offsets are 0):

```typescript
UDim2.fromScale(scaleX: number, scaleY: number);

// Equivalent to:
new UDim2(scaleX, 0, scaleY, 0);
```

Examples:

```typescript
UDim2.fromScale(1, 1); // Full size
UDim2.fromScale(0.5, 0.5); // Half size
UDim2.fromScale(0, 0); // Zero size
```

### UDim2.fromOffset

Creates a UDim2 with only offset components (scales are 0):

```typescript
UDim2.fromOffset(offsetX: number, offsetY: number);

// Equivalent to:
new UDim2(0, offsetX, 0, offsetY);
```

Examples:

```typescript
UDim2.fromOffset(100, 50); // 100px x 50px
UDim2.fromOffset(200, 200); // 200px square
UDim2.fromOffset(-10, -10); // Negative offset
```

## Edge Cases

### Zero Initialization

Explicit zero initialization is preserved:

```typescript
// Not changed (explicit zero)
new UDim2(0, 0, 0, 0);

// Would be changed to:
UDim2.fromScale(0, 0); // or UDim2.fromOffset(0, 0)
```

This is intentional - `new UDim2(0, 0, 0, 0)` is idiomatic for zero/default values.

### Mixed Values

Mixed scale and offset values are not affected:

```typescript
// Not changed (has both scale and offset)
new UDim2(0.5, 10, 0.5, 10);
new UDim2(1, -5, 0, 100);
new UDim2(0, 50, 0.5, 0);
```

### Dynamic Values

Works with any expressions:

```typescript
// Before
new UDim2(calculateScale(), 0, calculateScale(), 0);

// After
UDim2.fromScale(calculateScale(), calculateScale());
```

## When Not To Use It

If you prefer the explicit 4-argument constructor for consistency or clarity, you can disable this rule. However, using the shorthands is generally considered best practice in the Roblox community.

## Related Rules

- [no-color3-constructor](./no-color3-constructor.md) - Similar pattern for Color3
- [prefer-pattern-replacements](./prefer-pattern-replacements.md) - General pattern replacement framework

## Further Reading

- [Roblox UDim2 Documentation](https://create.roblox.com/docs/reference/engine/datatypes/UDim2)
- [UI Layout Best Practices](https://create.roblox.com/docs/building-and-visuals/ui)
