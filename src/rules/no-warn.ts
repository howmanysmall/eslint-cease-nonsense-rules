import { createRule } from "../utilities/create-rule";

export default createRule({
	create(context) {
		return {
			'CallExpression[callee.type="Identifier"][callee.name="warn"]'(node): void {
				context.report({
					messageId: "useLog",
					node,
				});
			},
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description: "Ban warn() function calls. Use Log instead.",
		},
		messages: {
			useLog: "Use Log instead of warn()",
		},
		schema: [],
		type: "problem",
	},
	name: "no-warn",
});
