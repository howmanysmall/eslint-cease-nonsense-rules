import { DefinitionType } from "@typescript-eslint/scope-manager";
import type { TSESTree } from "@typescript-eslint/types";
import type { TSESLint } from "@typescript-eslint/utils";
import Typebox from "typebox";
import { Compile } from "typebox/compile";
import { createRule } from "../utilities/create-rule";
import type { ParsedPattern, Pattern, PatternIndex } from "../utilities/pattern-replacement";
import {
	buildPatternIndex,
	canSafelySubstitute,
	evaluateConditions,
	generateReplacement,
	getReplacementIdentifier,
	matchParameters,
	parsePattern,
	resolveCallee,
} from "../utilities/pattern-replacement";

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

export default createRule({
	create(context) {
		const validatedOptions = isRuleOptions.Check(context.options[0]) ? context.options[0] : undefined;
		if (!validatedOptions || validatedOptions.patterns.length === 0) return {};

		const parsedPatterns = parsePatterns(validatedOptions.patterns as ReadonlyArray<Pattern>);
		const patternIndex: PatternIndex = buildPatternIndex(parsedPatterns);
		const { sourceCode } = context;

		function hasNameConflict(node: TSESTree.Node, identifierName: string): boolean {
			let scope = sourceCode.getScope(node) as TSESLint.Scope.Scope | undefined;
			while (scope) {
				const variable = scope.set.get(identifierName);
				if (variable?.defs.some((definition) => definition.type !== DefinitionType.ImportBinding)) {
					return true;
				}
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

			const skippedConflicts: Array<{ replacement: string; conflict: string }> = [];

			for (const pattern of candidates) {
				const captures = matchParameters(
					pattern.parameters,
					node.arguments as ReadonlyArray<TSESTree.Expression>,
					sourceCode,
				);
				if (!(captures && evaluateConditions(pattern.conditions, captures) && canSafelySubstitute(captures))) {
					continue;
				}

				const replacementId = getReplacementIdentifier(pattern.replacement);
				if (replacementId && hasNameConflict(node, replacementId)) {
					skippedConflicts.push({
						conflict: replacementId,
						replacement: generateReplacement(pattern.replacement, captures),
					});
					continue;
				}

				const originalText = sourceCode.getText(node);
				const replacementText = generateReplacement(pattern.replacement, captures);

				context.report({
					data: { original: originalText, replacement: replacementText },
					fix: (fixer) => fixer.replaceText(node, replacementText),
					messageId: "preferReplacement",
					node,
				});

				for (const { replacement, conflict } of skippedConflicts) {
					context.report({
						data: { conflict, replacement },
						messageId: "skippedDueToConflict",
						node,
					});
				}

				return;
			}

			for (const { replacement, conflict } of skippedConflicts) {
				context.report({
					data: { conflict, replacement },
					messageId: "skippedDueToConflict",
					node,
				});
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
		},
		fixable: "code",
		messages: {
			preferReplacement: "Prefer '{{replacement}}' over '{{original}}'",
			skippedDueToConflict: "Pattern '{{replacement}}' was skipped because '{{conflict}}' is already in scope.",
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
	name: "prefer-pattern-replacements",
});
