import Type from "typebox";
import { Compile } from "typebox/compile";

export const isOxfmtConfiguration = Compile(
	Type.Object({
		$schema: Type.Optional(Type.String()),
		arrowParens: Type.Optional(Type.Union([Type.Literal("always"), Type.Literal("avoid")] as const)),
		bracketSameLine: Type.Optional(Type.Boolean()),
		bracketSpacing: Type.Optional(Type.Boolean()),
		embeddedLanguageFormatting: Type.Optional(Type.Union([Type.Literal("auto"), Type.Literal("off")] as const)),
		endOfLine: Type.Optional(Type.Union([Type.Literal("lf"), Type.Literal("crlf"), Type.Literal("cr")] as const)),
		experimentalOperatorPosition: Type.Optional(Type.Union([Type.Literal("end"), Type.Literal("start")] as const)),
		experimentalSortImports: Type.Optional(
			Type.Object({
				ignoreCase: Type.Optional(Type.Boolean()),
				newlinesBetween: Type.Optional(Type.Boolean()),
				order: Type.Optional(Type.Union([Type.Literal("asc"), Type.Literal("desc")] as const)),
				partitionByComment: Type.Optional(Type.Boolean()),
				partitionByNewline: Type.Optional(Type.Boolean()),
				sortSideEffects: Type.Optional(Type.Boolean()),
			}),
		),
		ignorePatterns: Type.Optional(Type.Array(Type.String())),
		jsxSingleQuote: Type.Optional(Type.Boolean()),
		objectWrap: Type.Optional(
			Type.Union([Type.Literal("preserve"), Type.Literal("collapse"), Type.Literal("always")] as const),
		),
		printWidth: Type.Optional(Type.Integer()),
		quoteProps: Type.Optional(Type.Union([Type.Literal("as-needed"), Type.Literal("preserve")] as const)),
		semi: Type.Optional(Type.Boolean()),
		singleAttributePerLine: Type.Optional(Type.Boolean()),
		singleQuote: Type.Optional(Type.Boolean()),
		tabWidth: Type.Optional(Type.Integer()),
		trailingComma: Type.Optional(
			Type.Union([Type.Literal("none"), Type.Literal("es5"), Type.Literal("all")] as const),
		),
		useTabs: Type.Optional(Type.Boolean()),
	}),
);
export type OxfmtConfiguration = Type.Static<typeof isOxfmtConfiguration>;
