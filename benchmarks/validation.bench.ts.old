#!/usr/bin/env bun

import { readFile } from "node:fs/promises";
import { type } from "arktype";
import { parseJSONC } from "confbox";
import { barplot, bench, do_not_optimize, run } from "mitata";
import * as sury from "sury";
import Typebox from "typebox";
import { Compile } from "typebox/compile";
import * as valibot from "valibot";
import * as yup from "yup";
import * as z from "zod";

const fromArktype = type({
	"$schema?": "string",
	"arrowParens?": "'always' | 'avoid'",
	"bracketSameLine?": "boolean",
	"bracketSpacing?": "boolean",
	"embeddedLanguageFormatting?": "'auto' | 'off'",
	"endOfLine?": "'lf' | 'crlf' | 'cr'",
	"experimentalOperatorPosition?": "'end' | 'start'",
	"experimentalSortImports?": type({
		"ignoreCase?": "boolean",
		"newlinesBetween?": "boolean",
		"order?": "'asc' | 'desc'",
		"partitionByComment?": "boolean",
		"partitionByNewline?": "boolean",
		"sortSideEffects?": "boolean",
	}).or("null | undefined"),
	"experimentalSortPackageJson?": "boolean",
	"ignorePatterns?": "string[]",
	"jsxSingleQuote?": "boolean",
	"objectWrap?": "'preserve' | 'collapse' | 'always'",
	"printWidth?": "number.integer",
	"quoteProps?": "'as-needed' | 'consistent' | 'preserve'",
	"semi?": "boolean",
	"singleAttributePerLine?": "boolean",
	"singleQuote?": "boolean",
	"tabWidth?": "number.integer",
	"trailingComma?": "'none' | 'es5' | 'all'",
	"useTabs?": "boolean",
});

const fromTypebox = Compile(
	Typebox.Object({
		$schema: Typebox.Optional(Typebox.String()),
		arrowParens: Typebox.Optional(Typebox.Union([Typebox.Literal("always"), Typebox.Literal("avoid")] as const)),
		bracketSameLine: Typebox.Optional(Typebox.Boolean()),
		bracketSpacing: Typebox.Optional(Typebox.Boolean()),
		embeddedLanguageFormatting: Typebox.Optional(
			Typebox.Union([Typebox.Literal("auto"), Typebox.Literal("off")] as const),
		),
		endOfLine: Typebox.Optional(
			Typebox.Union([Typebox.Literal("lf"), Typebox.Literal("crlf"), Typebox.Literal("cr")] as const),
		),
		experimentalOperatorPosition: Typebox.Optional(
			Typebox.Union([Typebox.Literal("end"), Typebox.Literal("start")] as const),
		),
		experimentalSortImports: Typebox.Optional(
			Typebox.Object({
				ignoreCase: Typebox.Optional(Typebox.Boolean()),
				newlinesBetween: Typebox.Optional(Typebox.Boolean()),
				order: Typebox.Optional(Typebox.Union([Typebox.Literal("asc"), Typebox.Literal("desc")] as const)),
				partitionByComment: Typebox.Optional(Typebox.Boolean()),
				partitionByNewline: Typebox.Optional(Typebox.Boolean()),
				sortSideEffects: Typebox.Optional(Typebox.Boolean()),
			}),
		),
		experimentalSortPackageJson: Typebox.Optional(Typebox.Boolean()),
		ignorePatterns: Typebox.Optional(Typebox.Array(Typebox.String())),
		jsxSingleQuote: Typebox.Optional(Typebox.Boolean()),
		objectWrap: Typebox.Optional(
			Typebox.Union([
				Typebox.Literal("preserve"),
				Typebox.Literal("collapse"),
				Typebox.Literal("always"),
			] as const),
		),
		printWidth: Typebox.Optional(Typebox.Integer()),
		quoteProps: Typebox.Optional(
			Typebox.Union([
				Typebox.Literal("as-needed"),
				Typebox.Literal("consistent"),
				Typebox.Literal("preserve"),
			] as const),
		),
		semi: Typebox.Optional(Typebox.Boolean()),
		singleAttributePerLine: Typebox.Optional(Typebox.Boolean()),
		singleQuote: Typebox.Optional(Typebox.Boolean()),
		tabWidth: Typebox.Optional(Typebox.Integer()),
		trailingComma: Typebox.Optional(
			Typebox.Union([Typebox.Literal("none"), Typebox.Literal("es5"), Typebox.Literal("all")] as const),
		),
		useTabs: Typebox.Optional(Typebox.Boolean()),
	}),
);
type OxfmtConfiguration = Typebox.Static<typeof fromTypebox>;

