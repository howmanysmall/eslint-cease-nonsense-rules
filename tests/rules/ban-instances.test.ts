import { describe } from "bun:test";
import rule from "@rules/ban-instances";
import parser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";

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
			// Array config - JSX (lowercase = Roblox Instance)
			{
				code: "<part />;",
				errors: [{ messageId: "bannedInstance" }],
				options: [{ bannedInstances: ["Part"] }],
			},
			{
				code: "<frame><textlabel /></frame>;",
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
			// Object config with custom messages - JSX (lowercase)
			{
				code: "<script />;",
				errors: [{ messageId: "bannedInstanceCustom" }],
				options: [{ bannedInstances: { Script: "Scripts should not be created at runtime" } }],
			},
			// Case-insensitive lookup - UITextSizeConstraint
			{
				code: "<uitextsizeconstraint />;",
				errors: [{ messageId: "bannedInstanceCustom" }],
				options: [{ bannedInstances: { UITextSizeConstraint: "Use something else" } }],
			},
			{
				code: 'new Instance("UITextSizeConstraint");',
				errors: [{ messageId: "bannedInstanceCustom" }],
				options: [{ bannedInstances: { UITextSizeConstraint: "Use something else" } }],
			},
			// Case-insensitive new Instance() - lowercase string matches
			{
				code: 'new Instance("part");',
				errors: [{ messageId: "bannedInstance" }],
				options: [{ bannedInstances: ["Part"] }],
			},
			// Multiple errors
			{
				code: 'new Instance("Part"); new Instance("Frame");',
				errors: [{ messageId: "bannedInstance" }, { messageId: "bannedInstance" }],
				options: [{ bannedInstances: ["Part", "Frame"] }],
			},
			{
				code: "<part />;  <frame />;",
				errors: [{ messageId: "bannedInstance" }, { messageId: "bannedInstance" }],
				options: [{ bannedInstances: ["Part", "Frame"] }],
			},
			// Mixed new Instance() and JSX
			{
				code: '<part />; new Instance("Frame");',
				errors: [{ messageId: "bannedInstance" }, { messageId: "bannedInstance" }],
				options: [{ bannedInstances: ["Part", "Frame"] }],
			},
			// Nested JSX - only inner lowercase element errors
			{
				code: "<Frame><part /></Frame>;",
				errors: [{ messageId: "bannedInstance" }],
				options: [{ bannedInstances: ["Part"] }],
			},
			// Nested JSX - outer lowercase element errors
			{
				code: "<frame><Part /></frame>;",
				errors: [{ messageId: "bannedInstance" }],
				options: [{ bannedInstances: ["Frame"] }],
			},
		],
		valid: [
			// No config (empty bannedInstances)
			{
				code: 'new Instance("Part");',
				options: [{ bannedInstances: [] }],
			},
			// Non-banned classes - new Instance()
			{
				code: 'new Instance("MeshPart");',
				options: [{ bannedInstances: ["Part"] }],
			},
			// Capitalized JSX = custom React component (NOT Roblox Instance)
			{
				code: "<Part />;",
				options: [{ bannedInstances: ["Part"] }],
			},
			{
				code: "<Frame />;",
				options: [{ bannedInstances: ["Frame"] }],
			},
			{
				code: "<Script />;",
				options: [{ bannedInstances: { Script: "Should not error" } }],
			},
			// Non-banned lowercase JSX
			{
				code: "<meshPart />;",
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
			// JSX member expression (skipped)
			{
				code: "<Foo.Part />;",
				options: [{ bannedInstances: ["Part"] }],
			},
			{
				code: "<foo.part />;",
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
