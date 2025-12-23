import { describe } from "bun:test";
import parser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import rule from "../../src/rules/no-shorthand-names";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser,
		sourceType: "module",
	},
});

describe("no-shorthand-names", () => {
	ruleTester.run("no-shorthand-names", rule, {
		invalid: [
			{
				code: "const plr = getPlayer();",
				errors: [{ messageId: "useReplacement" }],
			},
			{
				code: "const plr = Players.LocalPlayer;",
				errors: [{ messageId: "useReplacement" }],
			},
			{
				code: "const args = [1, 2, 3];",
				errors: [{ messageId: "useReplacement" }],
			},
			{
				code: "const dt = 0.016;",
				errors: [{ messageId: "useReplacement" }],
			},
			{
				code: "const char = getCharacter();",
				errors: [{ messageId: "useReplacement" }],
			},
			{
				code: "function foo(plr) { return plr; }",
				errors: [{ messageId: "useReplacement" }, { messageId: "useReplacement" }],
			},
			{
				code: "function bar(args) { return args; }",
				errors: [{ messageId: "useReplacement" }, { messageId: "useReplacement" }],
			},
			{
				code: "const { plr } = obj;",
				errors: [{ messageId: "useReplacement" }, { messageId: "useReplacement" }],
			},
			{
				code: "const obj = { plr: 'value' };",
				errors: [{ messageId: "useReplacement" }],
			},
			{
				code: "const result = obj.plr;",
				errors: [{ messageId: "useReplacement" }],
			},
			{
				code: "const result = obj.fr;",
				errors: [{ messageId: "useReplacement" }],
				options: [
					{
						shorthands: { fr: "fullResult" },
					},
				],
			},
			// Compound identifier tests - shorthand at word boundaries
			{
				code: "interface UnitBoxBadgeInfoProps {}",
				errors: [{ messageId: "useReplacement" }],
				options: [{ shorthands: { Props: "Properties" } }],
			},
			{
				code: "const propsData = {};",
				errors: [{ messageId: "useReplacement" }],
				options: [{ shorthands: { props: "properties" } }],
			},
			{
				code: "const dataProps = {};",
				errors: [{ messageId: "useReplacement" }],
				options: [{ shorthands: { Props: "Properties" } }],
			},
			// Glob pattern tests - prefix matching
			{
				code: "const strValue = '';",
				errors: [{ messageId: "useReplacement" }],
				options: [{ shorthands: { "str*": "string*" } }],
			},
			{
				code: "const strData = {};",
				errors: [{ messageId: "useReplacement" }],
				options: [{ shorthands: { "str*": "string*" } }],
			},
			// Glob pattern tests - suffix matching
			{
				code: "const MyProps = {};",
				errors: [{ messageId: "useReplacement" }],
				options: [{ shorthands: { "*Props": "*Properties" } }],
			},
			{
				code: "const DataProps = {};",
				errors: [{ messageId: "useReplacement" }],
				options: [{ shorthands: { "*Props": "*Properties" } }],
			},
			// Glob pattern tests - both prefix and suffix (case sensitive: Btn not btn)
			{
				code: "const myBtnClick = () => {};",
				errors: [{ messageId: "useReplacement" }],
				options: [{ shorthands: { "*Btn*": "*Button*" } }],
			},
			// Regex pattern tests
			{
				code: "const strName = '';",
				errors: [{ messageId: "useReplacement" }],
				options: [{ shorthands: { "/^str(.*)$/": "string$1" } }],
			},
			// Regex with case-insensitive flag
			{
				code: "const Props = {};",
				errors: [{ messageId: "useReplacement" }],
				options: [{ shorthands: { "/^props$/i": "properties" } }],
			},
			// Regex with optional capture group
			{
				code: "const strName = '';",
				errors: [{ messageId: "useReplacement" }],
				options: [{ shorthands: { "/^str(Optional)?$/": "string$1" } }],
			},
			// Regex starting with / but invalid (falls back to exact match)
			{
				code: "const someVal = '';",
				errors: [{ messageId: "useReplacement" }],
				options: [{ shorthands: { "/invalid": "fixed", some: "other" } }],
			},
		],
		valid: [
			"const player = getPlayer();",
			"const localPlayer = Players.LocalPlayer;",
			"const parameters = [1, 2, 3];",
			"const deltaTime = 0.016;",
			"const character = getCharacter();",
			"const model = entity.char;",
			"function foo(player) {}",
			"const { player } = obj;",
			"class Example { constructor() {} }",
			"class Serializer { toString() { return 'value'; } }",
			"const wrapper = { valueOf() { return 1; } };",
			{
				code: "const result = container.plr;",
				options: [
					{
						allowPropertyAccess: ["plr"],
					},
				],
			},
			// Edge cases - should NOT trigger
			{
				// Contains full form "properties", not shorthand "props"
				code: "const nativeProperties = {};",
				options: [{ shorthands: { Props: "Properties", props: "properties" } }],
			},
			{
				// "plr" is NOT at a word boundary in "platform"
				code: "const platform = 'windows';",
			},
			{
				// Already uses full form
				code: "interface UnitBoxBadgeInfoProperties {}",
				options: [{ shorthands: { Props: "Properties" } }],
			},
			{
				// Case sensitive - PROPS !== props or Props
				code: "const PROPS = {};",
				options: [{ shorthands: { Props: "Properties", props: "properties" } }],
			},
			// Glob pattern valid cases - pattern doesn't match
			{
				// "string" doesn't match "str" exactly (use exact match for precise control)
				code: "const stringValue = '';",
				options: [{ shorthands: { str: "string" } }],
			},
			{
				// "MyProperties" contains "Properties" not "Props"
				code: "const MyProperties = {};",
				options: [{ shorthands: { "*Props": "*Properties" } }],
			},
			{
				// "Button" doesn't match "Btn" (case sensitive)
				code: "const myButtonClick = () => {};",
				options: [{ shorthands: { "*Btn*": "*Button*" } }],
			},
			// IgnoreShorthands - exact match
			{
				code: "const PropsWithoutRef = {};",
				options: [{ ignoreShorthands: ["Props"], shorthands: { "*Props": "*Properties" } }],
			},
			// IgnoreShorthands - glob pattern
			{
				code: "const InstanceProps = {};",
				options: [{ ignoreShorthands: ["*Props"], shorthands: { "*Props": "*Properties" } }],
			},
			// IgnoreShorthands - regex pattern
			{
				code: "const DataProps = {};",
				options: [{ ignoreShorthands: ["/^.*Props$/"], shorthands: { "*Props": "*Properties" } }],
			},
			// IgnoreShorthands - full identifier name (external package exports)
			{
				code: "type X = InferProps<T>;",
				options: [{ ignoreShorthands: ["InferProps"], shorthands: { "*Props": "*Properties" } }],
			},
			// IgnoreShorthands - full identifier name in type annotation
			{
				code: "const x: InstanceProps = {};",
				options: [{ ignoreShorthands: ["InstanceProps"], shorthands: { "*Props": "*Properties" } }],
			},
			// IgnoreShorthands - full identifier name with generic
			{
				code: "type Config = ComponentProps<Button>;",
				options: [{ ignoreShorthands: ["ComponentProps"], shorthands: { "*Props": "*Properties" } }],
			},
			// AllowPropertyAccess with TSQualifiedName (type-level)
			{
				code: "type X = React.PropsWithoutRef<P>;",
				options: [{ allowPropertyAccess: ["PropsWithoutRef"], shorthands: { "*Props": "*Properties" } }],
			},
			// AllowPropertyAccess with matched word (not pattern key)
			{
				code: "const x = obj.InstanceProps;",
				options: [{ allowPropertyAccess: ["InstanceProps"], shorthands: { "*Props": "*Properties" } }],
			},
			// AllowPropertyAccess with glob pattern matching word
			{
				code: "const x = container.DataProps;",
				options: [{ allowPropertyAccess: ["DataProps"], shorthands: { "*Props": "*Properties" } }],
			},
			// Import specifiers - external packages shouldn't be flagged
			{
				code: 'import { InstanceProps } from "@rbxts/react";',
				options: [{ shorthands: { "*Props": "*Properties" } }],
			},
			// Import type specifiers
			{
				code: 'import type { InstanceProps } from "@rbxts/react";',
				options: [{ shorthands: { "*Props": "*Properties" } }],
			},
			// Default imports
			{
				code: 'import InstanceProps from "@rbxts/react";',
				options: [{ shorthands: { "*Props": "*Properties" } }],
			},
			// Namespace imports
			{
				code: 'import * as Props from "@rbxts/react";',
				options: [{ shorthands: { Props: "Properties" } }],
			},
			// Multiple import specifiers
			{
				code: 'import { InstanceProps, DataProps } from "@rbxts/react";',
				options: [{ shorthands: { "*Props": "*Properties" } }],
			},
		],
	});
});
