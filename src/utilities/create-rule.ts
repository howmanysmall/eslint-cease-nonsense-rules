import { ESLintUtils } from "@typescript-eslint/utils";

/**
 * Creates an ESLint rule with automatic documentation URL generation.
 * URLs point to: https://github.com/howmanysmall/eslint-cease-nonsense-rules/blob/main/docs/rules/{rule-name}.md
 */
export const createRule = ESLintUtils.RuleCreator(
	(name) => `https://howmanysmall.github.io/eslint-cease-nonsense-rules/rules/${name}`,
);
