import type { Rule } from "eslint";
import noIdiotRule from "./rules/no-idiot";

/**
 * ESLint plugin entry for eslint-cease-nonsense-rules.
 *
 * Exposes rule implementations and configuration presets.
 */
const rules: Readonly<Record<string, Rule.RuleModule>> = {
	"no-idiot": noIdiotRule,
};

/**
 * Recommended configuration placeholder.
 * Note: In ESLint flat config, consumers must register the plugin object under an id,
 * so we cannot reliably reference the plugin id here. We expose an empty config
 * that consumers can extend as needed.
 */
const recommended = {} as const;

const plugin: Readonly<{
	readonly rules: Readonly<Record<string, Rule.RuleModule>>;
	readonly configs: Readonly<Record<string, unknown>>;
}> = {
	configs: { recommended },
	rules,
} as const;

export default plugin;
