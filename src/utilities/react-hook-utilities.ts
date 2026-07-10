import { getCalleeName, getStaticCalleeName } from "$utilities/ast-utilities";
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
	const calleeName =
		options.allowComputedIdentifierProperty === true ? getCalleeName(callee) : getStaticCalleeName(callee);

	if (callee.type === AST_NODE_TYPES.Identifier) return hookIdentifiers.has(calleeName ?? "");
	if (callee.type !== AST_NODE_TYPES.MemberExpression) return false;
	if (callee.computed && options.allowComputedIdentifierProperty !== true) return false;
	if (callee.object.type !== AST_NODE_TYPES.Identifier) return false;
	if (calleeName === undefined) return false;

	return reactNamespaces.has(callee.object.name) && calleeName === hookName;
}
