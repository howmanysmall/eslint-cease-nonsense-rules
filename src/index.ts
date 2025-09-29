import type { Linter, Rule } from "eslint";
import enforceIanitorCheckType from "./rules/enforce-ianitor-check-type";
import noColor3Constructor from "./rules/no-color3-constructor";
import noPrint from "./rules/no-print";
import noShorthandNames from "./rules/no-shorthand-names";
import noWarn from "./rules/no-warn";
import requireReactComponentKeys from "./rules/require-react-component-keys";

/**
 * ESLint plugin entry for eslint-cease-nonsense-rules.
 *
 * Exposes rule implementations and configuration presets for ESLint flat config.
 */
const rules: Readonly<Record<string, Rule.RuleModule>> = {
	"enforce-ianitor-check-type": enforceIanitorCheckType,
	"no-color3-constructor": noColor3Constructor,
	"no-print": noPrint,
	"no-shorthand-names": noShorthandNames,
	"no-warn": noWarn,
	"require-react-component-keys": requireReactComponentKeys,
} as const;

/**
 * Recommended configuration for ESLint flat config.
 *
 * Enables all rules with recommended settings. Users should import this
 * configuration and add it to their flat config array.
 *
 * @example
 * ```typescript
 * import ceaseNonsense from '@pobammer-ts/eslint-cease-nonsense-rules';
 *
 * export default [
 *   ceaseNonsense.configs.recommended,
 *   // ... other configs
 * ];
 * ```
 */
const recommended: Linter.Config = {
	plugins: {
		"cease-nonsense": {
			rules,
		},
	},
	rules: {
		"cease-nonsense/enforce-ianitor-check-type": "error",
		"cease-nonsense/no-color3-constructor": "error",
		"cease-nonsense/no-print": "error",
		"cease-nonsense/no-shorthand-names": "error",
		"cease-nonsense/no-warn": "error",
		"cease-nonsense/require-react-component-keys": "error",
	},
} as const;

interface Plugin {
	readonly rules: Readonly<Record<string, Rule.RuleModule>>;
	readonly configs: Readonly<{
		readonly recommended: Linter.Config;
	}>;
}

const plugin: Plugin = {
	configs: { recommended },
	rules,
} as const;

export default plugin;
