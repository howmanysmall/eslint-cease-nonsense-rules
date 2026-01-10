# prefer-enum-item

Enforce using EnumItem values instead of string or number literals when the type expects an EnumItem.

## Rule Details

In roblox-ts, EnumItem values can often be passed as their string name or numeric value for convenience. While this works at runtime, it sacrifices type safety and makes code harder to understand. This rule ensures you use the explicit enum form (`Enum.ScaleType.Slice`) instead of magic strings (`"Slice"`) or numbers (`1`).

## Options

```typescript
{
  "cease-nonsense/prefer-enum-item": ["error", {
    "fixNumericToValue": false
  }]
}
```

### Configuration Parameters

- **fixNumericToValue** (default: `false`): When `true`, numeric literals fix to `Enum.X.Y.Value` instead of `Enum.X.Y`. The `.Value` form preserves numeric runtime value for performance while being self-documenting.

## Examples

### ❌ Incorrect

```typescript
// String literal where EnumItem expected
<uiflexitem FlexMode="Fill" />

// Number literal where EnumItem expected
<Halftones nativeProperties={{ ScaleType: 1 }} />

// In function arguments
setFlexMode("Fill");

// In variable assignments
const mode: Enum.UIFlexMode = "Fill";

// In object properties
const config = { scaleType: "Slice" as Enum.ScaleType };
```

### ✅ Correct

```typescript
// Explicit enum usage
<uiflexitem FlexMode={Enum.UIFlexMode.Fill} />

// Explicit enum in objects
<Halftones nativeProperties={{ ScaleType: Enum.ScaleType.Slice }} />

// In function arguments
setFlexMode(Enum.UIFlexMode.Fill);

// In variable assignments
const mode: Enum.UIFlexMode = Enum.UIFlexMode.Fill;

// Using .Value when needed for performance (with fixNumericToValue: true)
const config = { scaleType: Enum.ScaleType.Slice.Value };
```

## When Not To Use It

Disable this rule if:

- You're working with legacy code that heavily uses string/number enum values
- You need to interface with APIs that specifically require string or number values
- Performance is critical and you've measured that `.Value` access adds overhead

## Related Rules

- [prefer-pascal-case-enums](./prefer-pascal-case-enums.md) - Enforces PascalCase for enum names and members
- [prefer-singular-enums](./prefer-singular-enums.md) - Enforces singular enum names
