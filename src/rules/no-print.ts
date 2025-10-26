import type { Rule } from "eslint";

const noPrint: Rule.RuleModule = {
	create(context) {
		return {
			'CallExpression[callee.type="Identifier"][callee.name="print"]'(node: Rule.Node) {
				context.report({
					messageId: "useLog",
					node,
				});
			},
		};
	},
	meta: {
		docs: {
			description: "Ban print() function calls. Use Log instead.",
			recommended: false,
		},
		messages: {
			useLog: "Use Log instead of print()",
		},
		schema: [],
		type: "problem",
	},
};

export default noPrint;
