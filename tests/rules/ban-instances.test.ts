import { describe } from "bun:test";
import parser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import rule from "../../src/rules/ban-instances";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser,
		parserOptions: {
			ecmaFeatures: {
				jsx: true,
			},
		},
		sourceType: "module",
	},
});

describe("ban-instances", () => {
	// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
	ruleTester.run("ban-instances", rule, {
		invalid: [
			// Array config - new Instance()
			{
				code: 'new Instance("Part");',
				errors: [{ messageId: "bannedInstance" }],
				options: [{ bannedInstances: ["Part"] }],
			},
			{
				code: 'const part = new Instance("Part");',
				errors: [{ messageId: "bannedInstance" }],
				options: [{ bannedInstances: ["Part", "Frame"] }],
			},
			{
				code: 'new Instance("Frame");',
				errors: [{ messageId: "bannedInstance" }],
				options: [{ bannedInstances: ["Part", "Frame"] }],
			},
			// Array config - JSX
			{
				code: "<Part />;",
				errors: [{ messageId: "bannedInstance" }],
				options: [{ bannedInstances: ["Part"] }],
			},
			{
				code: "<Frame><textlabel /></Frame>;",
				errors: [{ messageId: "bannedInstance" }],
				options: [{ bannedInstances: ["Frame"] }],
			},
			// Object config with custom messages - new Instance()
			{
				code: 'new Instance("Script");',
				errors: [{ messageId: "bannedInstanceCustom" }],
				options: [{ bannedInstances: { Script: "Scripts should not be created at runtime" } }],
			},
			{
				code: 'new Instance("Part");',
				errors: [{ messageId: "bannedInstanceCustom" }],
				options: [{ bannedInstances: { Part: "Use MeshPart instead" } }],
			},
			// Object config with custom messages - JSX
			{
				code: "<Script />;",
				errors: [{ messageId: "bannedInstanceCustom" }],
				options: [{ bannedInstances: { Script: "Scripts should not be created at runtime" } }],
			},
			// Multiple errors
			{
				code: 'new Instance("Part"); new Instance("Frame");',
				errors: [{ messageId: "bannedInstance" }, { messageId: "bannedInstance" }],
				options: [{ bannedInstances: ["Part", "Frame"] }],
			},
			{
				code: "<Part />;  <Frame />;",
				errors: [{ messageId: "bannedInstance" }, { messageId: "bannedInstance" }],
				options: [{ bannedInstances: ["Part", "Frame"] }],
			},
			// Mixed new Instance() and JSX
			{
				code: '<Part />; new Instance("Frame");',
				errors: [{ messageId: "bannedInstance" }, { messageId: "bannedInstance" }],
				options: [{ bannedInstances: ["Part", "Frame"] }],
			},
			// Nested JSX
			{
				code: "<frame><Part /></frame>;",
				errors: [{ messageId: "bannedInstance" }],
				options: [{ bannedInstances: ["Part"] }],
			},
		],
		valid: [
			// No config (empty bannedInstances)
			{
				code: 'new Instance("Part");',
				options: [{ bannedInstances: [] }],
			},
			// Non-banned classes
			{
				code: 'new Instance("MeshPart");',
				options: [{ bannedInstances: ["Part"] }],
			},
			{
				code: "<MeshPart />;",
				options: [{ bannedInstances: ["Part"] }],
			},
			// Not Instance constructor
			{
				code: 'new SomethingElse("Part");',
				options: [{ bannedInstances: ["Part"] }],
			},
			// Variable argument (not a literal)
			{
				code: "new Instance(className);",
				options: [{ bannedInstances: ["Part"] }],
			},
			// Non-string literal argument
			{
				code: "new Instance(123);",
				options: [{ bannedInstances: ["Part"] }],
			},
			// No arguments
			{
				code: "new Instance();",
				options: [{ bannedInstances: ["Part"] }],
			},
			// JSX member expression (not banned)
			{
				code: "<Foo.Part />;",
				options: [{ bannedInstances: ["Part"] }],
			},
			// Different casing (case-sensitive)
			{
				code: 'new Instance("part");',
				options: [{ bannedInstances: ["Part"] }],
			},
			{
				code: "<part />;",
				options: [{ bannedInstances: ["Part"] }],
			},
			// Object config - non-banned
			{
				code: 'new Instance("MeshPart");',
				options: [{ bannedInstances: { Part: "Use MeshPart instead" } }],
			},
		],
	});
});
