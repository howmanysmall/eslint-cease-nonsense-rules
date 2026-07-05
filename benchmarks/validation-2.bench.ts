#!/usr/bin/env bun

import { type } from "arktype";
import { barplot, bench, do_not_optimize, run, summary } from "mitata";
import Typebox from "typebox";
import { Compile } from "typebox/compile";

const isEnvironmentModeTypebox = Compile(Typebox.Union([Typebox.Literal("roblox-ts"), Typebox.Literal("standard")]));
const isEnvironmentModeArkType = type('"roblox-ts" | "standard"');

const SIZE = 10_000;

const SAMPLE_VALUES: ReadonlyArray<unknown> = [
	"roblox-ts",
	"standard",
	"server",
	"client",
	"",
	0,
	1,
	true,
	false,
	42,
	undefined,
	{},
	[],
];

// oxlint-disable-next-line small-rules/no-array-constructor-elements -- lol
const values = new Array<unknown>(SIZE);
for (let index = 0; index < SIZE; index += 1) values[index] = SAMPLE_VALUES[index % SAMPLE_VALUES.length];

summary(() => {
	barplot(() => {
		bench("Typebox", () => {
			let validCount = 0;
			for (const value of values) if (isEnvironmentModeTypebox.Check(value)) validCount += 1;
			do_not_optimize(validCount);
		});
		bench("Arktype", () => {
			let validCount = 0;
			for (const value of values) if (isEnvironmentModeArkType.allows(value)) validCount += 1;
			do_not_optimize(validCount);
		});
	});
});

await run({});
