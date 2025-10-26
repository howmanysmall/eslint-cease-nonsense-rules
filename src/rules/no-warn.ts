import type { Rule } from "eslint";

const noWarn: Rule.RuleModule = {
	create(context) {
		return {
			'CallExpression[callee.type="Identifier"][callee.name="warn"]'(node: Rule.Node) {
				context.report({
					messageId: "useLog",
					node,
				});
			},
		};
	},
	meta: {
		docs: {
			description: "Ban warn() function calls. Use Log instead.",
			recommended: false,
		},
		messages: {
			useLog: "Use Log instead of warn()",
		},
		schema: [],
		type: "problem",
	},
};

export default noWarn;
