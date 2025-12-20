import Typebox from "typebox";
import { Compile } from "typebox/compile";

export const isOxfmtConfiguration = Compile(
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
export type OxfmtConfiguration = Typebox.Static<typeof isOxfmtConfiguration>;
