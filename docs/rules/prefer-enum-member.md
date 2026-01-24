# prefer-enum-member

Enforce using TypeScript enum members instead of raw string or number values.

## Rule Details

Enums provide a single source of truth for values. Passing raw literals or using bare keys hides intent and creates drift when enum values change. This rule requires enum member references for both `enum` and `const enum`, including object literal keys where the expected type is a mapped enum type (like `Record<Color, T>`).

## Options

This rule has no options.

## Examples

### Incorrect

```typescript
enum Color {
	Blue = "Blue",
	Green = "Green",
	Red = "Red",
}

const palette: Record<Color, string> = {
	Blue: "#00F",
	Green: "#0F0",
	Red: "#F00",
};

function setColor(color: Color) {}
setColor("Blue");
```

### Correct

```typescript
enum Color {
	Blue = "Blue",
	Green = "Green",
	Red = "Red",
}

const palette: Record<Color, string> = {
	[Color.Blue]: "#00F",
	[Color.Green]: "#0F0",
	[Color.Red]: "#F00",
};

function setColor(color: Color) {}
setColor(Color.Blue);
```

## When Not To Use It

Disable this rule if:

- You intentionally use raw enum values for interop layers
- You do not want to enforce computed keys in mapped enum objects

## Related Rules

- [prefer-enum-item](./prefer-enum-item.md) - Enforces EnumItem usage in roblox-ts
- [prefer-pascal-case-enums](./prefer-pascal-case-enums.md) - Enforces enum naming
