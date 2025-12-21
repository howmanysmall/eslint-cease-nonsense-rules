import { TSESTree } from "@typescript-eslint/types";
import type { TSESLint } from "@typescript-eslint/utils";

type MessageIds = "banReactFC";

interface RuleDocsWithRecommended extends TSESLint.RuleMetaDataDocs {
	readonly recommended?: boolean;
}

const BANNED_FC_NAMES = new Set(["FC", "FunctionComponent", "VFC", "VoidFunctionComponent"]);

const banReactFC: TSESLint.RuleModuleWithMetaDocs<MessageIds, [], RuleDocsWithRecommended> = {
	create(context) {
		return {
			VariableDeclarator(node: TSESTree.VariableDeclarator) {
				const { typeAnnotation } = node.id;
				if (!typeAnnotation) return;

				const inner = typeAnnotation.typeAnnotation;
				if (inner.type !== TSESTree.AST_NODE_TYPES.TSTypeReference) return;

				const { typeName } = inner;

				let isBannedFc = false;
				if (typeName.type === TSESTree.AST_NODE_TYPES.Identifier) {
					isBannedFc = BANNED_FC_NAMES.has(typeName.name);
				} else if (typeName.type === TSESTree.AST_NODE_TYPES.TSQualifiedName) {
					isBannedFc = BANNED_FC_NAMES.has(typeName.right.name);
				}

				if (!isBannedFc || node.init?.type !== TSESTree.AST_NODE_TYPES.ArrowFunctionExpression) return;

				context.report({
					messageId: "banReactFC",
					node,
				});
			},
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description:
				"Ban React.FC and similar component type annotations. Use explicit function declarations instead.",
			recommended: true,
		},
		messages: {
			banReactFC:
				"Avoid React.FC/FunctionComponent/VFC/VoidFunctionComponent types. They break debug information and profiling. Use explicit function declarations instead: `function Component(props: Props) { ... }`",
		},
		schema: [],
		type: "problem",
	},
};

export default banReactFC;
