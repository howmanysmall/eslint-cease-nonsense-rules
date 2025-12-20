#!/usr/bin/env bun

import { barplot, bench, run } from "mitata";

const SIZE = 1000;

function nextInteger(minimum: number, maximum: number): number {
	return Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
}

function nextValue(): unknown {
	const value = nextInteger(0, 5);
	switch (value) {
		case 0:
			return Math.random();

		case 1:
			return nextInteger(-1000, 1000);

		case 2:
			return Math.random() < 0.5;

		case 3: {
			const length = nextInteger(0, 10);
			let value = "";
			for (let index = 0; index < length; index += 1) value += String.fromCodePoint(nextInteger(97, 122));
			return value;
		}

		case 4: {
			const length = nextInteger(0, 5);
			const value = new Array<unknown>(length);
			for (let index = 0; index < length; index += 1) value[index] = nextValue();
			return value;
		}

		case 5: {
			const length = nextInteger(0, 5);
			const object: Record<string, unknown> = {};
			for (let index = 0; index < length; index += 1) object[`key-${index}`] = nextValue();
			return object;
		}

		default:
			throw new Error("Unreachable");
	}
}

const values = new Array<unknown>(SIZE);
for (let index = 0; index < SIZE; index += 1) values[index] = nextValue();

const Array_prototype_map = Array.prototype.map;

barplot(() => {
	bench("Array.prototype.map", () => values.map((value) => ({ value })));
	// oxlint-disable-next-line no-unsafe-return
	bench("Array_prototype_map", () => Array_prototype_map.call(values, (value: unknown) => ({ value })));
	bench("Raw Map (numeric + preallocate)", () => {
		const array = new Array<{ readonly value: unknown }>(values.length);
		for (let index = 0; index < values.length; index += 1) array[index] = { value: values[index] };
		return array;
	});
	bench("Raw Map (numeric)", () => {
		const array = new Array<{ readonly value: unknown }>();
		for (let index = 0; index < values.length; index += 1) array[index] = { value: values[index] };
		return array;
	});

	bench("Raw Map (preallocate)", () => {
		const array = new Array<{ readonly value: unknown }>(values.length);
		let index = 0;
		for (const value of values) array[index++] = { value };
		return array;
	});
	bench("Raw Map", () => {
		const array = new Array<{ readonly value: unknown }>();
		let index = 0;
		for (const value of values) array[index++] = { value };
		return array;
	});
});

await run({});
