import { TSESTree } from "@typescript-eslint/types";
import type { TSESLint } from "@typescript-eslint/utils";

type MessageIds = "banReactFC";

interface RuleDocsWithRecommended extends TSESLint.RuleMetaDataDocs {
	readonly recommended?: boolean;
}

/**
 * Bans React.FC and similar component type annotations.
 *
 * React.FC (Function Component) and related types like FunctionComponent, VFC, and VoidFunctionComponent
 * have several drawbacks:
 * - They break debug information in React DevTools, making profiling harder
 * - They add unnecessary complexity compared to simple function declarations
 * - They encourage poor patterns like implicit children handling
 *
 * Instead, use explicit function declarations with proper parameter typing.
 *
 * @example
 * // ❌ Reports
 * export const MyComponent: React.FC<Props> = ({ children }) => {
 *   return <div>{children}</div>;
 * };
 *
 * // ✅ OK
 * export function MyComponent({ children }: Props) {
 *   return <div>{children}</div>;
 * }
 */

const BANNED_FC_NAMES = new Set(["FC", "FunctionComponent", "VFC", "VoidFunctionComponent"]);

const banReactFC: TSESLint.RuleModuleWithMetaDocs<MessageIds, [], RuleDocsWithRecommended> = {
	/**
	 * Creates the ESLint rule visitor.
	 *
	 * @param context - The ESLint rule context.
	 * @returns The visitor object with AST node handlers.
	 */
	create(context) {
		return {
			VariableDeclarator(node: TSESTree.VariableDeclarator) {
				const typeAnnotation = node.id.typeAnnotation;
				if (!typeAnnotation) return;

				const inner = typeAnnotation.typeAnnotation;
				if (inner.type !== TSESTree.AST_NODE_TYPES.TSTypeReference) return;

				const typeName = inner.typeName;

				let isBannedFC = false;
				if (typeName.type === TSESTree.AST_NODE_TYPES.Identifier)
					isBannedFC = BANNED_FC_NAMES.has(typeName.name);
				else if (typeName.type === TSESTree.AST_NODE_TYPES.TSQualifiedName)
					isBannedFC = BANNED_FC_NAMES.has(typeName.right.name);

				if (!isBannedFC) return;

				const initType = node.init?.type;
				if (initType !== TSESTree.AST_NODE_TYPES.ArrowFunctionExpression) return;

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
