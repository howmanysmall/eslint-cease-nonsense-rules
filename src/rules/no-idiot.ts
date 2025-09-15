import type { Rule } from "eslint";

type MessageId = "disallowIdiotIdentifier";

/**
 * Disallows using the identifier name "idiot" (case-insensitive).
 *
 * The rule reports any `Identifier` node whose `name` equals "idiot" ignoring case.
 * This encourages respectful and descriptive naming in codebases.
 *
 * @example
 * // ❌ Reports
 * const idiot = 1;
 * function idiot() {}
 * class Idiot {}
 *
 * // ✅ OK
 * const idea = 1;
 * function edit() {}
 * class Editor {}
 */
const noIdiotRule: Rule.RuleModule = {
	/**
	 *
	 * @param context - The rule context provided by ESLint.
	 * @returns - An object with visitor methods to check `Identifier` nodes.
	 */
	create(context) {
		return {
			Identifier(node) {
				const name = node.name;
				if (typeof name === "string" && name.toLowerCase() === "idiot") {
					context.report({
						messageId: "disallowIdiotIdentifier" satisfies MessageId,
						node,
					});
				}
			},
		};
	},
	meta: {
		docs: {
			description: "Disallow the identifier name 'idiot'.",
			recommended: false,
		},
		messages: {
			disallowIdiotIdentifier:
				"Avoid using the identifier 'idiot'; choose a more descriptive and respectful name.",
		},
		schema: [],
		type: "problem",
	},
};

export default noIdiotRule;
