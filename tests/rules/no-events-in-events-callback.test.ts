import { describe } from "bun:test";
import parser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import rule from "../../src/rules/no-events-in-events-callback";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser,
		sourceType: "module",
	},
});

const options = [{ eventsImportPaths: ["server/networking"] }];

describe("no-events-in-events-callback", () => {
	// @ts-expect-error - RuleTester doesn't support the new format of rules
	ruleTester.run("no-events-in-events-callback", rule, {
		invalid: [
			{
				code: `
import { Events } from "server/networking";

Events.units.unequipUnit.connect((player: Player, unitKey: string): void => {
	if (unitKey.size() > 0) {
		Events.promptNotification.fire(player, "error");
	}
});
`,
				errors: [{ messageId: "preferFunctions" }],
				options,
			},
			{
				code: `
import { Events } from "server/networking";

Events.units.unequipUnit.connect((player: Player): void => {
	const samePlayer = player;
	Events.promptNotification.fire(samePlayer, "error");
});
`,
				errors: [{ messageId: "preferFunctions" }],
				options,
			},
			{
				code: `
import { Events } from "server/networking";

Events.units.unequipUnit.connect((player: Player): void => {
	const payload = { player };
	const { player: targetPlayer } = payload;
	Events.promptNotification.fire(targetPlayer, "error");
});
`,
				errors: [{ messageId: "preferFunctions" }],
				options,
			},
			{
				code: `
import { Events } from "server/networking";

Events.units.unequipUnit.connect((player: Player): void => {
	let target: Player | undefined;
	target = player;
	Events.promptNotification.fire(target, "error");
});
`,
				errors: [{ messageId: "preferFunctions" }],
				options,
			},
			{
				code: `
import { Events as ServerEvents } from "server/networking";

ServerEvents.units.unequipUnit.connect((player: Player): void => {
	ServerEvents.promptNotification(player, "error");
});
`,
				errors: [{ messageId: "preferFunctions" }],
				options,
			},
		],
		valid: [
			{
				code: `
import { Events } from "server/networking";

Events.units.unequipUnit.connect((player: Player, otherPlayer: Player): void => {
	Events.promptNotification.fire(otherPlayer, "error");
});
`,
				options,
			},
			{
				code: `
import { Events } from "shared/networking";

Events.units.unequipUnit.connect((player: Player): void => {
	Events.promptNotification.fire(player, "error");
});
`,
				options,
			},
			{
				code: `
import { Events, Functions } from "server/networking";

Events.units.unequipUnit.connect((player: Player): void => {
	Functions.units.unequipUnit(player);
});
`,
				options,
			},
			{
				code: `
import { Events } from "server/networking";

Events.units.unequipUnit.connect((player: Player): void => {
	const targetPlayer = getTargetPlayer(player);
	Events.promptNotification.fire(targetPlayer, "error");
});
`,
				options,
			},
			{
				code: `
import { Events } from "server/networking";

Events.promptNotification.fire(player, "error");
`,
				options,
			},
		],
	});
});
