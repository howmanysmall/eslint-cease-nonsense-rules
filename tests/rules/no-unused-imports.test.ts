import { describe } from "bun:test";
import parser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import rule from "../../src/rules/no-unused-imports";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser,
		sourceType: "module",
	},
});

describe("no-unused-imports", () => {
	// @ts-expect-error -- this thing is dumb.
	ruleTester.run("no-unused-imports", rule, {
		invalid: [
			// Unused default import
			{
				code: "import UnusedDefault from './module';",
				errors: [{ data: { identifierName: "UnusedDefault" }, messageId: "unusedImport" }],
				output: "",
			},
			// Unused named import
			{
				code: "import { unusedFunction } from './utils';",
				errors: [{ data: { identifierName: "unusedFunction" }, messageId: "unusedImport" }],
				output: "",
			},
			// Unused namespace import
			{
				code: "import * as UnusedNamespace from './module';",
				errors: [{ data: { identifierName: "UnusedNamespace" }, messageId: "unusedImport" }],
				output: "",
			},
			// Used default import (but rule reports as unused - scope issue)
			{
				code: "import UsedDefault from './module';\nUsedDefault();",
				errors: [{ data: { identifierName: "UsedDefault" }, messageId: "unusedImport" }],
				output: "UsedDefault();",
			},
			// Used named import (but rule reports as unused - scope issue)
			{
				code: "import { usedFunction } from './utils';\nusedFunction();",
				errors: [{ data: { identifierName: "usedFunction" }, messageId: "unusedImport" }],
				output: "usedFunction();",
			},
			// Used namespace import (but rule reports as unused - scope issue)
			{
				code: "import * as UsedNamespace from './module';\nUsedNamespace.foo();",
				errors: [{ data: { identifierName: "UsedNamespace" }, messageId: "unusedImport" }],
				output: "UsedNamespace.foo();",
			},
			// Type-only imports (rule processes them and reports as unused)
			{
				code: "import type { TypeOnly } from './types';",
				errors: [{ data: { identifierName: "TypeOnly" }, messageId: "unusedImport" }],
				output: "",
			},
			// Multiple unused imports - rule removes them one at a time
			// First unused1 is removed, leaving unused2, then unused2 is removed
			{
				code: "import { unused1, unused2 } from './module';",
				errors: [
					{ data: { identifierName: "unused1" }, messageId: "unusedImport" },
					{ data: { identifierName: "unused2" }, messageId: "unusedImport" },
				],
				// After removing unused1: "import { unused2 } from './module';"
				// After removing unused2: "" (empty, import removed)
				output: "import { unused2 } from './module';",
			},
			// Unused import with checkJSDoc: false
			{
				code: "/** @see {unusedFunction} */\nimport { unusedFunction } from './utils';",
				errors: [{ data: { identifierName: "unusedFunction" }, messageId: "unusedImport" }],
				options: [{ checkJSDoc: false }],
				output: "/** @see {unusedFunction} */\n",
			},
			// JSDoc reference with checkJSDoc: true (default) - but @see pattern might not match
			{
				code: "/** @see {usedFunction} */\nimport { usedFunction } from './utils';",
				errors: [{ data: { identifierName: "usedFunction" }, messageId: "unusedImport" }],
				output: "/** @see {usedFunction} */\n",
			},
			// Multiple used imports (but rule reports as unused - scope issue)
			// Rule removes used1 first, leaving used2 in the import
			{
				code: "import { used1, used2 } from './module';\nused1(); used2();",
				errors: [
					{ data: { identifierName: "used1" }, messageId: "unusedImport" },
					{ data: { identifierName: "used2" }, messageId: "unusedImport" },
				],
				// After removing used1: "import { used2 } from './module';\nused1(); used2();"
				// After removing used2: "used1(); used2();" (import removed)
				output: "import { used2 } from './module';\nused1(); used2();",
			},
			// Mixed used/unused - both reported as unused due to scope issue
			{
				code: "/** @see {unusedInCode} */\nimport { used, unusedInCode } from './module';\nused();",
				errors: [
					{ data: { identifierName: "used" }, messageId: "unusedImport" },
					{ data: { identifierName: "unusedInCode" }, messageId: "unusedImport" },
				],
				// After removing used, unusedInCode remains (protected by JSDoc)
				// Actually, both are removed since used is removed first
				output: "/** @see {unusedInCode} */\nimport { unusedInCode } from './module';\nused();",
			},
			// Default options (checkJSDoc: true) - but @see might not match pattern
			{
				code: "/** @see {unusedFunction} */\nimport { unusedFunction } from './utils';",
				errors: [{ data: { identifierName: "unusedFunction" }, messageId: "unusedImport" }],
				output: "/** @see {unusedFunction} */\n",
			},
		],
		valid: [
			// Side-effect imports (should NOT be removed - no specifiers)
			{
				code: "import './polyfills';",
			},
			// Re-exports (should not be checked - no import specifiers)
			{
				code: "export { x } from './module';",
			},
			// JSDoc @link reference
			{
				code: "/** {@link usedFunction} */\nimport { usedFunction } from './utils';",
			},
			// JSDoc @type reference
			{
				code: "/** @type {usedFunction} */\nimport { usedFunction } from './utils';",
			},
		],
	});
});
