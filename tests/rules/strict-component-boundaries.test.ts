import { describe } from "bun:test";
import { RuleTester } from "eslint";
import rule from "../../src/rules/strict-component-boundaries";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		sourceType: "module",
	},
});

const errors = [
	{
		message:
			"Do not reach into an individual component's folder for nested modules. Import from the closest shared components folder instead.",
		type: "ImportDeclaration",
	},
];

describe("strict-component-boundaries", () => {
	// @ts-expect-error Loser
	ruleTester.run("strict-component-boundaries", rule, {
		invalid: [
			// From outside components, reaching into a specific component
			{
				code: "import someThing from './components/Foo';",
				errors,
				filename: "basic-app/app/index.js",
			},
			// Reaching into another component and going deeper
			{
				code: "import someThing from '../Bar/any-path';",
				errors,
				filename: "basic-app/app/components/Foo/index.js",
			},
			{
				code: "import someThing from './components/Bar/any-path';",
				errors,
				filename: "basic-app/app/index.js",
			},
			// PascalCase component before fixtures
			{
				code: "import someThing from '../Bar/tests/fixtures/SomeMockQuery/query.json';",
				errors,
				filename: "basic-app/app/components/Foo/index.js",
			},
			// Allow pattern matches but import goes deeper
			{
				code: "import someThing from './components/Foo/Foo';",
				errors,
				filename: "basic-app/app/index.js",
				options: [{ allow: [String.raw`components/\w+$`] }],
			},
			// MaxDepth exceeded
			{
				code: "import someThing from './components/Foo/Foo';",
				errors,
				filename: "basic-app/app/index.js",
				options: [{ maxDepth: 2 }],
			},
		],
		valid: [
			// Importing components folder itself (no PascalCase reached)
			{
				code: "import {someThing} from './components';",
				filename: "basic-app/app/index.js",
			},
			// Sibling component import
			{
				code: "import {someThing} from '../Bar';",
				filename: "basic-app/app/components/Foo/index.js",
			},
			// Non-relative import (package)
			{
				code: "import {getDisplayName} from '@shopify/react-utilities/components';",
				filename: "basic-app/app/sections/MySection/MySection.js",
			},
			// No PascalCase in path
			{
				code: "import someUtility from './utilities/someUtility';",
				filename: "basic-app/app/sections/MySection/MySection.js",
			},
			// Fixtures before PascalCase
			{
				code: "import someThing from './tests/fixtures/SomeMockQuery/query.json';",
				filename: "basic-app/app/components/Foo/index.js",
			},
			// Going up then into shared components
			{
				code: "import {someThing} from '../../components/Bar';",
				filename: "basic-app/app/components/Foo/index.js",
			},
			// Sibling component from nested component
			{
				code: "import {someThing} from '../Baz';",
				filename: "basic-app/app/components/Foo/components/Bar/index.js",
			},
			// File import (has extension)
			{
				code: "import {someThing} from '../../Foo.scss';",
				filename: "basic-app/app/components/Foo/components/Bar/index.js",
			},
			// Allow pattern matches
			{
				code: "import someThing from './components/Foo';",
				filename: "basic-app/app/index.js",
				options: [{ allow: [String.raw`components/\w+$`] }],
			},
			// MaxDepth increased
			{
				code: "import someThing from './components/Foo';",
				filename: "basic-app/app/index.js",
				options: [{ maxDepth: 2 }],
			},
			// Absolute paths with PascalCase system directories (Users, Documents)
			// Should NOT cause false positives. File is in src/shared (not a component folder).
			// Import has 2 segments, maxDepth 2, should be valid.
			// BUG: isInComponent wrongly returns true due to PascalCase dirs in absolute path
			{
				code: "import { something } from './SomeModule/index';",
				filename: "/Users/developer/Code/project/src/shared/manager/processor.ts",
				options: [{ maxDepth: 2 }],
			},
			{
				code: "import { API } from '../DataService/api';",
				filename: "/home/Documents/workspace/app/src/services/index.ts",
				options: [{ maxDepth: 2 }],
			},
		],
	});
});
