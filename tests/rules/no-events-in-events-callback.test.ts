import { describe } from "vitest";
import rule from "$rules/no-events-in-events-callback";
import parser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";

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
			{
				code: `
import Events from "server/networking";

Events.x.connect(({ player }): void => {
    Events.y.fire(player, "msg");
});
`,
				errors: [{ messageId: "preferFunctions" }],
				options,
			},
			{
				code: `
import { "Events" as E } from "server/networking";

E.x.connect((player: Player): void => {
    E.y.fire(player, "msg");
});
`,
				errors: [{ messageId: "preferFunctions" }],
				options,
			},
			{
				code: `
import { Events } from "server/networking";

Events.x.connect((player: Player): void => {
    const arr = ["other"];
    Events.y.fire([...arr, player][0], "msg");
});
`,
				errors: [{ messageId: "preferFunctions" }],
				options,
			},
			{
				code: `
import { Events } from "server/networking";

Events.x.connect((player: Player): void => {
    let container: { player: Player } | undefined;
    container = { player };
    Events.y.fire(container.player, "msg");
});
`,
				errors: [{ messageId: "preferFunctions" }],
				options,
			},
			{
				code: `
import { Events } from "server/networking";

Events.x.connect((player: Player): void => {
    const container = { player };
    Events.y.fire(container.player, "msg");
});
`,
				errors: [{ messageId: "preferFunctions" }],
				options,
			},
			{
				code: `
import { Events } from "server/networking";

Events.x.connect((player: Player): void => {
    const obj = { other: "value" };
    Events.y.fire({ ...obj, player }.player, "msg");
});
`,
				errors: [{ messageId: "preferFunctions" }],
				options,
			},
			{
				code: `
import { Events } from "server/networking";

Events.x.connect((player: Player): void => {
    Events.y.fire((void 0, player), "msg");
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
			{
				code: `
import { Events } from "server/networking";

Events.x.connect((player: Player, other: Player, cond: boolean): void => {
    Events.y.fire(cond ? player : other, "msg");
});
`,
				options,
			},
			{
				code: `
import { Events } from "server/networking";

Events.x.connect((player: Player): void => {
    function send(): void {
        Events.y.fire(player, "msg");
    }

    send();
});
`,
				options,
			},
		],
	});
});
