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
					"const result = obj.plr;",
					"function foo(player) {}",
					"const { player } = obj;",
				],
				invalid: [
					{
						code: "const plr = getPlayer();",
						errors: [{ messageId: "usePlayer" }],
					},
					{
						code: "const plr = Players.LocalPlayer;",
						errors: [{ messageId: "useLocalPlayer" }],
					},
					{
						code: "const args = [1, 2, 3];",
						errors: [{ messageId: "useParameters" }],
					},
					{
						code: "const dt = 0.016;",
						errors: [{ messageId: "useDeltaTime" }],
					},
					{
						code: "const char = getCharacter();",
						errors: [{ messageId: "useCharacter" }],
					},
					{
						code: "function foo(plr) { return plr; }",
						errors: [
							{ messageId: "usePlayer" },
							{ messageId: "usePlayer" },
						],
					},
					{
						code: "function bar(args) { return args; }",
						errors: [
							{ messageId: "useParameters" },
							{ messageId: "useParameters" },
						],
					},
					{
						code: "const { plr } = obj;",
						errors: [
							{ messageId: "usePlayer" },
							{ messageId: "usePlayer" },
						],
					},
					{
						code: "for (const plr of players) {}",
						errors: [{ messageId: "usePlayer" }],
					},
					{
						code: "const obj = { plr: 'value' };",
						errors: [{ messageId: "usePlayer" }],
					},
				],
			});
		}).not.toThrow();
	});
});