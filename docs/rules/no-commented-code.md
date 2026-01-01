# no-commented-code

Detects and reports commented-out code blocks.

## Rule Details

Commented-out code clutters the codebase, causes confusion, and should be removed. Version control systems like Git preserve code history, making commented code unnecessary. This rule uses heuristic detection combined with parsing to identify commented code while minimizing false positives.

## Options

This rule has no configuration options.

## Examples

### ❌ Incorrect

```typescript
function calculate(x: number) {
	// const result = x * 2;
	// return result;

	/* if (x > 10) {
    return x;
  } */

	return x + 1;
}
```

```typescript
class UserService {
	// async fetchUser(id: number) {
	//   const response = await fetch(`/api/users/${id}`);
	//   return response.json();
	// }

	fetchUserSync(id: number) {
		return userCache.get(id);
	}
}
```

```typescript
const config = {
	timeout: 5000,
	// retryCount: 3,
	// retryDelay: 1000,
	// onError: (err) => console.error(err),
};
```

### ✅ Correct

```typescript
function calculate(x: number) {
	// TODO: Consider multiplying by 2 instead
	// Note: This is a simplified version
	return x + 1;
}
```

```typescript
class UserService {
	// Fetches user data synchronously from cache
	// Returns undefined if user is not in cache
	fetchUserSync(id: number) {
		return userCache.get(id);
	}
}
```

```typescript
const config = {
	timeout: 5000,
	// Configuration note: retry logic is handled by the network layer
	// See NetworkManager.ts for retry implementation
};
```

## Detection Algorithm

### Step 1: Comment Grouping

The rule groups adjacent line comments and individual block comments:

```typescript
// These three comments are grouped together
// because they are adjacent line comments
// on consecutive lines

/* This block comment is its own group */
```

### Step 2: Heuristic Filtering

Uses pattern-based detection to identify code-like content:

- Contains JavaScript keywords (`function`, `const`, `if`, `return`, etc.)
- Has code-like structure (braces, parentheses, operators)
- Matches common code patterns

```typescript
// ✅ Not flagged (natural language)
// This function handles user authentication

// ❌ Flagged (code-like)
// function handleAuth(user) { return user.isValid(); }
```

### Step 3: Parse Validation

Attempts to parse the comment content as JavaScript/TypeScript to confirm it's valid code:

```typescript
// ❌ Flagged - parses successfully as code
// const x = 42;
// return x + 1;

// ✅ Not flagged - doesn't parse as valid code
// To do this properly you need to first validate
```

### Step 4: Exclusion Rules

Certain patterns are excluded even if they parse as code:

**Single statements** that are likely false positives:

- `break`
- `continue`
- `return` (without complex expression)
- Single identifiers
- String or number literals

```typescript
// ✅ Not flagged (exclusions)
// return;
// continue;
// MAX_COUNT;
// "debug mode";
```

## Suggestions

The rule provides a suggestion to automatically remove commented code:

```typescript
// ESLint suggestion: "Remove this commented out code"

// const unused = fetchData();
// processData(unused);

// Click the suggestion to remove these lines
```

## Advanced Examples

### Multi-Line Comments

```typescript
// ❌ Flagged - multiple lines of code
// function processUser(user) {
//   const data = transform(user);
//   save(data);
//   return data;
// }

// ✅ Not flagged - multi-line documentation
// This function processes user data by:
// 1. Transforming the input
// 2. Saving to database
// 3. Returning the result
```

### Block Comments

```typescript
// ❌ Flagged
/*
const config = {
  host: 'localhost',
  port: 3000
};
*/

// ✅ Not flagged
/*
 * Configuration options:
 * - host: Server hostname
 * - port: Server port number
 */
```

### JSX Comments

```typescript
// ❌ Flagged
{
	/* <Button onClick={handleClick}>
  <Text>Submit</Text>
</Button> */
}

// ✅ Not flagged
{
	/* TODO: Add button here */
}
```

### Mixed Content

```typescript
// ❌ Flagged (contains code)
// The old implementation used this approach:
// if (user.age > 18) { return true; }

// ✅ Not flagged (mainly documentation)
// The old implementation used a different approach
// involving age validation and permission checks
```

## Edge Cases

### Missing Braces

The rule intelligently injects missing braces to handle partially commented code:

```typescript
// ❌ Still flagged even with missing closing brace
// if (condition) {
//   doSomething();
```

### Syntax Errors

Comments with minor syntax errors may still be detected:

```typescript
// ❌ Flagged despite missing semicolon
// const x = 42
// return x
```

### TypeScript-Specific

The rule handles both JavaScript and TypeScript:

```typescript
// ❌ Flagged (TypeScript code)
// const user: User = {
//   id: 1,
//   name: 'John'
// };

// ❌ Flagged (JSX/TSX code)
// <div className="container">
//   <span>Hello</span>
// </div>
```

## When Not To Use It

Consider disabling this rule if:

- You frequently use commented code for debugging during development
- Your team uses commented code to show examples in documentation
- You have a legacy codebase with extensive commented code that needs gradual cleanup

For these scenarios, consider:

- Using `// eslint-disable-next-line no-commented-code` for specific cases
- Creating a separate branch for cleanup
- Using IDE features for temporary code disabling instead of comments

## False Positives

The rule is designed to minimize false positives, but some may occur:

### Documentation with Code-Like Syntax

```typescript
// ✅ Might be incorrectly flagged
// The API returns: { status: 200, data: {...} }
```

**Solution**: Rephrase to be less code-like:

```typescript
// ✅ Better documentation
// The API returns an object with status and data properties
```

### Regular Expressions in Documentation

```typescript
// ✅ Might be incorrectly flagged
// Use pattern: /^[A-Z]/

// ✅ Better
// Use a regex pattern starting with capital letters
```

## Best Practices

### Use Version Control

Instead of commenting code:

```typescript
// ❌ Bad
// function oldImplementation() {
//   return legacyLogic();
// }

function newImplementation() {
	return modernLogic();
}
```

```typescript
// ✅ Good - just delete it
function newImplementation() {
	return modernLogic();
}

// Git history preserves the old implementation
```

### Use TODO Comments

For future implementation:

```typescript
// ❌ Bad
// function featureNotReady() {
//   return implementation();
// }

// ✅ Good
// TODO: Implement feature
// See ticket #123 for requirements
```

### Use Feature Flags

For conditional code:

```typescript
// ❌ Bad
// if (USE_NEW_FEATURE) {
//   return newLogic();
// }
return oldLogic();

// ✅ Good
if (featureFlags.isEnabled("newFeature")) {
	return newLogic();
}
return oldLogic();
```

## Related Rules

- [no-console](https://eslint.org/docs/rules/no-console) - Prevents debug console statements
- [no-debugger](https://eslint.org/docs/rules/no-debugger) - Prevents debugger statements

## Further Reading

- [Clean Code: Comments](https://www.amazon.com/Clean-Code-Handbook-Software-Craftsmanship/dp/0132350882)
- [Code Comments Best Practices](https://stackoverflow.blog/2021/12/23/best-practices-for-writing-code-comments/)
- [Why Commented Code is Bad](https://kentcdodds.com/blog/please-dont-commit-commented-out-code)
