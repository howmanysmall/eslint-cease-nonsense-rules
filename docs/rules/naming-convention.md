# naming-convention

Enforce naming conventions for TypeScript constructs.

## Rule Details

This rule enforces naming conventions for interfaces, types, and other TypeScript constructs. It's optimized for common use cases like interface prefix checking without requiring type checking.

## Options

```typescript
{
  "cease-nonsense/naming-convention": ["error", {
    "custom": {
      "match": false,
      "regex": "^I[A-Z]"
    },
    "format": ["PascalCase"],
    "selector": "interface"
  }]
}
```

### Configuration Parameters

- **custom**: Custom regex matching options.
  - **match** (default: `true`): Whether the regex should match (`true`) or not match (`false`).
  - **regex**: Regular expression pattern to test against names.
- **format**: Array of format names (e.g., `["PascalCase"]`).
- **selector**: Type of construct to check (e.g., `"interface"`).

## Examples

### ❌ Incorrect

```typescript
// With custom: { match: false, regex: "^I[A-Z]" }
interface IUser {
  name: string;
}
```

### ✅ Correct

```typescript
interface User {
  name: string;
}
```

## When Not To Use It

If your codebase intentionally uses interface prefixes (e.g., `IUser`) for legacy reasons or team preference, disable this rule.

## Performance

This rule is optimized with:

- No type checking required (fast AST-only analysis)
- Pre-compiled regex patterns
- Focused on common use cases

## Related Rules

- `@typescript-eslint/naming-convention` - Full-featured naming convention rule (slower, more comprehensive)
