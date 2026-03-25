import { AST_NODE_TYPES } from "@typescript-eslint/utils";

import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

const WRAPPER_TYPES = new Set([
	"TSAsExpression",
	"TSSatisfiesExpression",
	"TSTypeAssertion",
	"TSNonNullExpression",
	"TSInstantiationExpression",
	"ChainExpression",
]);

export function unwrapExpression(expression: TSESTree.Expression): TSESTree.Expression {
	let current: TSESTree.Expression = expression;

	while (WRAPPER_TYPES.has(current.type)) {
		switch (current.type) {
			case AST_NODE_TYPES.TSAsExpression:
			case AST_NODE_TYPES.TSSatisfiesExpression:
			case AST_NODE_TYPES.TSTypeAssertion:
			case AST_NODE_TYPES.TSNonNullExpression:
			case AST_NODE_TYPES.TSInstantiationExpression:
			case AST_NODE_TYPES.ChainExpression:
				current = current.expression;
				break;
		}
	}

	return current;
}

export function getMemberPropertyName(memberExpression: TSESTree.MemberExpression): string | undefined {
	if (!memberExpression.computed) {
		if (memberExpression.property.type === AST_NODE_TYPES.Identifier) return memberExpression.property.name;
		return undefined;
	}

	if (memberExpression.property.type !== AST_NODE_TYPES.Literal) return undefined;
	return typeof memberExpression.property.value === "string" ? memberExpression.property.value : undefined;
}

export function hasShadowedBinding(
	sourceCode: Readonly<TSESLint.SourceCode>,
	node: TSESTree.Node,
	name: string,
): boolean {
	let scope: TSESLint.Scope.Scope | undefined = sourceCode.getScope(node);

	while (scope !== undefined) {
		const variable = scope.set.get(name);
		if (variable !== undefined && variable.defs.length > 0) return true;
		scope = scope.upper ?? undefined;
	}

	return false;
}
