# no-shorthand-names

Bans shorthand variable names in favor of descriptive full names.

## Rule Details

Shorthand names reduce code readability and make it harder for newcomers to understand the codebase. This rule enforces full, descriptive names by matching shorthands within compound identifiers and providing detailed replacement suggestions.

## Options

```typescript
{
  "cease-nonsense/no-shorthand-names": ["error", {
    "shorthands": {
      "plr": "player",
      "args": "parameters",
      "dt": "deltaTime",
      "char": "character"
    },
    "allowPropertyAccess": ["char", "Props"],
    "ignoreShorthands": ["PropsWithoutRef"]
  }]
}
```

### Configuration Parameters

- **shorthands**: Map of shorthand patterns to replacements (supports exact, glob, regex)
- **allowPropertyAccess**: Shorthands allowed in property access (`obj.prop`) or qualified names (`Type.Member`)
- **ignoreShorthands**: Patterns to ignore completely

## Pattern Syntax

### Exact Matching

```typescript
{
  "shorthands": {
    "plr": "player",
    "dt": "deltaTime"
  }
}
```

### Glob Patterns

Use `*` (any characters) and `?` (single character):

```typescript
{
  "shorthands": {
    "str*": "string*",         // strValue → stringValue
    "*Props": "*Properties",   // DataProps → DataProperties  
    "*Btn*": "*Button*"        // myBtnClick → myButtonClick
  }
}
```

### Regex Patterns

Use `/pattern/flags` syntax:

```typescript
{
  "shorthands": {
    "/^str(.*)$/": "string$1",  // strName → stringName
    "/^props$/i": "properties"  // Props or props → properties
  }
}
```

## Examples

### ❌ Incorrect

```typescript
// Direct shorthand usage
const plr = getPlayer();
const args = [1, 2, 3];
const dt = 0.016;

// Compound identifiers
const plrData = getUserData();
const strValue = "hello";
const btnClick = handleClick;

// Type names
interface PlrInfo {
	name: string;
}

type ArgsConfig = Array<string>;
```

### ✅ Correct

```typescript
// Full names
const player = getPlayer();
const parameters = [1, 2, 3];
const deltaTime = 0.016;

// Full compound names
const playerData = getUserData();
const stringValue = "hello";
const buttonClick = handleClick;

// Full type names
interface PlayerInfo {
	name: string;
}

type ParametersConfig = Array<string>;

// Property access (if configured in allowPropertyAccess)
const model = entity.char; // Allowed
const props = component.Props; // Allowed
```

## Compound Identifier Matching

Identifiers are split at camelCase/PascalCase boundaries, and each word is checked:

```typescript
{
  "shorthands": {
    "plr": "player",
    "Props": "Properties"
  }
}

// Before → After:
plrData → playerData
UnitBoxBadgeInfoProps → UnitBoxBadgeInfoProperties
plrConfigProps → playerConfigProperties
```

### Word Boundary Detection

The rule splits on:

- camelCase: `myValue` → `["my", "Value"]`
- PascalCase: `MyValue` → `["My", "Value"]`
- Acronyms: `HTMLParser` → `["HTML", "Parser"]`
- Numbers: `value2X` → `["value", "2", "X"]`

## Special Cases

### Players.LocalPlayer Pattern

Special handling for the common Roblox pattern:

```typescript
// ❌ Bad - uses 'plr' shorthand
const plr = Players.LocalPlayer;

// ✅ Good - special case suggests 'localPlayer'
const localPlayer = Players.LocalPlayer;
```

### Property Access Exemption

Shorthands are allowed in property access when configured:

```typescript
{
  "allowPropertyAccess": ["char", "Props"]
}

// ✅ Allowed - property access
const model = character.char;
const type = React.Props;

// ❌ Not allowed - variable name
const char = getCharacter(); // Error!
const Props = {}; // Error!
```

### Import Specifiers

Import specifiers are automatically ignored (external packages control naming):

```typescript
// ✅ Always allowed - import specifier
import { plr } from "external-package";
import { dt as deltaTime } from "another-package";
```

## Default Mappings

```typescript
{
  "plr": "player",
  "args": "parameters",
  "dt": "deltaTime",
  "char": "character"
}
```

## Configuration Examples

### Custom Shorthands

```typescript
{
  "cease-nonsense/no-shorthand-names": ["error", {
    "shorthands": {
      "cfg": "config",
      "ctx": "context",
      "req": "request",
      "res": "response",
      "db": "database"
    }
  }]
}
```

### With Glob Patterns

