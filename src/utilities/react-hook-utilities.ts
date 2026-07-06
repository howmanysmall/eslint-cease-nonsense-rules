import { AST_NODE_TYPES } from "@typescript-eslint/types";

import type { TSESTree } from "@typescript-eslint/types";

interface NamedReactHookCallOptions {
	readonly allowComputedIdentifierProperty?: boolean;
}

export function isNamedReactHookCall(
	node: TSESTree.CallExpression,
	hookName: string,
	hookIdentifiers: ReadonlySet<string>,
	reactNamespaces: ReadonlySet<string>,
	options: NamedReactHookCallOptions = {},
): boolean {
	const { callee } = node;

	if (callee.type === AST_NODE_TYPES.Identifier) return hookIdentifiers.has(callee.name);
	if (callee.type !== AST_NODE_TYPES.MemberExpression) return false;
	if (callee.computed && options.allowComputedIdentifierProperty !== true) return false;
	if (callee.object.type !== AST_NODE_TYPES.Identifier) return false;
	if (callee.property.type !== AST_NODE_TYPES.Identifier) return false;

	return reactNamespaces.has(callee.object.name) && callee.property.name === hookName;
}
