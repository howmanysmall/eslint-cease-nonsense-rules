import { describe } from "vitest";
import rule from "$rules/no-unused-imports";
import parser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";

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
			{
				code: "import UnusedDefault from './module';",
				errors: [{ data: { identifierName: "UnusedDefault" }, messageId: "unusedImport" }],
				output: "",
			},
			{
				code: "import { unusedFunction } from './utils';",
				errors: [{ data: { identifierName: "unusedFunction" }, messageId: "unusedImport" }],
				output: "",
			},
			{
				code: "import * as UnusedNamespace from './module';",
				errors: [{ data: { identifierName: "UnusedNamespace" }, messageId: "unusedImport" }],
				output: "",
			},
			{
				code: "import type { TypeOnly } from './types';",
				errors: [{ data: { identifierName: "TypeOnly" }, messageId: "unusedImport" }],
				output: "",
			},
			{
				code: "import { unused1, unused2 } from './module';",
				errors: [
					{ data: { identifierName: "unused1" }, messageId: "unusedImport" },
					{ data: { identifierName: "unused2" }, messageId: "unusedImport" },
				],
				output: "import { unused2 } from './module';",
			},
			{
				code: "/** @see {unusedFunction} */\nimport { unusedFunction } from './utils';",
				errors: [{ data: { identifierName: "unusedFunction" }, messageId: "unusedImport" }],
				options: [{ checkJSDoc: false }],
				output: "/** @see {unusedFunction} */\n",
			},
			{
				code: "/** @see {} */\nimport { unusedFunction } from './utils';",
				errors: [{ data: { identifierName: "unusedFunction" }, messageId: "unusedImport" }],
				output: "/** @see {} */\n",
			},
			{
				code: "import { used, unused } from './module';\nused();",
				errors: [{ data: { identifierName: "unused" }, messageId: "unusedImport" }],
				output: "import { used } from './module';\nused();",
			},
			{
				code: "import { used, unused, kept } from './module';\nused();\nkept();",
				errors: [{ data: { identifierName: "unused" }, messageId: "unusedImport" }],
				output: "import { used, kept } from './module';\nused();\nkept();",
			},
			{
				code: "import { unused, kept } from './module';\nkept();",
				errors: [{ data: { identifierName: "unused" }, messageId: "unusedImport" }],
				output: "import { kept } from './module';\nkept();",
			},
			{
				code: "import { kept, unused } from './module';\nkept();",
				errors: [{ data: { identifierName: "unused" }, messageId: "unusedImport" }],
				output: "import { kept } from './module';\nkept();",
			},
			{
				code: "import { unused as alias, kept } from './module';\nkept();",
				errors: [{ data: { identifierName: "alias" }, messageId: "unusedImport" }],
				output: "import { kept } from './module';\nkept();",
			},
			{
				code: "import UnusedDefault, { kept } from './module';\nkept();",
				errors: [{ data: { identifierName: "UnusedDefault" }, messageId: "unusedImport" }],
				output: "import { kept } from './module';\nkept();",
			},
			{
				code: "import UsedDefault, { unused } from './module';\nUsedDefault();",
				errors: [{ data: { identifierName: "unused" }, messageId: "unusedImport" }],
				output: "import UsedDefault from './module';\nUsedDefault();",
			},
			{
				code: "import { Unused }\nfrom './module';\n\nconst value = 1;",
				errors: [{ data: { identifierName: "Unused" }, messageId: "unusedImport" }],
				output: "\n\nconst value = 1;",
			},
		],
		valid: [
			{
				code: "import UsedDefault from './module';\nUsedDefault();",
			},
			{
				code: "import { usedFunction } from './utils';\nusedFunction();",
			},
			{
				code: "import * as UsedNamespace from './module';\nUsedNamespace.foo();",
			},
			{
				code: "import './polyfills';",
			},
			{
				code: "export { x } from './module';",
			},
			{
				code: "/** @see {usedFunction} */\nimport { usedFunction } from './utils';",
			},
			{
				code: "/** {@link usedFunction} */\nimport { usedFunction } from './utils';",
			},
			{
				code: "/** @type {usedFunction} */\nimport { usedFunction } from './utils';",
			},
			{
				code: "// @see {unusedFunction}\nimport { usedFunction } from './utils';\nusedFunction();",
			},
		],
	});
});
