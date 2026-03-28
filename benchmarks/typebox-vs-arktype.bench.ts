#!/usr/bin/env bun

import { type } from "arktype";
import { barplot, bench, do_not_optimize, run } from "mitata";
import Typebox from "typebox";
import { Compile } from "typebox/compile";

const isOptionsObjectArkType = type({
	bannedInstances: "string[] | Record<string, string>",
});
type OptionsObject = typeof isOptionsObjectArkType.infer;

const isOptionsObjectTypebox = Compile(
	Typebox.Object({
		bannedInstances: Typebox.Union([
			Typebox.Array(Typebox.String()),
			Typebox.Record(Typebox.String(), Typebox.String()),
		]),
	}),
);

const SIZE = 10_000;

const VALID_OBJECTS: ReadonlyArray<OptionsObject> = [
	{
		bannedInstances: {
			UITextSizeConstraint:
				"Find a better way of handling this - UITextSizeConstraint breaks high resolution displays.",
			uitextsizeconstraint:
				"Find a better way of handling this - UITextSizeConstraint breaks high resolution displays.",
		},
	},
	{ bannedInstances: ["Part", "Frame", "Script"] },
];

const values = new Array<NonNullable<unknown>>(SIZE);
for (let index = 0; index < SIZE; index += 1) {
	const nextValue = Math.random();

	// oxlint-disable-next-line unicorn/prefer-ternary
	if (nextValue < 0.5) values[index] = VALID_OBJECTS[Math.floor(Math.random() * VALID_OBJECTS.length)];
	else values[index] = `str_${index}_${(Math.random() * 1e6) | 0}`;
}

barplot(() => {
	bench("Typebox", () => {
		const validValues = new Array<unknown>();
		for (const value of values) if (isOptionsObjectTypebox.Check(value)) validValues.push(value);
		do_not_optimize(validValues);
	});
	bench("ArkType (.allows)", () => {
		const validValues = new Array<unknown>();
		for (const value of values) if (isOptionsObjectArkType.allows(value)) validValues.push(value);
		do_not_optimize(validValues);
	});
	// Bench("ArkType (standard)", () => {
	//     Const validValues = new Array<unknown>();
	//     For (const value of values) {
	//         Const result = isOptionsObjectArkType(value);
	//         If (result instanceof type.errors) continue;
	//         ValidValues.push(result);
	//     }
	//     Do_not_optimize(validValues);
	// })
});

await run({});
