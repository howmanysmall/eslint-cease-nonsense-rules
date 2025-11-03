#!/usr/bin/env bun

import * as arktype from "arktype";
import { barplot, bench, do_not_optimize, run } from "mitata";
import * as S from "sury";
import Type from "typebox";
import { Compile } from "typebox/compile";

const withArkType = arktype.type("Record<string, unknown>");
const withSury = S.record(S.unknown);
const withTypebox = Compile(Type.Record(Type.String(), Type.Unknown()));

function withFunction(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

const SIZE = 1000;

function validateArkType<T>(value: unknown, validator: arktype.Type<T>): value is T {
	if (validator(value) instanceof arktype.type.errors) return false;
	return true;
}
function validateSury<T>(value: unknown, validator: S.Schema<T>): value is T {
	return S.safe(() => S.parseOrThrow(value, validator)).success;
}

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

barplot(() => {
	bench("typebox", () => {
		for (const value of values) do_not_optimize(withTypebox.Check(value));
	});
	bench("arktype", () => {
		for (const value of values) do_not_optimize(validateArkType(value, withArkType));
	});
	bench("sury", () => {
		for (const value of values) do_not_optimize(validateSury(value, withSury));
	});
	bench("regular function", () => {
		for (const value of values) do_not_optimize(withFunction(value));
	});
});

await run({});
