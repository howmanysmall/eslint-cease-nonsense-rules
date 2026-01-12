# no-unused-imports

Disallow unused imports.

## Rule Details

This rule reports when an import is defined but never used in the code. It uses ESLint's scope analysis to detect unused imports and optionally checks JSDoc comments for references.

## Options

```typescript
{
  "cease-nonsense/no-unused-imports": ["error", {
    "checkJSDoc": true
  }]
}
```

### Configuration Parameters

- **checkJSDoc** (default: `true`): When `true`, checks if imports are referenced in JSDoc comments (e.g., `@link`, `@see`, `@type`).

## Examples

### ❌ Incorrect

```typescript
import { unusedFunction } from "./utils";
import { AnotherUnused } from "./types";

// unusedFunction and AnotherUnused are never used
```

### ✅ Correct

```typescript
import { usedFunction } from "./utils";

usedFunction();

// Or used in JSDoc
/**
 * @see {usedFunction}
 */
```

## When Not To Use It

If you have imports that are used only in JSDoc comments and want to keep them, disable this rule or set `checkJSDoc: true`.

## Performance

This rule is optimized with:

- Cached JSDoc comment parsing per file
- Pre-compiled regex patterns
- Efficient scope analysis using ESLint's built-in mechanisms

## Related Rules

- `@typescript-eslint/no-unused-vars` - Detects unused variables (but doesn't handle imports as efficiently)