```typescript
{
  "cease-nonsense/no-shorthand-names": ["error", {
    "shorthands": {
      "*Btn": "*Button",
      "*Img": "*Image",
      "*Msg": "*Message",
      "str*": "string*"
    }
  }]
}
```

### With Regex Patterns

```typescript
{
  "cease-nonsense/no-shorthand-names": ["error", {
    "shorthands": {
      "/^e$/": "event",
      "/^i$/": "index",
      "/^(\\w+)Fn$/": "$1Function",
      "/^on(\\w+)Cb$/": "on$1Callback"
    }
  }]
}
```

### Allow Specific Contexts

```typescript
{
  "cease-nonsense/no-shorthand-names": ["error", {
    "shorthands": {
      "Props": "Properties"
    },
    "allowPropertyAccess": ["Props"],
    "ignoreShorthands": ["PropsWithChildren", "PropsWithoutRef"]
  }]
}
```

## Advanced Examples

### Nested Shorthands

```typescript
{
  "shorthands": {
    "plr": "player",
    "cfg": "config"
  }
}

// Before:
const plrCfgData = getData();

// After:
const playerConfigData = getData();
```

### Multiple Pattern Types

```typescript
{
  "shorthands": {
    "plr": "player",           // Exact
    "*Btn": "*Button",         // Glob
    "/^str/": "string"         // Regex
  }
}

// All matched:
const plr = getPlayer();       // plr → player
const submitBtn = button;      // submitBtn → submitButton
const strValue = "text";       // strValue → stringValue
```

### Ignored Patterns

```typescript
{
  "shorthands": {
    "Props": "Properties"
  },
  "ignoreShorthands": [
    "PropsWithChildren",
    "PropsWithoutRef",
    "*PropsInternal"
  ]
}

// ❌ Flagged:
interface UserProps {} // Error

// ✅ Ignored:
type PropsWithChildren = ...;
type ButtonPropsInternal = ...;
```

## Performance Optimizations

The rule includes several performance optimizations:

1. **Split Cache**: Caches word boundary splits (bounded at 1024 entries)
2. **Result Cache**: Caches full identifier results
3. **Pattern Precompilation**: Regex patterns compiled once
4. **Early Import Skip**: Skips import specifiers before any processing

## When Not To Use It

Consider disabling this rule if:

- You're working with an established codebase with shorthand conventions
- Your team has agreed-upon abbreviations (consider adding to `ignoreShorthands`)
- You're integrating with external libraries that use shorthands extensively

For specific exceptions:

```typescript
// Disable for specific line
const plr = getPlayer(); // eslint-disable-line cease-nonsense/no-shorthand-names

// Disable for file
/* eslint-disable cease-nonsense/no-shorthand-names */
```

## Migration Guide

### 1. Find All Violations

```bash
# List all violations
bun run lint | grep "no-shorthand-names"
```

### 2. Review Common Patterns

```typescript
// Find most common shorthands in your codebase
grep -r "const plr" src/ | wc -l
grep -r "const args" src/ | wc -l
grep -r "const dt" src/ | wc -l
```

### 3. Configure Ignores for Legacy Code

```typescript
{
  "ignoreShorthands": [
    "plrId",  // Legacy database column
    "argsRaw" // Legacy API parameter
  ]
}
```

### 4. Gradual Adoption

Enable rule with warnings first:

```typescript
{
  "cease-nonsense/no-shorthand-names": "warn"
}
```

## Common Shorthands to Replace

| Shorthand | Replacement  | Context                 |
|-----------|--------------|-------------------------|
| `plr`     | `player`     | Roblox player reference |
| `char`    | `character`  | Roblox character model  |
| `args`    | `parameters` | Function parameters     |
| `dt`      | `deltaTime`  | Frame time delta        |
| `cfg`     | `config`     | Configuration           |
| `ctx`     | `context`    | Context objects         |
| `req`     | `request`    | HTTP requests           |
| `res`     | `response`   | HTTP responses          |
| `db`      | `database`   | Database connections    |
| `btn`     | `button`     | UI buttons              |
| `img`     | `image`      | Images                  |
| `msg`     | `message`    | Messages                |

## Related Rules

- [prefer-pascal-case-enums](./prefer-pascal-case-enums.md) - Enforces PascalCase for enums
- [prefer-singular-enums](./prefer-singular-enums.md) - Enforces singular enum names

## Further Reading

- [Clean Code: Meaningful Names](https://www.amazon.com/Clean-Code-Handbook-Software-Craftsmanship/dp/0132350882)
- [Naming Conventions Guide](https://github.com/kettanaito/naming-cheatsheet)
- [Code Readability Research](https://www.sciencedirect.com/science/article/pii/S0164121218300323)
