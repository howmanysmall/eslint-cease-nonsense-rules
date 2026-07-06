import { describe, expect, it } from "vitest";
import {
	isBoolean,
	isFalsyValue,
	isFunction,
	isNonEmptyString,
	isNumber,
	isRecord,
	isRecordFast,
	isString,
} from "$utilities/type-utilities";

describe("type-utilities", () => {
	it("narrows non-empty strings", () => {
		expect.assertions(3);

		expect(isNonEmptyString("value")).toBe(true);
		expect(isNonEmptyString("")).toBe(false);
		expect(isNonEmptyString(42)).toBe(false);
	});

	it("narrows primitive values", () => {
		expect.assertions(8);

		expect(isBoolean(false)).toBe(true);
		expect(isBoolean("false")).toBe(false);
		expect(isNumber(1)).toBe(true);
		expect(isNumber("1")).toBe(false);
		expect(isString("value")).toBe(true);
		expect(isString(1)).toBe(false);
		expect(isFunction(() => "value")).toBe(true);
		expect(isFunction("value")).toBe(false);
	});

	it("filters arrays and null from records", () => {
		expect.assertions(3);

		expect(isRecord({ value: true })).toBe(true);
		expect(isRecord([])).toBe(false);
		expect(isRecord(null)).toBe(false);
	});

	it("keeps arrays in the fast record guard", () => {
		expect.assertions(3);

		expect(isRecordFast({ value: true })).toBe(true);
		expect(isRecordFast([])).toBe(true);
		expect(isRecordFast(null)).toBe(false);
	});

	it("matches JavaScript falsiness for constant values", () => {
		expect.assertions(9);

		expect(isFalsyValue("")).toBe(true);
		expect(isFalsyValue(0)).toBe(true);
		expect(isFalsyValue(0n)).toBe(true);
		expect(isFalsyValue(Number.NaN)).toBe(true);
		expect(isFalsyValue(undefined)).toBe(true);
		expect(isFalsyValue(false)).toBe(true);
		expect(isFalsyValue(null)).toBe(true);
		expect(isFalsyValue("text")).toBe(false);
		expect(isFalsyValue(1)).toBe(false);
	});
});
