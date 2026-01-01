# strict-component-boundaries

Prevent reaching into sibling component folders for nested modules.

## Rule Details

Components should be isolated and not directly import from the internal structure of sibling components. This rule enforces architectural boundaries by preventing imports that reach into another component's internals.

## Options

```typescript
{
  "cease-nonsense/strict-component-boundaries": ["error", {
    "allow": ["components/\\w+$"],  // Regex patterns to allow
    "maxDepth": 1                    // Maximum import depth
  }]
}
```

### Configuration Parameters

- **allow** (default: `[]`): Array of regex patterns for allowed import paths
- **maxDepth** (default: `1`): Maximum depth allowed when importing from component folders

## Examples

### ❌ Incorrect

```typescript
// Reaching into another component's internals
import { helper } from "../OtherComponent/utils/helper";

// Importing from sibling's nested structure
import { hook } from "../UserProfile/hooks/useProfile";

// Too deep into component structure
import { constant } from "./components/Foo/internal/constants";

// Sibling component internals
import { validator } from "../../shared/components/Form/validators/email";
```

### ✅ Correct

```typescript
// Import from shared location
import { helper } from "../../shared/utils/helper";
import { hook } from "../../shared/hooks/useProfile";

// Index import from component (public API)
import { OtherComponent } from "../OtherComponent";
import { UserProfile } from "../UserProfile";

// Direct component import (within maxDepth)
import { Foo } from "./components/Foo";

// Same-level or parent imports (not crossing boundaries)
import { myHelper } from "./utils/myHelper";
import { ParentUtil } from "../utils/shared";

// Shared/common folders (not components)
import { validator } from "../../shared/validators/email";
```

## Why Enforce Boundaries?

### Encapsulation

Components should expose a public API through their index file:

```typescript
// ❌ Breaks encapsulation
import { InternalState } from "../User/state/internal";

// ✅ Uses public API
import { useUserState } from "../User";
```

### Refactoring Safety

Internal changes shouldn't break external code:

```typescript
// ❌ Brittle: breaks if User restructures
import { helper } from "../User/utils/helpers/formatName";

// ✅ Resilient: User controls public API
import { formatUserName } from "../User";
```

### Circular Dependencies

Cross-component imports create dependency cycles:

```typescript
// ComponentA/helper.ts
import { utilB } from "../ComponentB/utils/utilB";

// ComponentB/utils/utilB.ts
import { helperA } from "../../ComponentA/helper"; // Cycle!
```

### Coupling

Tight coupling makes components harder to:

- Test in isolation
- Reuse in other projects
- Understand independently
- Modify without breaking others

## Recommended Structure

### Component with Public API

```txt
components/
  UserProfile/
    index.ts                 # Public API (exports)
    UserProfile.tsx          # Main component
    components/              # Internal sub-components
      UserHeader.tsx
      UserStats.tsx
    hooks/                   # Internal hooks
      useUserData.ts
    utils/                   # Internal utilities
      formatters.ts
```

```typescript
// components/UserProfile/index.ts - Public API
export { UserProfile } from "./UserProfile";
export { useUserData } from "./hooks/useUserData";
export type { UserProfileProps } from "./UserProfile";

// Internal stuff NOT exported
```

### Proper Imports

```typescript
// ✅ From other components
import { UserProfile } from "../UserProfile"; // Uses public API

// ✅ Within same component
import { UserHeader } from "./components/UserHeader"; // Internal OK
import { useUserData } from "./hooks/useUserData"; // Internal OK

// ✅ From shared code
import { formatDate } from "../../shared/utils/date";
import { API_ENDPOINT } from "../../config/constants";

// ❌ From sibling component internals
import { UserHeader } from "../UserProfile/components/UserHeader";
import { useUserData } from "../UserProfile/hooks/useUserData";
```

## maxDepth Option

Controls how deep you can import from component folders:

### maxDepth: 1 (default)

```typescript
// ✅ Allowed (1 level)
import { Foo } from "./components/Foo";

// ❌ Disallowed (2 levels)
import { Bar } from "./components/Foo/Bar";
```

### maxDepth: 2

```typescript
// ✅ Allowed (2 levels)
import { Foo } from "./components/Foo";
import { Bar } from "./components/Foo/Bar";

// ❌ Disallowed (3 levels)
import { Baz } from "./components/Foo/Bar/Baz";
```

### maxDepth: 0 (unlimited)

```typescript
// ✅ Any depth allowed
import { Deep } from "./components/A/B/C/D/Deep";
```

## allow Option

Specify regex patterns for allowed imports:

```typescript
{
  "allow": [
    "components/\\w+$",           // Direct component imports
    "shared/.*",                   // Anything in shared/
    "components/common/.*"         // Common components
  ]
}
```

```typescript
// ✅ Matches "components/\w+$"
import { Button } from "./components/Button";

// ✅ Matches "shared/.*"
import { helper } from "../../shared/utils/helper";

// ❌ Doesn't match any pattern
import { thing } from "../OtherComponent/internal/thing";
```

## Migration Strategy

### 1. Identify Public APIs

For each component, determine what should be public:

```typescript
// What does this component expose?
// - Main component?
// - Reusable hooks?
// - Type definitions?
// - Utility functions?
```

### 2. Create Index Files

```typescript
// components/UserProfile/index.ts
export { UserProfile } from "./UserProfile";
export { useUserProfile } from "./hooks/useUserProfile";
export type { UserProfileProps } from "./types";
```

### 3. Update Imports

```typescript
// Before
import { UserProfile } from "../UserProfile/UserProfile";
import { useUserProfile } from "../UserProfile/hooks/useUserProfile";

// After
import { UserProfile, useUserProfile } from "../UserProfile";
```

### 4. Move Shared Code

```typescript
// If multiple components need it, move to shared/
components/UserProfile/utils/formatDate.ts
  → shared/utils/formatDate.ts
```

## When Not To Use It

If your project structure doesn't follow component-based architecture or you prefer unrestricted imports, you can disable this rule. However, maintaining clear boundaries is generally recommended for maintainability.

## Related Rules

- [no-god-components](./no-god-components.md) - Prevents components from growing too large
- [prefer-module-scope-constants](./prefer-module-scope-constants.md) - Enforces proper constant scoping

## Further Reading

- [Component-Driven Development](https://www.componentdriven.org/)
- [Encapsulation in Software Design](https://en.wikipedia.org/wiki/Encapsulation_(computer_programming))
- [Modular Design Patterns](https://addyosmani.com/resources/essentialjsdesignpatterns/book/#modulepatternjavascript)
