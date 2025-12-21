#!/usr/bin/env bun

import { barplot, bench, do_not_optimize, run } from "mitata";

const SIZE = 10_000;

function nextInteger(minimum: number, maximum: number): number {
	return Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
}

function nextSet(minimum: number, maximum: number): Array<string> {
	const length = nextInteger(minimum, maximum);
	const array = new Array<string>(length);
	for (let index = 0; index < length; index += 1) array[index] = `value-${nextInteger(0, maximum)}`;
	return array;
}

const values = nextSet(Math.floor(SIZE / 2), SIZE);

barplot(() => {
	bench("Array.from", () => {
		// oxlint-disable-next-line prefer-spread
		do_not_optimize(Array.from(new Set<string>(values)));
	});
	bench("Spread", () => {
		do_not_optimize([...new Set(values)]);
	});
});

await run({});
