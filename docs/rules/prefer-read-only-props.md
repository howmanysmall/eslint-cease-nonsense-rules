# prefer-read-only-props

Enforce that React component props are typed as read-only.

## Rule Details

This rule ensures that React component props are marked as `readonly` in TypeScript, preventing accidental mutation of props.

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```typescript
interface Props {
  name: string;
  age: number;
}

function Component({ name, age }: Props) {
  // ...
}
```

### ✅ Correct

```typescript
interface Props {
  readonly name: string;
  readonly age: number;
}

function Component({ name, age }: Props) {
  // ...
}
```

## Performance

This rule is optimized with:

- Direct AST pattern matching (no global component analysis)
- Component detection caching
- Focused on common React component patterns

## Related Rules

- `react/prefer-read-only-props` - Original rule (this is a faster replacement)
