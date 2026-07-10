import { AST_NODE_TYPES } from "@typescript-eslint/utils";

import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

export function unwrapExpression(expression: TSESTree.Expression): TSESTree.Expression {
	let current: TSESTree.Expression = expression;

	while (true) {
		switch (current.type) {
			case AST_NODE_TYPES.TSAsExpression:
			case AST_NODE_TYPES.TSInstantiationExpression:
			case AST_NODE_TYPES.TSNonNullExpression:
			case AST_NODE_TYPES.TSSatisfiesExpression:
			case AST_NODE_TYPES.TSTypeAssertion:
			case AST_NODE_TYPES.ChainExpression: {
				current = current.expression;
				continue;
			}

			default:
				return current;
		}
	}
}

export function unwrapNode(node: TSESTree.Node): TSESTree.Node {
	let current = node;

	while (true) {
		switch (current.type) {
			case AST_NODE_TYPES.TSAsExpression:
			case AST_NODE_TYPES.TSInstantiationExpression:
			case AST_NODE_TYPES.TSNonNullExpression:
			case AST_NODE_TYPES.TSSatisfiesExpression:
			case AST_NODE_TYPES.TSTypeAssertion:
			case AST_NODE_TYPES.ChainExpression: {
				current = current.expression;
				continue;
			}

			default:
				return current;
		}
	}
}

export function getMemberPropertyName(memberExpression: TSESTree.MemberExpression): string | undefined {
	if (!memberExpression.computed) {
		if (memberExpression.property.type === AST_NODE_TYPES.Identifier) return memberExpression.property.name;
		return undefined;
	}

	if (memberExpression.property.type !== AST_NODE_TYPES.Literal) return undefined;
	return typeof memberExpression.property.value === "string" ? memberExpression.property.value : undefined;
}

export function getCalleeName(callee: TSESTree.CallExpression["callee"]): string | undefined {
	if (callee.type === AST_NODE_TYPES.Identifier) return callee.name;
	if (callee.type === AST_NODE_TYPES.MemberExpression && callee.property.type === AST_NODE_TYPES.Identifier) {
		return callee.property.name;
	}

	return undefined;
}

export function getStaticCalleeName(callee: TSESTree.CallExpression["callee"]): string | undefined {
	if (callee.type === AST_NODE_TYPES.MemberExpression && callee.computed) return undefined;
	return getCalleeName(callee);
}

export function getCallExpressionName(callExpression: TSESTree.CallExpression): string | undefined {
	return getCalleeName(callExpression.callee);
}

export function getImportSpecifierName(specifier: TSESTree.ImportSpecifier): string {
	if (specifier.imported.type === AST_NODE_TYPES.Identifier) return specifier.imported.name;
	return specifier.imported.value;
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