const fromZod = z.object({
	$schema: z.string().optional(),
	arrowParens: z.enum(["always", "avoid"]).optional(),
	bracketSameLine: z.boolean().optional(),
	bracketSpacing: z.boolean().optional(),
	embeddedLanguageFormatting: z.enum(["auto", "off"]).optional(),
	endOfLine: z.enum(["lf", "crlf", "cr"]).optional(),
	experimentalOperatorPosition: z.enum(["end", "start"]).optional(),
	experimentalSortImports: z
		.object({
			ignoreCase: z.boolean().optional(),
			newlinesBetween: z.boolean().optional(),
			order: z.enum(["asc", "desc"]).optional(),
			partitionByComment: z.boolean().optional(),
			partitionByNewline: z.boolean().optional(),
			sortSideEffects: z.boolean().optional(),
		})
		.optional(),
	experimentalSortPackageJson: z.boolean().optional(),
	ignorePatterns: z.array(z.string()).optional(),
	jsxSingleQuote: z.boolean().optional(),
	objectWrap: z.enum(["preserve", "collapse", "always"]).optional(),
	printWidth: z.number().int().optional(),
	quoteProps: z.enum(["as-needed", "consistent", "preserve"]).optional(),
	semi: z.boolean().optional(),
	singleAttributePerLine: z.boolean().optional(),
	singleQuote: z.boolean().optional(),
	tabWidth: z.number().int().optional(),
	trailingComma: z.enum(["none", "es5", "all"]).optional(),
	useTabs: z.boolean().optional(),
});

const fromValibot = valibot.object({
	$schema: valibot.optional(valibot.string()),
	arrowParens: valibot.optional(valibot.picklist(["always", "avoid"])),
	bracketSameLine: valibot.optional(valibot.boolean()),
	bracketSpacing: valibot.optional(valibot.boolean()),
	embeddedLanguageFormatting: valibot.optional(valibot.picklist(["auto", "off"])),
	endOfLine: valibot.optional(valibot.picklist(["lf", "crlf", "cr"])),
	experimentalOperatorPosition: valibot.optional(valibot.picklist(["end", "start"])),
	experimentalSortImports: valibot.optional(
		valibot.object({
			ignoreCase: valibot.optional(valibot.boolean()),
			newlinesBetween: valibot.optional(valibot.boolean()),
			order: valibot.optional(valibot.picklist(["asc", "desc"])),
			partitionByComment: valibot.optional(valibot.boolean()),
			partitionByNewline: valibot.optional(valibot.boolean()),
			sortSideEffects: valibot.optional(valibot.boolean()),
		}),
	),
	experimentalSortPackageJson: valibot.optional(valibot.boolean()),
	ignorePatterns: valibot.optional(valibot.array(valibot.string())),
	jsxSingleQuote: valibot.optional(valibot.boolean()),
	objectWrap: valibot.optional(valibot.picklist(["preserve", "collapse", "always"])),
	printWidth: valibot.optional(valibot.number()),
	quoteProps: valibot.optional(valibot.picklist(["as-needed", "consistent", "preserve"])),
	semi: valibot.optional(valibot.boolean()),
	singleAttributePerLine: valibot.optional(valibot.boolean()),
	singleQuote: valibot.optional(valibot.boolean()),
	tabWidth: valibot.optional(valibot.number()),
	trailingComma: valibot.optional(valibot.picklist(["none", "es5", "all"])),
	useTabs: valibot.optional(valibot.boolean()),
});

