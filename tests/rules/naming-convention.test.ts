import nodePath from "node:path";
import { describe } from "vitest";
import rule from "$rules/naming-convention";
import parser from "@typescript-eslint/parser";
import { RuleTester } from "@typescript-eslint/rule-tester";

const __dirname = import.meta.dirname;
const fromFixturesDir = nodePath.resolve(__dirname, "..", "fixtures", "naming-convention", "from-match");
const fromFixturesProject = nodePath.join(fromFixturesDir, "tsconfig.json");
const fromFixturesCase = "case.ts";
const absoluteLocalThingSpecifier = nodePath.join(fromFixturesDir, "src/shared/local-thing");

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser,
		sourceType: "module",
	},
});

const ruleTesterWithTypes = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser,
		parserOptions: {
			projectService: {
				allowDefaultProject: ["*.ts", "*.tsx"],
				maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 64,
			},
			tsconfigRootDir: __dirname,
		},
		sourceType: "module",
	},
});

const ruleTesterWithFromFixtures = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser,
		parserOptions: {
			project: fromFixturesProject,
			tsconfigRootDir: fromFixturesDir,
		},
		sourceType: "module",
	},
});

describe("naming-convention", () => {
	ruleTester.run("naming-convention", rule, {
		invalid: [
			{
				code: "const foo_bar = 1;",
				errors: [{ messageId: "doesNotMatchFormat" }],
			},
			{
				code: "function FooBar() {}",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["camelCase"], selector: "function" }],
			},
			{
				code: "class foo {}",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["PascalCase"], selector: "class" }],
			},
			{
				code: "import * as fooBar from 'foo_bar';",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [
					{ format: ["camelCase"], selector: "import" },
					{ format: ["PascalCase"], modifiers: ["namespace"], selector: "import" },
				],
			},
			{
				code: "interface IFoo {}",
				errors: [{ messageId: "satisfyCustom" }],
				options: [
					{
						custom: { match: false, regex: "^I[A-Z]" },
						format: ["PascalCase"],
						selector: "typeLike",
					},
				],
			},

			// Test strictCamelCase format - consecutive uppercase rejected
			{
				code: "const fooBAR = 1;",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["strictCamelCase"], selector: "variable" }],
			},

			// Test StrictPascalCase format - consecutive uppercase rejected
			{
				code: "class FOOBar {}",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["StrictPascalCase"], selector: "class" }],
			},

			// Test strictCamelCase - first char uppercase rejected
			{
				code: "const FooBar = 1;",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["strictCamelCase"], selector: "variable" }],
			},

			// Test snake_case - starting underscore rejected
			{
				code: "const _foo_bar = 1;",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["snake_case"], selector: "variable" }],
			},

			// Test snake_case - uppercase rejected
			{
				code: "const Foo_Bar = 1;",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["snake_case"], selector: "variable" }],
			},

			// Test snake_case - consecutive underscores rejected
			{
				code: "const foo__bar = 1;",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["snake_case"], selector: "variable" }],
			},

			// Test snake_case - trailing underscore rejected
			{
				code: "const foo_bar_ = 1;",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["snake_case"], selector: "variable" }],
			},

			// Test UPPER_CASE - starting underscore rejected
			{
				code: "const _FOO_BAR = 1;",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["UPPER_CASE"], selector: "variable" }],
			},

			// Test UPPER_CASE - lowercase rejected
			{
				code: "const foo_bar = 1;",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["UPPER_CASE"], selector: "variable" }],
			},

			// Test UPPER_CASE - consecutive underscores rejected
			{
				code: "const FOO__BAR = 1;",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["UPPER_CASE"], selector: "variable" }],
			},

			// Test filter option with string - matching name but wrong format
			{
				code: "const fooTest = 1;",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ filter: "Test$", format: ["UPPER_CASE"], selector: "variable" }],
			},

			// Test filter option with object - match: true
			{
				code: "const fooTest = 1;",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ filter: { match: true, regex: "Test$" }, format: ["UPPER_CASE"], selector: "variable" }],
			},

			// Test filter option with object - match: false, name doesn't match so rule applies
			{
				code: "const fooBar = 1;",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ filter: { match: false, regex: "Test$" }, format: ["UPPER_CASE"], selector: "variable" }],
			},

			// Test prefix requirement failure
			{
				code: "const fooBar = 1;",
				errors: [{ messageId: "missingAffix" }],
				options: [{ format: ["camelCase"], prefix: ["pre_", "pfx_"], selector: "variable" }],
			},

			// Test suffix requirement failure
			{
				code: "const fooBar = 1;",
				errors: [{ messageId: "missingAffix" }],
				options: [{ format: ["camelCase"], selector: "variable", suffix: ["_suf", "_sfx"] }],
			},

			// Test leading underscore forbid
			{
				code: "const _fooBar = 1;",
				errors: [{ messageId: "unexpectedUnderscore" }],
				options: [{ format: ["camelCase"], leadingUnderscore: "forbid", selector: "variable" }],
			},

			// Test trailing underscore forbid
			{
				code: "const fooBar_ = 1;",
				errors: [{ messageId: "unexpectedUnderscore" }],
				options: [{ format: ["camelCase"], selector: "variable", trailingUnderscore: "forbid" }],
			},

			// Test leading underscore require
			{
				code: "const fooBar = 1;",
				errors: [{ messageId: "missingUnderscore" }],
				options: [{ format: ["camelCase"], leadingUnderscore: "require", selector: "variable" }],
			},

			// Test trailing underscore require
			{
				code: "const fooBar = 1;",
				errors: [{ messageId: "missingUnderscore" }],
				options: [{ format: ["camelCase"], selector: "variable", trailingUnderscore: "require" }],
			},

			// Test leading underscore requireDouble
			{
				code: "const _fooBar = 1;",
				errors: [{ messageId: "missingUnderscore" }],
				options: [{ format: ["camelCase"], leadingUnderscore: "requireDouble", selector: "variable" }],
			},

			// Test trailing underscore requireDouble
			{
				code: "const fooBar_ = 1;",
				errors: [{ messageId: "missingUnderscore" }],
				options: [{ format: ["camelCase"], selector: "variable", trailingUnderscore: "requireDouble" }],
			},

			// Test custom regex match: true fails when name doesn't match
			{
				code: "const fooBar = 1;",
				errors: [{ messageId: "satisfyCustom" }],
				options: [{ custom: { match: true, regex: "^test" }, format: ["camelCase"], selector: "variable" }],
			},

			// Test custom regex match: false fails when name matches
			{
				code: "const testBar = 1;",
				errors: [{ messageId: "satisfyCustom" }],
				options: [{ custom: { match: false, regex: "^test" }, format: ["camelCase"], selector: "variable" }],
			},

			// Test StrictPascalCase with underscore
			{
				code: "class Foo_Bar {}",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["StrictPascalCase"], selector: "class" }],
			},

			// Test strictCamelCase with underscore
			{
				code: "const foo_bar = 1;",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["strictCamelCase"], selector: "variable" }],
			},

			// Test format check after trimming (doesNotMatchFormatTrimmed)
			{
				code: "const _fooBAR = 1;",
				errors: [{ messageId: "doesNotMatchFormatTrimmed" }],
				options: [{ format: ["strictCamelCase"], leadingUnderscore: "allow", selector: "variable" }],
			},

			// Test typeMethod selector
			{
				code: "interface Foo { FooMethod(): void; }",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["camelCase"], selector: "typeMethod" }],
			},

			// Test typeProperty selector
			{
				code: "interface Foo { FOO: number; }",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["camelCase"], selector: "typeProperty" }],
			},

			// Test classicAccessor selector on class
			{
				code: "class Foo { get FOO() { return 1; } }",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["camelCase"], selector: "classicAccessor" }],
			},

			// Test enumMember selector
			{
				code: "enum Foo { FOO_BAR }",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["camelCase"], selector: "enumMember" }],
			},

			// Test typeAlias selector
			{
				code: "type foo_bar = string;",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["PascalCase"], selector: "typeAlias" }],
			},
		],
		valid: [
			// Declaration files are ignored
			{
				code: "interface vector { x: number; }",
				filename: "src/types/global.d.ts",
			},
			{
				code: "interface _G { x: number; }",
				filename: "src/types/roblox.d.ts",
			},
			{
				code: "const fooBar = 1;",
			},
			{
				code: "function fooBar() {}",
				options: [{ format: ["camelCase"], selector: "function" }],
			},
			{
				code: "class Foo {}",
				options: [{ format: ["PascalCase"], selector: "class" }],
			},
			{
				code: "import fooBar from 'foo_bar';",
				options: [{ format: ["camelCase"], selector: "import" }],
			},
			{
				code: "interface Foo {}",
				options: [
					{
						custom: { match: false, regex: "^I[A-Z]" },
						format: ["PascalCase"],
						selector: "typeLike",
					},
				],
			},

			// Test strictCamelCase valid
			{
				code: "const fooBar = 1;",
				options: [{ format: ["strictCamelCase"], selector: "variable" }],
			},

			// Test StrictPascalCase valid
			{
				code: "class FooBar {}",
				options: [{ format: ["StrictPascalCase"], selector: "class" }],
			},

			// Test snake_case valid
			{
				code: "const foo_bar = 1;",
				options: [{ format: ["snake_case"], selector: "variable" }],
			},

			// Test UPPER_CASE valid
			{
				code: "const FOO_BAR = 1;",
				options: [{ format: ["UPPER_CASE"], selector: "variable" }],
			},

			// Test empty string handled
			{
				code: "const x = 1;",
				options: [{ format: ["camelCase"], selector: "variable" }],
			},

			// Test filter - name doesn't match filter so rule doesn't apply
			{
				code: "const fooBar = 1;",
				options: [{ filter: "Test$", format: ["UPPER_CASE"], selector: "variable" }],
			},

			// Test filter with match: false - name matches filter so rule doesn't apply
			{
				code: "const fooTest = 1;",
				options: [{ filter: { match: false, regex: "Test$" }, format: ["UPPER_CASE"], selector: "variable" }],
			},

			// Test prefix with valid prefix
			{
				code: "const pre_fooBar = 1;",
				options: [{ format: ["camelCase"], prefix: ["pre_", "pfx_"], selector: "variable" }],
			},

			// Test suffix with valid suffix
			{
				code: "const fooBar_suf = 1;",
				options: [{ format: ["camelCase"], selector: "variable", suffix: ["_suf", "_sfx"] }],
			},

			// Test leading underscore allow
			{
				code: "const _fooBar = 1;",
				options: [{ format: ["camelCase"], leadingUnderscore: "allow", selector: "variable" }],
			},

			// Test trailing underscore allow
			{
				code: "const fooBar_ = 1;",
				options: [{ format: ["camelCase"], selector: "variable", trailingUnderscore: "allow" }],
			},

			// Test leading underscore allowDouble
			{
				code: "const __fooBar = 1;",
				options: [{ format: ["camelCase"], leadingUnderscore: "allowDouble", selector: "variable" }],
			},

			// Test trailing underscore allowDouble
			{
				code: "const fooBar__ = 1;",
				options: [{ format: ["camelCase"], selector: "variable", trailingUnderscore: "allowDouble" }],
			},

			// Test leading underscore allowSingleOrDouble with single
			{
				code: "const _fooBar = 1;",
				options: [{ format: ["camelCase"], leadingUnderscore: "allowSingleOrDouble", selector: "variable" }],
			},

			// Test leading underscore allowSingleOrDouble with double
			{
				code: "const __fooBar = 1;",
				options: [{ format: ["camelCase"], leadingUnderscore: "allowSingleOrDouble", selector: "variable" }],
			},

			// Test trailing underscore allowSingleOrDouble with single
			{
				code: "const fooBar_ = 1;",
				options: [{ format: ["camelCase"], selector: "variable", trailingUnderscore: "allowSingleOrDouble" }],
			},

			// Test trailing underscore allowSingleOrDouble with double
			{
				code: "const fooBar__ = 1;",
				options: [{ format: ["camelCase"], selector: "variable", trailingUnderscore: "allowSingleOrDouble" }],
			},

			// Test leading underscore require
			{
				code: "const _fooBar = 1;",
				options: [{ format: ["camelCase"], leadingUnderscore: "require", selector: "variable" }],
			},

			// Test trailing underscore require
			{
				code: "const fooBar_ = 1;",
				options: [{ format: ["camelCase"], selector: "variable", trailingUnderscore: "require" }],
			},

			// Test leading underscore requireDouble
			{
				code: "const __fooBar = 1;",
				options: [{ format: ["camelCase"], leadingUnderscore: "requireDouble", selector: "variable" }],
			},

			// Test trailing underscore requireDouble - valid double underscore
			{
				code: "const fooBar__ = 1;",
				options: [{ format: ["camelCase"], selector: "variable", trailingUnderscore: "requireDouble" }],
			},

			// Test leading underscore requireDouble - valid double underscore
			{
				code: "const __foobar = 1;",
				options: [{ format: ["camelCase"], leadingUnderscore: "requireDouble", selector: "variable" }],
			},

			// Test both leading and trailing underscores with requireDouble
			{
				code: "const __foo__ = 1;",
				options: [
					{
						format: ["camelCase"],
						leadingUnderscore: "requireDouble",
						selector: "variable",
						trailingUnderscore: "requireDouble",
					},
				],
			},

			// Test custom regex match: true passes
			{
				code: "const testBar = 1;",
				options: [{ custom: { match: true, regex: "^test" }, format: ["camelCase"], selector: "variable" }],
			},

			// Test custom regex match: false passes
			{
				code: "const fooBar = 1;",
				options: [{ custom: { match: false, regex: "^test" }, format: ["camelCase"], selector: "variable" }],
			},

			// Test variableLike meta selector
			{
				code: "const fooBar = 1; function fooFn() {} function test(fooParam: string) {}",
				options: [{ format: ["camelCase"], selector: "variableLike" }],
			},

			// Test memberLike meta selector
			{
				code: "class Foo { fooBar = 1; fooMethod() {} }",
				options: [{ format: ["camelCase"], selector: "memberLike" }],
			},

			// Test empty name (empty string)
			{
				code: "const obj = { '': 1 };",
				options: [{ format: ["camelCase"], selector: "objectLiteralProperty" }],
			},

			// Test allowDouble without double underscore (should pass through)
			{
				code: "const fooBar = 1;",
				options: [{ format: ["camelCase"], leadingUnderscore: "allowDouble", selector: "variable" }],
			},

			// Test allowSingleOrDouble without underscore (should pass through)
			{
				code: "const fooBar = 1;",
				options: [{ format: ["camelCase"], leadingUnderscore: "allowSingleOrDouble", selector: "variable" }],
			},

			// Test trailing allowDouble without double underscore
			{
				code: "const fooBar = 1;",
				options: [{ format: ["camelCase"], selector: "variable", trailingUnderscore: "allowDouble" }],
			},

			// Test trailing allowSingleOrDouble without underscore
			{
				code: "const fooBar = 1;",
				options: [{ format: ["camelCase"], selector: "variable", trailingUnderscore: "allowSingleOrDouble" }],
			},

			// Test modifier filtering - config with modifiers that don't match
			{
				code: "class Foo { static foo = 1; }",
				options: [
					{ format: ["UPPER_CASE"], modifiers: ["readonly"], selector: "classProperty" },
					{ format: ["camelCase"], selector: "classProperty" },
				],
			},

			// Test sorting by modifierWeight when selectorPriority is same
			// Global has higher weight than const, so global rule wins - use UPPER_CASE for global vars
			{
				code: "const FOO_BAR = 1;",
				options: [
					{ format: ["camelCase"], modifiers: ["const"], selector: "variable" },
					{ format: ["UPPER_CASE"], modifiers: ["global"], selector: "variable" },
				],
			},

			// Test sorting with equal selectorPriority and modifierWeight
			{
				code: "const fooBar = 1;",
				options: [
					{ format: ["camelCase"], selector: "variable" },
					{ format: ["PascalCase", "camelCase"], selector: "variable" },
				],
			},

			// Test forbid trailing underscore - no underscore present (valid case)
			{
				code: "const fooBar = 1;",
				options: [{ format: ["camelCase"], selector: "variable", trailingUnderscore: "forbid" }],
			},

			// Test forbid leading underscore - no underscore present (valid case)
			{
				code: "const fooBar = 1;",
				options: [{ format: ["camelCase"], leadingUnderscore: "forbid", selector: "variable" }],
			},

			// Test StrictPascalCase with multiple humps
			{
				code: "class FooBarBaz {}",
				options: [{ format: ["StrictPascalCase"], selector: "class" }],
			},

			// Test format with multiple options - name matches format
			{
				code: "const ANY_CASE = 1;",
				options: [{ format: ["UPPER_CASE", "camelCase"], selector: "variable" }],
			},

			// Test single char name for strictCamelCase
			{
				code: "const x = 1;",
				options: [{ format: ["strictCamelCase"], selector: "variable" }],
			},

			// Test single char name for StrictPascalCase
			{
				code: "class X {}",
				options: [{ format: ["StrictPascalCase"], selector: "class" }],
			},

			// Test requiresQuotes modifier
			{
				code: "const obj = { 'kebab-case': 1 };",
				options: [{ format: ["camelCase"], selector: "objectLiteralProperty" }],
			},

			// Test selector with array of selectors
			{
				code: "const fooBar = 1; function fooFn() {}",
				options: [{ format: ["camelCase"], selector: ["variable", "function"] }],
			},

			// Test filter with format - filter matches and format passes
			{
				code: "const fooTest = 1;",
				options: [{ filter: "Test$", format: ["camelCase"], selector: "variable" }],
			},

			// Test types option without parser services - falls back to allowing the name
			{
				code: "const fooBar = 1;",
				options: [{ format: ["camelCase"], selector: "variable", types: ["string"] }],
			},

			// Test empty format array - validator returns early
			{
				code: "const anythingGoes = 1;",
				options: [{ format: [], selector: "variable" }],
			},

			// Test PascalCase valid cases
			{
				code: "class FooBar {}",
				options: [{ format: ["PascalCase"], selector: "class" }],
			},

			// Test camelCase valid cases
			{
				code: "const fooBar = 1;",
				options: [{ format: ["camelCase"], selector: "variable" }],
			},

			// Test StrictPascalCase with single letter
			{
				code: "class T {}",
				options: [{ format: ["StrictPascalCase"], selector: "class" }],
			},

			// Test strictCamelCase with consecutive lowercase
			{
				code: "const foobar = 1;",
				options: [{ format: ["strictCamelCase"], selector: "variable" }],
			},

			// Test UPPER_CASE with single letter
			{
				code: "const X = 1;",
				options: [{ format: ["UPPER_CASE"], selector: "variable" }],
			},

			// Test snake_case with single letter
			{
				code: "const x = 1;",
				options: [{ format: ["snake_case"], selector: "variable" }],
			},

			// Test selector priority - specific selector over meta selector
			{
				code: "const FOO_BAR = 1;",
				options: [
					{ format: ["camelCase"], selector: "default" },
					{ format: ["UPPER_CASE"], selector: "variable" },
				],
			},

			// Test filter priority is highest
			{
				code: "const FOO_TEST = 1;",
				options: [
					{ format: ["camelCase"], selector: "variable" },
					{ filter: "TEST$", format: ["UPPER_CASE"], selector: "variable" },
				],
			},
			// Test multiple configs for the same selector
			{
				code: "const fooBar = 1;",
				options: [
					{ format: ["camelCase"], selector: "variable" },
					{ format: ["camelCase"], leadingUnderscore: "allow", selector: "variable" },
				],
			},
		],
	});

	ruleTester.run("naming-convention-coverage", rule, {
		invalid: [
			// Test exported variable (lines 168-169, 496)
			{
				code: "export const foo_bar = 1;",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["UPPER_CASE"], modifiers: ["exported"], selector: "variable" }],
			},

			// Test exported function (line 267)
			{
				code: "export function foo_bar() {}",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["camelCase"], modifiers: ["exported"], selector: "function" }],
			},

			// Test exported class with abstract (lines 231, 235)
			{
				code: "export abstract class foo_bar {}",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["PascalCase"], modifiers: ["exported", "abstract"], selector: "class" }],
			},

			// Test exported enum (line 368)
			{
				code: "export enum foo_bar { A }",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["PascalCase"], modifiers: ["exported"], selector: "enum" }],
			},

			// Test exported interface (line 397)
			{
				code: "export interface foo_bar {}",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["PascalCase"], modifiers: ["exported"], selector: "interface" }],
			},

			// Test exported type alias (line 446)
			{
				code: "export type foo_bar = string;",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["PascalCase"], modifiers: ["exported"], selector: "typeAlias" }],
			},

			// Test async function (line 275)
			{
				code: "async function foo_bar() {}",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["camelCase"], modifiers: ["async"], selector: "function" }],
			},

			// Test async variable (line 504)
			{
				code: "const foo_bar = async () => {};",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["camelCase"], modifiers: ["async"], selector: "variable" }],
			},

			// Test destructured parameter (line 304)
			{
				code: "function fn({ foo_bar }: { foo_bar: string }) { return foo_bar; }",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["camelCase"], modifiers: ["destructured"], selector: "parameter" }],
			},

			// Test type parameter (lines 458-465)
			{
				code: "function fn<foo_bar>() {}",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["PascalCase"], selector: "typeParameter" }],
			},

			// Test TSParameterProperty (lines 420-425) - use default selector
			{
				code: "class Foo { constructor(public foo_bar: string) {} }",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["camelCase"], selector: "parameterProperty" }],
			},

			// Test readonly type property (line 434)
			{
				code: "interface Foo { readonly foo_bar: string; }",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["camelCase"], modifiers: ["readonly"], selector: "typeProperty" }],
			},

			// Test object literal getter (lines 356-357)
			{
				code: "const obj = { get foo_bar() { return 1; } };",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["camelCase"], selector: "classicAccessor" }],
			},

			// Test object literal setter (lines 356-357)
			{
				code: "const obj = { set foo_bar(val: number) {} };",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["camelCase"], selector: "classicAccessor" }],
			},

			// Test global variable (line 68-70 isGlobal)
			{
				code: "const foo_bar = 1;",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["UPPER_CASE"], modifiers: ["global"], selector: "variable" }],
			},

			// Test class field initialized with an arrow function is treated as a class method
			{
				code: "class Foo { foo_bar = () => {}; }",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["camelCase"], selector: "classMethod" }],
			},

			// Test abstract class field with a function type is treated as a class property
			{
				code: "abstract class Foo { abstract foo_bar: () => void; }",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["camelCase"], modifiers: ["abstract"], selector: "classProperty" }],
			},

			// Test auto-accessor selector
			{
				code: "class Foo { accessor foo_bar = 1; }",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["camelCase"], selector: "autoAccessor" }],
			},

			// Test object literal property selector
			{
				code: "const obj = { foo_bar: 1 };",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["camelCase"], selector: "objectLiteralProperty" }],
			},

			// Test object literal method selector with method syntax
			{
				code: "const obj = { foo_bar() {} };",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["camelCase"], selector: "objectLiteralMethod" }],
			},

			// Test object literal method selector with function expression value
			{
				code: "const obj = { foo_bar: function () {} };",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["camelCase"], selector: "objectLiteralMethod" }],
			},

			// Test export default declaration on a named function
			{
				code: "export default function foo_bar() {}",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["camelCase"], modifiers: ["exported"], selector: "function" }],
			},

			// Test export default declaration on a named class
			{
				code: "export default class foo_bar {}",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["PascalCase"], modifiers: ["exported"], selector: "class" }],
			},

			// Test literal member names that start with an invalid identifier character
			{
				code: "const obj = { '1startsWithNumber': 1 };",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["camelCase"], modifiers: ["requiresQuotes"], selector: "objectLiteralProperty" }],
			},
		],
		valid: [
			// Test unused variable with correct format
			{
				code: "const UNUSED_VAR = 1;",
				options: [{ format: ["UPPER_CASE"], modifiers: ["unused"], selector: "variable" }],
			},

			// Test abstract class member with correct format
			{
				code: "abstract class Foo { abstract fooBar: string; }",
				options: [{ format: ["camelCase"], modifiers: ["abstract"], selector: "classProperty" }],
			},

			// Test exported variable with correct format
			{
				code: "export const FOO_BAR = 1;",
				options: [{ format: ["UPPER_CASE"], modifiers: ["exported"], selector: "variable" }],
			},

			// Test export via specifier (lines 183-184)
			{
				code: "const fooBar = 1; export { fooBar };",
				options: [{ format: ["camelCase"], modifiers: ["exported"], selector: "variable" }],
			},

			// Test exported function with correct format
			{
				code: "export function fooBar() {}",
				options: [{ format: ["camelCase"], modifiers: ["exported"], selector: "function" }],
			},

			// Test exported abstract class with correct format
			{
				code: "export abstract class FooBar {}",
				options: [{ format: ["PascalCase"], modifiers: ["exported", "abstract"], selector: "class" }],
			},

			// Test exported enum with correct format
			{
				code: "export enum FooBar { A }",
				options: [{ format: ["PascalCase"], modifiers: ["exported"], selector: "enum" }],
			},

			// Test exported interface with correct format
			{
				code: "export interface FooBar {}",
				options: [{ format: ["PascalCase"], modifiers: ["exported"], selector: "interface" }],
			},

			// Test exported type alias with correct format
			{
				code: "export type FooBar = string;",
				options: [{ format: ["PascalCase"], modifiers: ["exported"], selector: "typeAlias" }],
			},

			// Test private class member with correct format
			{
				code: "class Foo { #fooBar = 1; }",
				options: [{ format: ["camelCase"], modifiers: ["#private"], selector: "classProperty" }],
			},

			// Test async function with correct format
			{
				code: "async function fooBar() {}",
				options: [{ format: ["camelCase"], modifiers: ["async"], selector: "function" }],
			},

			// Test async variable with correct format
			{
				code: "const fooBar = async () => {};",
				options: [{ format: ["camelCase"], modifiers: ["async"], selector: "variable" }],
			},

			// Test destructured parameter with correct format
			{
				code: "function fn({ fooBar }: { fooBar: string }) { return fooBar; }",
				options: [{ format: ["camelCase"], modifiers: ["destructured"], selector: "parameter" }],
			},

			// Test destructured parameter with a default value
			{
				code: "function fn({ fooBar = 1 }: { fooBar?: number }) { return fooBar; }",
				options: [{ format: ["camelCase"], modifiers: ["destructured"], selector: "parameter" }],
			},

			// Test type parameter with correct format
			{
				code: "function fn<T>() {}",
				options: [{ format: ["PascalCase"], selector: "typeParameter" }],
			},

			// Test unused type parameter (lines 462-463)
			{
				code: "function fn<TUnused>() {}",
				options: [{ format: ["PascalCase"], modifiers: ["unused"], selector: "typeParameter" }],
			},

			// Test TSParameterProperty with correct format
			{
				code: "class Foo { constructor(public fooBar: string) {} }",
				options: [{ format: ["camelCase"], selector: "parameterProperty" }],
			},

			// Test readonly type property with correct format
			{
				code: "interface Foo { readonly fooBar: string; }",
				options: [{ format: ["camelCase"], modifiers: ["readonly"], selector: "typeProperty" }],
			},

			// Test object literal getter with correct format
			{
				code: "const obj = { get fooBar() { return 1; } };",
				options: [{ format: ["camelCase"], selector: "classicAccessor" }],
			},

			// Test object literal setter with correct format
			{
				code: "const obj = { set fooBar(val: number) {} };",
				options: [{ format: ["camelCase"], selector: "classicAccessor" }],
			},

			// Test abstract method definition with correct format
			{
				code: "abstract class Foo { abstract fooBar(): void; }",
				options: [{ format: ["camelCase"], modifiers: ["abstract"], selector: "classMethod" }],
			},

			// Test global variable with correct format
			{
				code: "const FOO_BAR = 1;",
				options: [{ format: ["UPPER_CASE"], modifiers: ["global"], selector: "variable" }],
			},

			// Test local variable does not receive the global modifier
			{
				code: "function fn() { const fooBar = 1; return fooBar; }",
				options: [
					{ format: ["UPPER_CASE"], modifiers: ["global"], selector: "variable" },
					{ format: ["camelCase"], selector: "variable" },
				],
			},

			// Test import default specifier (lines 329-330)
			{
				code: "import fooBar from 'module';",
				options: [{ format: ["camelCase"], modifiers: ["default"], selector: "import" }],
			},

			// Test import namespace specifier (lines 332-333)
			{
				code: "import * as FooBar from 'module';",
				options: [{ format: ["PascalCase"], modifiers: ["namespace"], selector: "import" }],
			},

			// Test import specifier with default alias (lines 335-339)
			{
				code: "import { default as fooBar } from 'module';",
				options: [{ format: ["camelCase"], modifiers: ["default"], selector: "import" }],
			},

			// Test regular import specifier (line 337) - should return early
			{
				code: "import { fooBar } from 'module';",
				options: [{ format: ["PascalCase"], modifiers: ["default"], selector: "import" }],
			},

			// Test computed property (line 103, 213) - should be skipped
			{
				code: "class Foo { [computed]: number = 1; }",
				options: [{ format: ["camelCase"], selector: "classProperty" }],
			},

			// Test class without id (line 224) - anonymous class
			{
				code: "const Foo = class {};",
				options: [{ format: ["PascalCase"], selector: "class" }],
			},

			// Test function expression (lines 248-254)
			{
				code: "const fn = function fooBar() {};",
				options: [{ format: ["camelCase"], selector: "function" }],
			},

			// Test TSDeclareFunction (lines 248-254)
			{
				code: "declare function fooBar(): void;",
				options: [{ format: ["camelCase"], selector: "function" }],
			},

			// Test destructured variable (line 491)
			{
				code: "const { fooBar } = obj;",
				options: [{ format: ["camelCase"], modifiers: ["destructured"], selector: "variable" }],
			},

			// Test unused enum (line 371-372)
			{
				code: "enum UnusedEnum { A }",
				options: [{ format: ["PascalCase"], modifiers: ["unused"], selector: "enum" }],
			},

			// Test used enum does not receive the unused modifier
			{
				code: "enum UsedEnum { A } const value = UsedEnum.A;",
				options: [
					{ format: ["UPPER_CASE"], modifiers: ["unused"], selector: "enum" },
					{ format: ["PascalCase"], selector: "enum" },
				],
			},

			// Test unused interface (line 400-401)
			{
				code: "interface UnusedInterface {}",
				options: [{ format: ["PascalCase"], modifiers: ["unused"], selector: "interface" }],
			},

			// Test used interface does not receive the unused modifier
			{
				code: "interface UsedInterface { value: number } const value: UsedInterface = { value: 1 };",
				options: [
					{ format: ["UPPER_CASE"], modifiers: ["unused"], selector: "interface" },
					{ format: ["PascalCase"], selector: "interface" },
				],
			},

			// Test unused type alias (line 449-450)
			{
				code: "type UnusedType = string;",
				options: [{ format: ["PascalCase"], modifiers: ["unused"], selector: "typeAlias" }],
			},

			// Test unused class (line 238-240)
			{
				code: "class UnusedClass {}",
				options: [{ format: ["PascalCase"], modifiers: ["unused"], selector: "class" }],
			},

			// Test unused function (lines 270-272)
			{
				code: "function unusedFn() {}",
				options: [{ format: ["camelCase"], modifiers: ["unused"], selector: "function" }],
			},

			// Test unused parameter (lines 307-308)
			{
				code: "function fn(unusedParam: string) {}",
				options: [{ format: ["camelCase"], modifiers: ["unused"], selector: "parameter" }],
			},

			// Test enum member with requiresQuotes (line 384)
			{
				code: "enum Foo { 'kebab-case' = 1 }",
				options: [{ format: ["camelCase"], selector: "enumMember" }],
			},

			// Test override modifier (line 138)
			{
				code: "class Base { foo() {} } class Foo extends Base { override foo() {} }",
				options: [{ format: ["camelCase"], modifiers: ["override"], selector: "classMethod" }],
			},

			// Test static member (line 134)
			{
				code: "class Foo { static fooBar = 1; }",
				options: [{ format: ["camelCase"], modifiers: ["static"], selector: "classProperty" }],
			},

			// Test readonly class property (line 136)
			{
				code: "class Foo { readonly fooBar = 1; }",
				options: [{ format: ["camelCase"], modifiers: ["readonly"], selector: "classProperty" }],
			},

			// Test protected class member (line 131)
			{
				code: "class Foo { protected fooBar = 1; }",
				options: [{ format: ["camelCase"], modifiers: ["protected"], selector: "classProperty" }],
			},

			// Test private (not #private) class member (line 131)
			{
				code: "class Foo { private fooBar = 1; }",
				options: [{ format: ["camelCase"], modifiers: ["private"], selector: "classProperty" }],
			},

			// Test const modifier on variable (line 480)
			{
				code: "const FOO_BAR = 1;",
				options: [{ format: ["UPPER_CASE"], modifiers: ["const"], selector: "variable" }],
			},

			// Test let variable (no const modifier)
			{
				code: "let fooBar = 1;",
				options: [
					{ format: ["UPPER_CASE"], modifiers: ["const"], selector: "variable" },
					{ format: ["camelCase"], selector: "variable" },
				],
			},

			// Test TSEmptyBodyFunctionExpression
			{
				code: "declare class Foo { fooBar(): void; }",
				options: [{ format: ["camelCase"], selector: "classMethod" }],
			},

			// Test method with function type in interface (lines 408-417)
			{
				code: "interface Foo { fooBar(): void; }",
				options: [{ format: ["camelCase"], selector: "typeMethod" }],
			},

			// Test property with function type in interface (lines 408-417)
			{
				code: "interface Foo { fooBar: () => void; }",
				options: [{ format: ["camelCase"], selector: "typeMethod" }],
			},

			// Test abstract accessor property (lines 141-145)
			{
				code: "abstract class Foo { abstract get fooBar(): number; }",
				options: [{ format: ["camelCase"], modifiers: ["abstract"], selector: "classicAccessor" }],
			},

			// Test class method with modifiers (lines 347-353)
			{
				code: "class Foo { get fooBar() { return 1; } set fooBar(val: number) {} }",
				options: [{ format: ["camelCase"], selector: "classicAccessor" }],
			},

			// Test PropertyDefinition handler (lines 203-218)
			{
				code: "class Foo { fooBar = 1; }",
				options: [{ format: ["camelCase"], selector: "classProperty" }],
			},

			// Test function-valued class field with correct method-style name
			{
				code: "class Foo { fooBar = function () {}; }",
				options: [{ format: ["camelCase"], selector: "classMethod" }],
			},

			// Test computed object literal properties are skipped
			{
				code: "const obj = { [foo_bar]: 1, [method_name]() {} };",
				options: [
					{ format: ["camelCase"], selector: "objectLiteralProperty" },
					{ format: ["camelCase"], selector: "objectLiteralMethod" },
				],
			},

			// Test unicode identifier text that does not require quotes
			{
				code: "const obj = { café: 1 };",
				options: [{ format: ["camelCase"], selector: "objectLiteralProperty" }],
			},

			// Test astral unicode identifier text that does not require quotes
			{
				code: "const obj = { 𐊧: 1, a𐊧: 2 };",
				options: [{ format: [], selector: "objectLiteralProperty" }],
			},

			// Test export default declaration (line 166-167)
			{
				code: "const fooBar = 1; export default fooBar;",
				options: [{ format: ["camelCase"], modifiers: ["exported"], selector: "variable" }],
			},
		],
	});

	ruleTesterWithTypes.run("naming-convention-with-types", rule, {
		invalid: [
			// Test type: array - incorrect format
			{
				code: "const foo_bar: string[] = [];",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["UPPER_CASE"], selector: "variable", types: ["array"] }],
			},
			// Test branded array type - incorrect format
			{
				code: "type Branded = string[] & { brand: 'x' }; const foo_bar: Branded = [];",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["UPPER_CASE"], selector: "variable", types: ["array"] }],
			},

			// Test type: function - incorrect format
			{
				code: "const foo_bar = () => {};",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["UPPER_CASE"], selector: "variable", types: ["function"] }],
			},

			// Test type: string - incorrect format
			{
				code: "const foo_bar: string = 'test';",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["UPPER_CASE"], selector: "variable", types: ["string"] }],
			},

			// Test type: number - incorrect format
			{
				code: "const foo_bar: number = 1;",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["UPPER_CASE"], selector: "variable", types: ["number"] }],
			},

			// Test type: boolean - incorrect format
			{
				code: "const foo_bar: boolean = true;",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [{ format: ["UPPER_CASE"], selector: "variable", types: ["boolean"] }],
			},

			// Test type reference (loose name-only) - PascalCase enforced; camelCase rejected
			{
				code: "type Entity<TData = unknown> = number & { readonly __type: TData }; declare function component<T = unknown>(): Entity<T>; const myComponent = component();",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [
					{
						format: ["PascalCase"],
						modifiers: ["const"],
						selector: "variable",
						types: [{ name: "Entity" }],
					},
				],
			},

			// Test type reference - snake_case rejected on Pair-typed const
			{
				code: "type Pair<P = unknown, O = unknown> = { readonly __pred: P; readonly __obj: O }; declare function pair<P, O>(p: P, o: O): Pair<P, O>; const my_pair = pair(1, 2);",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [
					{
						format: ["PascalCase"],
						modifiers: ["const"],
						selector: "variable",
						types: [{ name: "Pair" }],
					},
				],
			},

			// Test type reference - any-cast must bypass the match and fall back to default rule
			{
				code: "const NotEntity = 42 as any;",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [
					{
						format: ["PascalCase"],
						modifiers: ["const"],
						selector: "variable",
						types: [{ name: "Entity" }],
					},
					{ format: ["camelCase"], selector: "variable" },
				],
			},

			// Test type reference - union of two referenced types with snake_case rejected under PascalCase
			{
				code: "type Entity<TData = unknown> = { readonly __type: TData }; type Pair<P = unknown, O = unknown> = { readonly __pred: P; readonly __obj: O }; type Id<T = unknown> = Entity<T> | Pair<T, unknown>; declare function resolveId<T>(): Id<T>; const resolved_id = resolveId();",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [
					{
						format: ["PascalCase"],
						modifiers: ["const"],
						selector: "variable",
						types: [{ name: "Entity" }, { name: "Pair" }],
					},
				],
			},

			// Test type reference - `from` mismatch falls back to default rule (declaration not in expected module)
			{
				code: "type LocalEntity = { readonly __local: true }; declare function component(): LocalEntity; const MyComponent = component();",
				errors: [{ messageId: "doesNotMatchFormat" }],
				options: [
					{
						format: ["PascalCase"],
						modifiers: ["const"],
						selector: "variable",
						types: [{ from: "some-other-pkg", name: "LocalEntity" }],
					},
					{ format: ["camelCase"], selector: "variable" },
				],
			},
		],
		valid: [
			// Test type: array - matching format
			{
				code: "const FOO_BAR: string[] = [];",
				options: [{ format: ["UPPER_CASE"], selector: "variable", types: ["array"] }],
			},
			// Test union array type - matching format
			{
				code: "const FOO_BAR: string[] | number[] = [];",
				options: [{ format: ["UPPER_CASE"], selector: "variable", types: ["array"] }],
			},

			// Test type: function - matching format
			{
				code: "const FOO_BAR = () => {};",
				options: [{ format: ["UPPER_CASE"], selector: "variable", types: ["function"] }],
			},

			// Test type: string - matching format
			{
				code: "const FOO_BAR: string = 'test';",
				options: [{ format: ["UPPER_CASE"], selector: "variable", types: ["string"] }],
			},

			// Test multiple allowed types - hits the function branch before matching string
			{
				code: "const FOO_BAR: string = 'test';",
				options: [{ format: ["UPPER_CASE"], selector: "variable", types: ["function", "string"] }],
			},

			// Test repeated typed variables to exercise cached type-info path
			{
				code: "const FOO_FIRST: string = 'a'; const FOO_SECOND: string = 'b';",
				options: [{ format: ["UPPER_CASE"], selector: "variable", types: ["string"] }],
			},

			// Test type: number - matching format
			{
				code: "const FOO_BAR: number = 1;",
				options: [{ format: ["UPPER_CASE"], selector: "variable", types: ["number"] }],
			},

			// Test type: boolean - matching format
			{
				code: "const FOO_BAR: boolean = true;",
				options: [{ format: ["UPPER_CASE"], selector: "variable", types: ["boolean"] }],
			},

			// Test type doesn't match - uses fallback rule
			{
				code: "const fooBar: string = 'test';",
				options: [
					{ format: ["UPPER_CASE"], selector: "variable", types: ["array"] },
					{ format: ["camelCase"], selector: "variable" },
				],
			},
			// Test primitive type mismatch - uses fallback rule
			{
				code: "const fooBar: number = 1;",
				options: [
					{ format: ["UPPER_CASE"], selector: "variable", types: ["string"] },
					{ format: ["camelCase"], selector: "variable" },
				],
			},
			// Test type reference mismatch across every union arm - uses fallback rule
			{
				code: "const maybePrimitive: string | number = Math.random() > 0.5 ? 'test' : 1;",
				options: [
					{
						format: ["PascalCase"],
						modifiers: ["const"],
						selector: "variable",
						types: [{ name: "Entity" }],
					},
					{ format: ["camelCase"], selector: "variable" },
				],
			},

			// Test tuple type as array
			{
				code: "const FOO_BAR: [string, number] = ['a', 1];",
				options: [{ format: ["UPPER_CASE"], selector: "variable", types: ["array"] }],
			},

			// Test union type for type matching
			{
				code: "const FOO_BAR: string | undefined = 'test';",
				options: [{ format: ["UPPER_CASE"], selector: "variable", types: ["string"] }],
			},

			// Test function type matching with function expression
			{
				code: "const FOO_BAR: () => void = () => {};",
				options: [{ format: ["UPPER_CASE"], selector: "variable", types: ["function"] }],
			},

			// Test parameter with type checking
			{
				code: "function test(FOO_BAR: string[]) {}",
				options: [{ format: ["UPPER_CASE"], selector: "parameter", types: ["array"] }],
			},

			// Test type reference (loose name-only) - matches Entity from a typed call
			{
				code: "type Entity<TData = unknown> = { readonly __type: TData }; declare const world: { component<T = unknown>(): Entity<T> }; const Health = world.component();",
				options: [
					{
						format: ["PascalCase"],
						modifiers: ["const"],
						selector: "variable",
						types: [{ name: "Entity" }],
					},
				],
			},

			// Test type reference - matches an alias chain through a Tag subtype
			{
				code: "type Entity<TData = unknown> = { readonly __type: TData }; type TagDiscriminator = { readonly __tag: true }; type Tag = Entity<TagDiscriminator>; declare function registerTag(): Tag; const Dead = registerTag();",
				options: [
					{
						format: ["PascalCase"],
						modifiers: ["const"],
						selector: "variable",
						types: [{ name: "Entity" }],
					},
				],
			},

			// Test type reference - matches branded Pair from pair()
			{
				code: "type Pair<P = unknown, O = unknown> = { readonly __pred: P; readonly __obj: O }; declare function pair<P, O>(p: P, o: O): Pair<P, O>; const MaxHealth = pair(1, 2);",
				options: [
					{
						format: ["PascalCase"],
						modifiers: ["const"],
						selector: "variable",
						types: [{ name: "Pair" }],
					},
				],
			},

			// Test type reference - single config allows multiple referenced types
			{
				code: "type Entity<TData = unknown> = { readonly __type: TData }; type Pair<P = unknown, O = unknown> = { readonly __pred: P; readonly __obj: O }; declare function component<T = unknown>(): Entity<T>; declare function pair<P, O>(p: P, o: O): Pair<P, O>; const Health = component(); const MaxHealth = pair(1, 2);",
				options: [
					{
						format: ["PascalCase"],
						modifiers: ["const"],
						selector: "variable",
						types: [{ name: "Entity" }, { name: "Pair" }],
					},
				],
			},

			// Test type reference - union of (Entity | Pair) matches when each arm hits some configured type
			{
				code: "type Entity<TData = unknown> = { readonly __type: TData }; type Pair<P = unknown, O = unknown> = { readonly __pred: P; readonly __obj: O }; type Id<T = unknown> = Entity<T> | Pair<T, unknown>; declare function resolveId<T>(): Id<T>; const ResolvedId = resolveId();",
				options: [
					{
						format: ["PascalCase"],
						modifiers: ["const"],
						selector: "variable",
						types: [{ name: "Entity" }, { name: "Pair" }],
					},
				],
			},

			// Test type reference - optional union flows through getNonNullableType
			{
				code: "type Entity<TData = unknown> = { readonly __type: TData }; declare function component<T = unknown>(): Entity<T> | undefined; const Health = component();",
				options: [
					{
						format: ["PascalCase"],
						modifiers: ["const"],
						selector: "variable",
						types: [{ name: "Entity" }],
					},
				],
			},

			// Test type reference miss - non-Entity type falls back to default rule
			{
				code: "const myCount: number = 1;",
				options: [
					{
						format: ["PascalCase"],
						modifiers: ["const"],
						selector: "variable",
						types: [{ name: "Entity" }],
					},
					{ format: ["camelCase"], selector: "variable" },
				],
			},

			// Test type reference - mixed union falls back when one arm misses the reference
			{
				code: "type Entity<TData = unknown> = { readonly __type: TData }; declare function maybeComponent<T = unknown>(): Entity<T> | number; const maybeComponentValue = maybeComponent();",
				options: [
					{
						format: ["PascalCase"],
						modifiers: ["const"],
						selector: "variable",
						types: [{ name: "Entity" }],
					},
					{ format: ["camelCase"], selector: "variable" },
				],
			},

			// Test type reference - union arm order still matches after a miss.
			{
				code: "type Entity<TData = unknown> = { readonly __type: TData }; declare function maybeComponent<T = unknown>(): number | Entity<T>; const maybeComponentValue = maybeComponent();",
				options: [
					{
						format: ["PascalCase"],
						modifiers: ["const"],
						selector: "variable",
						types: [{ name: "Entity" }],
					},
					{ format: ["camelCase"], selector: "variable" },
				],
			},

			// Test type reference - intersection arm order still matches after a miss.
			{
				code: "type Entity<TData = unknown> = { readonly __type: TData }; type Other = { readonly other: true }; type Mixed = Other & Entity; declare function makeMixed(): Mixed; const MixedValue = makeMixed();",
				options: [
					{
						format: ["PascalCase"],
						modifiers: ["const"],
						selector: "variable",
						types: [{ name: "Entity" }],
					},
				],
			},

			// Test type reference - structural type (no nominal brand symbol) matches by alias name alone;
			// confirms the matcher does not rely on the `__nominal_*` brand pattern.
			{
				code: "type ServerEvents<T> = { fire(event: keyof T): void }; declare function createServer<T>(handlers: T): ServerEvents<T>; const Events = createServer({ x: 1 });",
				options: [
					{
						format: ["PascalCase"],
						modifiers: ["const"],
						selector: "variable",
						types: [{ name: "ServerEvents" }],
					},
				],
			},

			// Test type reference - nested union INSIDE an intersection matches via the recursive union branch
			{
				code: "type Entity<T = unknown> = { readonly __type: T }; type Pair<P = unknown, O = unknown> = { readonly __pred: P; readonly __obj: O }; type Inner = Pair<1, 2> | Pair<3, 4>; type Combined = Entity<unknown> & Inner; declare function make(): Combined; const Made = make();",
				options: [
					{
						format: ["PascalCase"],
						modifiers: ["const"],
						selector: "variable",
						types: [{ name: "Entity" }, { name: "Pair" }],
					},
				],
			},

			// Test type reference - same-file relative `from` matches an inline declaration.
			{
				code: "type InlineThing = { readonly __inline: true }; declare function makeInline(): InlineThing; const InlineValue = makeInline();",
				filename: fromFixturesCase,
				options: [
					{
						format: ["PascalCase"],
						modifiers: ["const"],
						selector: "variable",
						types: [{ from: "./case", name: "InlineThing" }],
					},
				],
			},

			// `from` positive matches (bare package + relative path) are exercised by a fixture-backed
			// RuleTester block below — see `naming-convention-with-from-fixtures`.
		],
	});

	ruleTesterWithFromFixtures.run("naming-convention-with-from-fixtures", rule, {
		invalid: [
			// camelCase const typed via `fake-pkg` Entity rejected under PascalCase — proves the
			// bare-package `from` substring against `/node_modules/fake-pkg/` is active.
			{
				code: `import { component } from "fake-pkg"; const myComponent = component();`,
				errors: [{ messageId: "doesNotMatchFormat" }],
				filename: fromFixturesCase,
				options: [
					{
						format: ["PascalCase"],
						modifiers: ["const"],
						selector: "variable",
						types: [{ from: "fake-pkg", name: "Entity" }],
					},
				],
			},
		],
		valid: [
			// `from` (bare package): PascalCase const typed via `fake-pkg` Entity passes.
			{
				code: `import { component } from "fake-pkg"; const Health = component();`,
				filename: fromFixturesCase,
				options: [
					{
						format: ["PascalCase"],
						modifiers: ["const"],
						selector: "variable",
						types: [{ from: "fake-pkg", name: "Entity" }],
					},
				],
			},

			// `from` (relative path-form): PascalCase const typed via a project-local type passes.
			{
				code: `import { makeLocal } from "./src/shared/local-thing"; const LocalValue = makeLocal();`,
				filename: fromFixturesCase,
				options: [
					{
						format: ["PascalCase"],
						modifiers: ["const"],
						selector: "variable",
						types: [{ from: "./src/shared/local-thing", name: "LocalThing" }],
					},
				],
			},

			// `from` (absolute path-form): PascalCase const typed via the exact local source passes.
			{
				code: `import { makeLocal } from "./src/shared/local-thing"; const LocalValue = makeLocal();`,
				filename: fromFixturesCase,
				options: [
					{
						format: ["PascalCase"],
						modifiers: ["const"],
						selector: "variable",
						types: [{ from: absoluteLocalThingSpecifier, name: "LocalThing" }],
					},
				],
			},

			// `from` (Windows absolute path-form): wrong drive path does not match on this fixture.
			{
				code: `import { component } from "fake-pkg"; const myComponent = component();`,
				filename: fromFixturesCase,
				options: [
					{
						format: ["PascalCase"],
						modifiers: ["const"],
						selector: "variable",
						types: [{ from: "C:/not-real/fake-pkg", name: "Entity" }],
					},
					{ format: ["camelCase"], selector: "variable" },
				],
			},

			// `from` mismatch (right name, wrong module): falls back to the second clause; camelCase Allowed.
			{
				code: `import { component } from "fake-pkg"; const myComponent = component();`,
				filename: fromFixturesCase,
				options: [
					{
						format: ["PascalCase"],
						modifiers: ["const"],
						selector: "variable",
						types: [{ from: "some-other-pkg", name: "Entity" }],
					},
					{ format: ["camelCase"], selector: "variable" },
				],
			},
		],
	});
});
