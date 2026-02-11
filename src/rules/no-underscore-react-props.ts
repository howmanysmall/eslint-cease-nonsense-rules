import { TSESTree } from "@typescript-eslint/types";
import { createRule } from "../utilities/create-rule";

type MessageIds = "noUnderscoreReactProp";

export default createRule<[], MessageIds>({
	create(context) {
		return {
			JSXAttribute(node: TSESTree.JSXAttribute): void {
				if (node.name.type !== TSESTree.AST_NODE_TYPES.JSXIdentifier) return;
				if (!node.name.name.startsWith("_")) return;

				context.report({
					data: { propName: node.name.name },
					messageId: "noUnderscoreReactProp",
					node: node.name,
				});
			},
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description: "Ban React property names that begin with an underscore in JSX.",
		},
		messages: {
			noUnderscoreReactProp:
				"React prop '{{propName}}' starts with '_'. Remove the leading underscore from the prop name.",
		},
		schema: [],
		type: "problem",
	},
	name: "no-underscore-react-props",
});
