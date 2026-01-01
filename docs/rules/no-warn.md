# no-warn

Bans use of `warn()` function calls. Use `Log` instead.

## Rule Details

The `warn()` function is a low-level warning mechanism that lacks structure, context, and log level control. Using a proper logging system like `Log` provides better debugging capabilities and production logging.

## Examples

### ❌ Incorrect

```typescript
warn("Warning message");
warn("Deprecated function called");
warn("Invalid configuration:", config);

function validateInput(input: string) {
	if (input.length === 0) {
		warn("Empty input detected");
	}
}
```

### ✅ Correct

```typescript
Log.warn("Warning message");
Log.warn("Deprecated function called");
Log.warn("Invalid configuration:", config);

function validateInput(input: string) {
	if (input.length === 0) {
		Log.warn("Empty input detected");
	}
}
```

## Why Use Log Instead?

### Structured Logging

`Log` provides structured output with timestamps, log levels, and context:

```typescript
// warn() - unstructured
warn("API endpoint deprecated");

// Log - structured with level and timestamp
Log.warn("API endpoint deprecated");
// [WARN] 2025-12-31 12:34:56 - API endpoint deprecated
```

### Centralized Control

Log systems can be configured globally:

```typescript
// Redirect all warnings to external service
Log.setHandler("warn", (message) => {
	sendToMonitoring(message);
});

// Suppress warnings in tests
if (isTestEnvironment) {
	Log.setLevel("error");
}
```

### Better Context

Add metadata and context to warnings:

```typescript
Log.warn("Deprecated API used", {
	endpoint: "/api/v1/users",
	replacement: "/api/v2/users",
	deprecationDate: "2025-01-01",
});
```

## When Not To Use It

If you're writing quick scripts or prototypes where structured logging isn't necessary, you may disable this rule. However, it's recommended to use proper logging even in development.

## Related Rules

- [no-print](./no-print.md) - Bans `print()` function calls

## Further Reading

- [Best Practices for Logging](https://www.dataset.com/blog/the-10-commandments-of-logging/)
- [Structured Logging](https://stackify.com/what-is-structured-logging-and-why-developers-need-it/)
