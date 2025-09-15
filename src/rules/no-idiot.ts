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
  meta: {
    type: "problem",
    docs: {
      description: "Disallow the identifier name 'idiot'.",
      recommended: false
    },
    schema: [],
    messages: {
      disallowIdiotIdentifier:
        "Avoid using the identifier 'idiot'; choose a more descriptive and respectful name."
    }
  },
  create(context) {
    return {
      Identifier(node) {
        const name = node.name;
        if (typeof name === "string" && name.toLowerCase() === "idiot") {
          context.report({
            node,
            messageId: "disallowIdiotIdentifier" satisfies MessageId
          });
        }
      }
    };
  }
};

export default noIdiotRule;
