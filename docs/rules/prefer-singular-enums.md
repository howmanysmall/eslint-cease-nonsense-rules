# prefer-singular-enums

Enum names should be singular, not plural.

## Rule Details

Enum type names represent a single value from a set, not multiple values. Using singular names makes code more readable and aligns with TypeScript conventions.

## Examples

### ❌ Incorrect

```typescript
enum Colors {
	Red,
	Blue,
	Green,
}

enum Commands {
	Up,
	Down,
	Left,
	Right,
}

// Irregular plurals also caught
enum Feet {
	Left,
	Right,
}

enum People {
	Admin,
	User,
	Guest,
}

enum Children {
	Infant,
	Toddler,
	Teen,
}
```

### ✅ Correct

```typescript
enum Color {
	Red,
	Blue,
	Green,
}

enum Command {
	Up,
	Down,
	Left,
	Right,
}

enum Foot {
	Left,
	Right,
}

enum Person {
	Admin,
	User,
	Guest,
}

enum Child {
	Infant,
	Toddler,
	Teen,
}
```

## Why Singular?

### Represents Single Values

When you use an enum, you're selecting **one** value:

```typescript
// Confusing: sounds like multiple colors
const background: Colors = Colors.Red;

// Clear: one color
const background: Color = Color.Red;
```

### Consistent with TypeScript

TypeScript conventions use singular names for types representing single values:

```typescript
type User = {
	/* ... */
};
interface Product {
	/* ... */
}
enum Status {
	/* ... */
}

// Not:
type Users = {
	/* ... */
};
interface Products {
	/* ... */
}
enum Statuses {
	/* ... */
}
```

### Better in Context

```typescript
// Awkward
function setTheme(colors: Colors) {
	applyColor(colors);
}

// Natural
function setTheme(color: Color) {
	applyColor(color);
}
```

## Plurals

The rule detects both regular and irregular plural forms:

### Regular Plurals (add 's' or 'es')

- `Commands` → `Command`
- `Types` → `Type`
- `Statuses` → `Status`

### Irregular Plurals

- `Children` → `Child`
- `People` → `Person`
- `Feet` → `Foot`
- `Teeth` → `Tooth`
- `Mice` → `Mouse`
- `Geese` → `Goose`

## When Not To Use It

In rare cases where an enum truly represents a collection concept (like bit flags), plural names might be appropriate. However, these cases are uncommon, and you might want to use a different pattern:

```typescript
// Instead of plural enum
enum Permissions {
	Read = 1,
	Write = 2,
	Execute = 4,
}

// Consider bit flag pattern
enum Permission {
	Read = 1 << 0,
	Write = 1 << 1,
	Execute = 1 << 2,
}

type PermissionSet = number; // Represents multiple permissions
```

## Related Rules

- [prefer-pascal-case-enums](./prefer-pascal-case-enums.md) - Enforces PascalCase for enum names and members

## Further Reading

- [TypeScript Enum Best Practices](https://www.typescriptlang.org/docs/handbook/enums.html)
- [Naming Conventions](https://google.github.io/styleguide/tsguide.html#naming-style)
