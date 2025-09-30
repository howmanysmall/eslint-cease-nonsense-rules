import { RuleTester } from "eslint";
import { describe, expect, it } from "bun:test";
import rule from "../../src/rules/no-shorthand-names";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		sourceType: "module",
	},
});

describe("no-shorthand-names", () => {
	it("should pass valid cases and fail invalid cases", () => {
		expect(() => {
			ruleTester.run("no-shorthand-names", rule, {
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
				],
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
						errors: [
							{ messageId: "useReplacement" },
							{ messageId: "useReplacement" },
						],
					},
					{
						code: "function bar(args) { return args; }",
						errors: [
							{ messageId: "useReplacement" },
							{ messageId: "useReplacement" },
						],
					},
					{
						code: "const { plr } = obj;",
						errors: [
							{ messageId: "useReplacement" },
							{ messageId: "useReplacement" },
						],
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
							options: [
								{
									shorthands: { fr: "fullResult" },
								},
							],
							errors: [{ messageId: "useReplacement" }],
						},
				],
			});
		}).not.toThrow();
	});
});