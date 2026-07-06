import { createRule } from "$utilities/create-rule";
import { TSESTree } from "@typescript-eslint/types";

type MessageIds = "noUnderscoreReactProperty";

const noUnderscoreReactProperties = createRule<[], MessageIds>({
	create(context) {
		return {
			JSXAttribute(node: TSESTree.JSXAttribute): void {
				if (node.name.type !== TSESTree.AST_NODE_TYPES.JSXIdentifier) return;
				if (!node.name.name.startsWith("_")) return;

				context.report({
					data: { propName: node.name.name },
					messageId: "noUnderscoreReactProperty",
					node: node.name,
				});
			},
		};
	},
	meta: {
		defaultOptions: [],
		docs: {
			description: "Ban React property names that begin with an underscore in JSX.",
		},
		messages: {
			noUnderscoreReactProperty:
				"React prop '{{propName}}' starts with '_'. Remove the leading underscore from the prop name.",
		},
		schema: [],
		type: "problem",
	},
	name: "no-underscore-react-props",
});

export default noUnderscoreReactProperties;
