# prefer-sequence-overloads

Prefer the optimized `ColorSequence` and `NumberSequence` constructor overloads instead of building an array of `*SequenceKeypoint`s.

## Rule Details

Roblox provides optimized constructor overloads for `ColorSequence` and `NumberSequence` that are simpler and more performant than manually creating keypoint arrays. This rule enforces their use.

## Features

- ✨ Has auto-fix
- Automatically collapses identical 0/1 endpoints into single-value constructors

## Examples

### ❌ Incorrect

```typescript
new ColorSequence([
	new ColorSequenceKeypoint(0, Color3.fromRGB(100, 200, 255)),
	new ColorSequenceKeypoint(1, Color3.fromRGB(255, 100, 200)),
]);

new NumberSequence([new NumberSequenceKeypoint(0, 0), new NumberSequenceKeypoint(1, 100)]);

// Identical endpoints
new ColorSequence([
	new ColorSequenceKeypoint(0, Color3.fromRGB(255, 255, 255)),
	new ColorSequenceKeypoint(1, Color3.fromRGB(255, 255, 255)),
]);

new NumberSequence([new NumberSequenceKeypoint(0, 42), new NumberSequenceKeypoint(1, 42)]);
```

### ✅ Correct

```typescript
new ColorSequence(Color3.fromRGB(100, 200, 255), Color3.fromRGB(255, 100, 200));

new NumberSequence(0, 100);

// Identical endpoints collapsed to single value
new ColorSequence(Color3.fromRGB(255, 255, 255));

new NumberSequence(42);
```

## Why This Matters

### Performance

The optimized overloads:

- Avoid array allocation
- Reduce keypoint object creation
- Use faster internal Roblox APIs

```typescript
// Slower: creates array + 2 keypoint objects
new NumberSequence([new NumberSequenceKeypoint(0, 0), new NumberSequenceKeypoint(1, 1)]);

// Faster: direct constructor call
new NumberSequence(0, 1);
```

### Readability

```typescript
// Verbose and noisy
new ColorSequence([
	new ColorSequenceKeypoint(0, Color3.fromRGB(255, 0, 0)),
	new ColorSequenceKeypoint(1, Color3.fromRGB(0, 0, 255)),
]);

// Clean and concise
new ColorSequence(Color3.fromRGB(255, 0, 0), Color3.fromRGB(0, 0, 255));
```

## Automatic Collapse

When start and end values are identical, the fixer automatically uses the single-value overload:

```typescript
// Before
new ColorSequence([
	new ColorSequenceKeypoint(0, Color3.fromRGB(128, 128, 128)),
	new ColorSequenceKeypoint(1, Color3.fromRGB(128, 128, 128)),
]);

// After (auto-fixed)
new ColorSequence(Color3.fromRGB(128, 128, 128));
```

## Edge Cases

### Non-Standard Keypoints

The rule only applies to sequences with exactly 2 keypoints at positions 0 and 1:

```typescript
// Not affected (3 keypoints)
new NumberSequence([
	new NumberSequenceKeypoint(0, 0),
	new NumberSequenceKeypoint(0.5, 50),
	new NumberSequenceKeypoint(1, 100),
]);

// Not affected (non-standard positions)
new NumberSequence([new NumberSequenceKeypoint(0.25, 0), new NumberSequenceKeypoint(0.75, 100)]);
```

### Complex Color Expressions

Works with any Color3 expression:

```typescript
// Before
new ColorSequence([
	new ColorSequenceKeypoint(0, getStartColor()),
	new ColorSequenceKeypoint(1, getEndColor()),
]);

// After
new ColorSequence(getStartColor(), getEndColor());
```

## API Reference

### ColorSequence

```typescript
// Two-value overload
new ColorSequence(startColor: Color3, endColor: Color3);

// Single-value overload (uniform)
new ColorSequence(color: Color3);
```

### NumberSequence

```typescript
// Two-value overload
new NumberSequence(start: number, end: number);

// Single-value overload (uniform)
new NumberSequence(value: number);
```

## When Not To Use It

If you need sequences with more than 2 keypoints or non-standard keypoint positions, those patterns aren't affected by this rule. The rule only optimizes the simple 0→1 gradient case.

## Related Rules

- [prefer-pattern-replacements](./prefer-pattern-replacements.md) - General pattern replacement framework
- [no-color3-constructor](./no-color3-constructor.md) - Enforces Color3.fromRGB

## Further Reading

- [Roblox ColorSequence Documentation](https://create.roblox.com/docs/reference/engine/datatypes/ColorSequence)
- [Roblox NumberSequence Documentation](https://create.roblox.com/docs/reference/engine/datatypes/NumberSequence)
