#!/usr/bin/env bun

import { barplot, bench, do_not_optimize, run } from "mitata";
import Typebox from "typebox";
import { Compile } from "typebox/compile";

const isArrayConfig = Compile(Typebox.Array(Typebox.String()));

function isArrayConfiguration(value: unknown): value is ReadonlyArray<string> {
	return Array.isArray(value) && value.every((item) => typeof item === "string");
}

const SIZE = 10_000;

const values = new Array<NonNullable<unknown>>(SIZE);
for (let index = 0; index < SIZE; index += 1) {
	const nextValue = Math.random();

	if (nextValue < 0.15) values[index] = `str_${index}_${(Math.random() * 1e6) | 0}`;
	else if (nextValue < 0.3) values[index] = (Math.random() - 0.5) * 1e9;
	else if (nextValue < 0.4) values[index] = Math.random() < 0.5;
	else if (nextValue < 0.55) {
		const length = (Math.random() * 8) | 0;
		const array = new Array<string>(length);
		for (let jndex = 0; jndex < length; jndex += 1) array[jndex] = `v_${((index + jndex) * 31) % 97}`;
		values[index] = array;
	} else if (nextValue < 0.7) values[index] = [index, `x_${index}`, Math.random() < 0.5];
	else if (nextValue < 0.85) {
		values[index] = {
			flag: Math.random() < 0.5,
			id: index,
			name: `obj_${index}`,
			value: Math.random() * 1000,
		};
	} else if (nextValue < 0.93) values[index] = new Date(Date.now() - ((Math.random() * 1e10) | 0));
	else values[index] = /test_\d+/i;
}

barplot(() => {
	bench("Typebox", () => {
		for (const value of values) do_not_optimize(isArrayConfig.Check(value));
	});
	bench("Custom", () => {
		for (const value of values) do_not_optimize(isArrayConfiguration(value));
	});
});

await run({});
