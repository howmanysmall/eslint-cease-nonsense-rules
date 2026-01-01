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
			useLog: "warn() is a raw output function lacking log levels, timestamps, and filtering. Production systems require structured logging for debugging and monitoring. Replace warn(...) with something from the logging package.",
		},
		schema: [],
		type: "problem",
	},
	name: "no-warn",
});