const fromYup = yup.object({
	$schema: yup.string().nullable(),
	arrowParens: yup.mixed<"always" | "avoid">().nullable(),
	bracketSameLine: yup.boolean().nullable(),
	bracketSpacing: yup.boolean().nullable(),
	embeddedLanguageFormatting: yup.mixed<"auto" | "off">().nullable(),
	endOfLine: yup.mixed<"lf" | "crlf" | "cr">().nullable(),
	experimentalOperatorPosition: yup.mixed<"end" | "start">().nullable(),
	experimentalSortImports: yup
		.object({
			ignoreCase: yup.boolean().nullable(),
			newlinesBetween: yup.boolean().nullable(),
			order: yup.mixed<"asc" | "desc">().nullable(),
			partitionByComment: yup.boolean().nullable(),
			partitionByNewline: yup.boolean().nullable(),
			sortSideEffects: yup.boolean().nullable(),
		})
		.nullable(),
	experimentalSortPackageJson: yup.boolean().nullable(),
	ignorePatterns: yup.array(yup.string()).nullable(),
	jsxSingleQuote: yup.boolean().nullable(),
	objectWrap: yup.mixed<"preserve" | "collapse" | "always">().nullable(),
	printWidth: yup.number().nullable(),
	quoteProps: yup.mixed<"as-needed" | "consistent" | "preserve">().nullable(),
	semi: yup.boolean().nullable(),
	singleAttributePerLine: yup.boolean().nullable(),
	singleQuote: yup.boolean().nullable(),
	tabWidth: yup.number().nullable(),
	trailingComma: yup.mixed<"none" | "es5" | "all">().nullable(),
	useTabs: yup.boolean().nullable(),
});

const fromSury = sury.schema({
	$schema: sury.optional(sury.string),
	arrowParens: sury.optional(sury.union(["always", "avoid"])),
	bracketSameLine: sury.optional(sury.boolean),
	bracketSpacing: sury.optional(sury.boolean),
	embeddedLanguageFormatting: sury.optional(sury.union(["auto", "off"])),
	endOfLine: sury.optional(sury.union(["lf", "crlf", "cr"])),
	experimentalOperatorPosition: sury.optional(sury.union(["end", "start"])),
	experimentalSortImports: sury.nullish(
		sury.schema({
			ignoreCase: sury.optional(sury.boolean),
			newlinesBetween: sury.optional(sury.boolean),
			order: sury.optional(sury.union(["asc", "desc"])),
			partitionByComment: sury.optional(sury.boolean),
			partitionByNewline: sury.optional(sury.boolean),
			sortSideEffects: sury.optional(sury.boolean),
		}),
	),
	experimentalSortPackageJson: sury.optional(sury.boolean),
	ignorePatterns: sury.optional(sury.array(sury.string)),
	jsxSingleQuote: sury.optional(sury.boolean),
	objectWrap: sury.optional(sury.union(["preserve", "collapse", "always"])),
	printWidth: sury.optional(sury.int32),
	quoteProps: sury.optional(sury.union(["as-needed", "consistent", "preserve"])),
	semi: sury.optional(sury.boolean),
	singleAttributePerLine: sury.optional(sury.boolean),
	singleQuote: sury.optional(sury.boolean),
	tabWidth: sury.optional(sury.int32),
	trailingComma: sury.optional(sury.union(["none", "es5", "all"])),
	useTabs: sury.optional(sury.boolean),
});

const testValue = parseJSONC<OxfmtConfiguration>(await readFile(".oxfmtrc.json", "utf8"));

barplot(() => {
	bench("typebox", () => {
		do_not_optimize(fromTypebox.Check(testValue));
	});
	bench("arktype", () => {
		do_not_optimize(fromArktype.assert(testValue));
	});
	bench("zod", () => {
		do_not_optimize(fromZod.safeParse(testValue));
	});
	bench("valibot", () => {
		do_not_optimize(valibot.safeParse(fromValibot, testValue));
	});
	bench("yup", () => {
		try {
			do_not_optimize(fromYup.validateSync(testValue));
		} catch {
			// Ignore errors
		}
	});
	bench("sury", () => {
		do_not_optimize(sury.parseOrThrow(testValue, fromSury));
	});
});

await run({});
