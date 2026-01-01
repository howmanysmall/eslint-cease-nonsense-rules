import { ScopeType } from "@typescript-eslint/scope-manager";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utilities/create-rule";

type MessageIds = "mustUseConst" | "mustBeModuleScope";

const SCREAMING_SNAKE_CASE = /^[A-Z][A-Z0-9_]*$/;

function isTopScope(scope: TSESLint.Scope.Scope): boolean {
	const { type } = scope;
	if (type === ScopeType.module || type === ScopeType.global) return true;

	if (scope.upper?.type === ScopeType.global) {
		const { block } = scope.upper;
		if (block.type === AST_NODE_TYPES.Program && block.sourceType === "script") return true;
	}

	return false;
}

export default createRule<[], MessageIds>({
	create(context) {
		let inConstDeclaration = false;

		return {
			VariableDeclaration(node): void {
				inConstDeclaration = node.kind === "const";
			},
			"VariableDeclaration:exit"(): void {
				inConstDeclaration = false;
			},
			VariableDeclarator(node: TSESTree.VariableDeclarator): void {
				const { id } = node;
				if (id.type !== AST_NODE_TYPES.Identifier || !SCREAMING_SNAKE_CASE.test(id.name)) return;

				if (!inConstDeclaration) {
					context.report({
						messageId: "mustUseConst",
						node,
					});
					return;
				}

				const scope = context.sourceCode.getScope(node);
				if (isTopScope(scope)) return;

				context.report({
					messageId: "mustBeModuleScope",
					node,
				});
			},
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description:
				"Prefer that screaming snake case variables always be defined using `const`, and always appear at module scope.",
		},
		messages: {
			mustBeModuleScope:
				"You must place screaming snake case at module scope. If this is not meant to be a module-scoped variable, use camelcase instead.",
			mustUseConst:
				"You must use `const` when defining screaming snake case variables. If this is not a constant, use camelcase instead.",
		},
		schema: [],
		type: "suggestion",
	},
	name: "prefer-module-scope-constants",
});
