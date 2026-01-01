import type { TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utilities/create-rule";

export default createRule({
	create(context) {
		return {
			'CallExpression[callee.type="Identifier"][callee.name="print"]'(node): void {
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
			description: "Ban print() function calls. Use Log instead.",
		},
		messages: {
			useLog: "Use Log instead of print()",
		},
		schema: [],
		type: "problem",
	},
	name: "no-print",
}) as unknown as TSESLint.AnyRuleModuleWithMetaDocs;
