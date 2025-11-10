#!/usr/bin/env bun

import { TSESTree } from "@typescript-eslint/types";
import * as arktype from "arktype";
import { barplot, bench, do_not_optimize, run } from "mitata";
import * as S from "sury";
import Type from "typebox";
import { Code, type CodeResult, Compile } from "typebox/compile";
import * as v from "valibot";
import getWriteFileAsync from "./get-write-file-async.ts";
import { getInspectAsync } from "./inspect.ts";

interface CodeChecks {
	readonly isNumericLiteralCode: (value: unknown) => value is { type: "Literal"; value: number };
	readonly isRecordCode: (value: unknown) => value is Record<string, unknown>;
}
type CodeChecksResult =
	| {
			readonly success: true;
			readonly value: CodeChecks;
	  }
	| {
			readonly success: false;
			readonly error: unknown;
	  };

async function safeImportCodeAsync(): Promise<CodeChecksResult> {
	try {
		// oxlint-disable-next-line no-unsafe-assignment
		const numeric = await import("./typebox-numeric-literal-node.js");
		// oxlint-disable-next-line no-unsafe-assignment
		const record = await import("./typebox-with-record.js");
		return {
			success: true,
			value: {
				// oxlint-disable-next-line no-unsafe-assignment, no-unsafe-member-access
				isNumericLiteralCode: numeric.Check,
				// oxlint-disable-next-line no-unsafe-assignment, no-unsafe-member-access
				isRecordCode: record.Check,
			},
		};
	} catch (error: unknown) {
		return { error, success: false };
	}
}

async function generateFilesAsync(
	...codeResults: ReadonlyArray<[name: string, codeResult: CodeResult, type: string]>
): Promise<void> {
	const inspect = await getInspectAsync();
	const writeFileAsync = await getWriteFileAsync();

	await Promise.all(
		codeResults.map(async ([name, codeResult, type]) => {
			const variablesString = inspect(codeResult.External.variables, {
				colors: false,
				compact: true,
				depth: Number.POSITIVE_INFINITY,
				sorted: false,
			});

			const stringBuilder = [
				"// oxlint-disable no-unused-vars, no-unsafe-assignment, no-unsafe-member-access, no-unsafe-argument",
				"/** biome-ignore-all assist/source/organizeImports: dumb */",
				codeResult.Code.replaceAll(/(external_\d+\s*=\s*)\[\]/g, (_, part) => `${part}${variablesString}`),
			];

			return Promise.all([
				writeFileAsync(`./benchmarks/typebox-${name}.js`, stringBuilder.join("\n")),
				writeFileAsync(
					`./benchmarks/typebox-${name}.d.ts`,
					`export declare function Check(value: unknown): value is ${type};\n`,
				),
			]).catch((error: unknown) => {
				console.error(`Failed to write TypeBox benchmark file for ${name}:`, error);
			});
		}),
	);
}

function numericLiteralNodeFunction(value: unknown): value is TSESTree.Literal & { value: number } {
	if (typeof value !== "object" || value === null) return false;
	return (
		"value" in value &&
		"type" in value &&
		value.type === TSESTree.AST_NODE_TYPES.Literal &&
		typeof value.value === "number"
	);
}

const isNumericLiteralNodeRaw = Type.Object({
	type: Type.Literal(TSESTree.AST_NODE_TYPES.Literal),
	value: Type.Number(),
});

const numericLiteralNodeArkType = arktype.type({
	type: "'Literal'",
	value: "number",
});
const numericLiteralNodeSury = S.schema({
	type: S.schema("Literal"),
	value: S.number,
});
const numericLiteralNodeValibot = v.object({
	type: v.literal("Literal"),
	value: v.number(),
});
const numericLiteralNodeTypebox = Compile(isNumericLiteralNodeRaw);

const isRecordRaw = Type.Record(Type.String(), Type.Unknown());

const withArkType = arktype.type("Record<string, unknown>");
const withSury = S.record(S.unknown);
const withTypebox = Compile(isRecordRaw);
const withValibot = v.record(v.string(), v.unknown());
function withFunction(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

const result = await safeImportCodeAsync();

if (!result.success || process.argv.includes("--generate-files") || process.argv.includes("-g")) {
	if (!result.success) console.error("Failed to import existing benchmark files:", result.error);
	await generateFilesAsync(
		["numeric-literal-node", Code(isNumericLiteralNodeRaw), '{ type: "Literal", value: number }'],
		["with-record", Code(isRecordRaw), "Record<string, unknown>"],
	);
	process.exit(0);
}

const { isNumericLiteralCode, isRecordCode } = result.value;

const SIZE = 10000;

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
	const value = nextInteger(0, 6);
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

		case 6: {
			return Math.random() < 0.5
				? {
						type: "Literal",
						value: Math.random() < 0.5 ? nextInteger(-1000, 1000) : "not-a-number",
					}
				: {
						type: "NotLiteral",
						value: Math.random() < 0.5 ? nextInteger(-1000, 1000) : "not-a-number",
					};
		}

		default:
			throw new Error("Unreachable");
	}
}

const values = new Array<unknown>(SIZE);
for (let index = 0; index < SIZE; index += 1) values[index] = nextValue();

barplot(() => {
	bench("typebox", () => {
		for (const value of values) {
			do_not_optimize(withTypebox.Check(value));
			do_not_optimize(numericLiteralNodeTypebox.Check(value));
		}
	});
	bench("typebox (code)", () => {
		for (const value of values) {
			do_not_optimize(isRecordCode(value));
			do_not_optimize(isNumericLiteralCode(value));
		}
	});
	bench("arktype", () => {
		for (const value of values) {
			do_not_optimize(validateArkType(value, withArkType));
			do_not_optimize(validateArkType(value, numericLiteralNodeArkType));
		}
	});
	bench("sury", () => {
		for (const value of values) {
			do_not_optimize(validateSury(value, withSury));
			do_not_optimize(validateSury(value, numericLiteralNodeSury));
		}
	});
	bench("regular function", () => {
		for (const value of values) {
			do_not_optimize(withFunction(value));
			do_not_optimize(numericLiteralNodeFunction(value));
		}
	});
	bench("valibot", () => {
		for (const value of values) {
			do_not_optimize(v.safeParse(withValibot, value));
			do_not_optimize(v.safeParse(numericLiteralNodeValibot, value));
		}
	});
});

await run({});
