import type { TSESTree } from "@typescript-eslint/types";
import type { TSESLint } from "@typescript-eslint/utils";
import Typebox from "typebox";
import { Compile } from "typebox/compile";

import {
	buildPatternIndex,
	canSafelySubstitute,
	evaluateConditions,
	generateReplacement,
	getReplacementIdentifier,
	matchArgs,
	parsePattern,
	resolveCallee,
} from "../utilities/pattern-replacement";
import type { ParsedPattern, Pattern, PatternIndex } from "../utilities/pattern-replacement";

export interface PreferPatternReplacementsOptions {
	readonly patterns: ReadonlyArray<Pattern>;
}

type Options = [PreferPatternReplacementsOptions?];
type MessageIds = "preferReplacement";

interface RuleDocsWithRecommended extends TSESLint.RuleMetaDataDocs {
	readonly recommended: boolean;
}

const isRuleOptions = Compile(
	Typebox.Object({
		patterns: Typebox.Array(Typebox.Object({}, { additionalProperties: true })),
	}),
);

function parsePatterns(patterns: ReadonlyArray<Pattern>): ReadonlyArray<ParsedPattern> {
	return patterns.map((pattern) =>
		parsePattern(pattern.match, pattern.replacement, pattern.when as Record<string, never> | undefined),
	);
}

const preferPatternReplacements: TSESLint.RuleModuleWithMetaDocs<MessageIds, Options, RuleDocsWithRecommended> = {
	create(context) {
		const validatedOptions = isRuleOptions.Check(context.options[0]) ? context.options[0] : undefined;
		if (!validatedOptions || validatedOptions.patterns.length === 0) {
			return {};
		}

		const parsedPatterns = parsePatterns(validatedOptions.patterns as ReadonlyArray<Pattern>);
		const patternIndex: PatternIndex = buildPatternIndex(parsedPatterns);
		const { sourceCode } = context;

		function hasNameConflict(node: TSESTree.Node, identifierName: string): boolean {
			let scope = sourceCode.getScope(node) as TSESLint.Scope.Scope | undefined;
			while (scope) {
				if (scope.set.has(identifierName)) return true;
				scope = scope.upper ?? undefined;
			}
			return false;
		}

		function checkNode(node: TSESTree.CallExpression | TSESTree.NewExpression): void {
			const resolved = resolveCallee(node);
			if (resolved.kind === "unknown") return;

			const key =
				resolved.kind === "constructor"
					? `constructor:${resolved.typeName}`
					: `staticMethod:${resolved.typeName}:${resolved.methodName}`;

			const candidates = patternIndex.get(key);
			if (!candidates || candidates.length === 0) return;

			for (const pattern of candidates) {
				const captures = matchArgs(
					pattern.args,
					node.arguments as ReadonlyArray<TSESTree.Expression>,
					sourceCode,
				);
				if (!captures) continue;

				if (!evaluateConditions(pattern.conditions, captures)) continue;

				if (!canSafelySubstitute(captures)) continue;

				const replacementId = getReplacementIdentifier(pattern.replacement);
				if (replacementId && hasNameConflict(node, replacementId)) continue;

				const originalText = sourceCode.getText(node);
				const replacementText = generateReplacement(pattern.replacement, captures);

				context.report({
					data: { original: originalText, replacement: replacementText },
					fix: (fixer) => fixer.replaceText(node, replacementText),
					messageId: "preferReplacement",
					node,
				});

				return;
			}
		}

		return {
			CallExpression: checkNode,
			NewExpression: checkNode,
		};
	},
	defaultOptions: [{ patterns: [] }],
	meta: {
		docs: {
			description: "Enforce using configured replacements for common constructor/method patterns",
			recommended: false,
		},
		fixable: "code",
		messages: {
			preferReplacement: "Prefer '{{replacement}}' over '{{original}}'",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					patterns: {
						items: { type: "object" },
						type: "array",
					},
				},
				type: "object",
			},
		],
		type: "suggestion",
	},
};

export default preferPatternReplacements;
