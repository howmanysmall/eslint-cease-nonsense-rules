import { unwrapExpression } from "$utilities/ast-utilities";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";

import type { TSESTree } from "@typescript-eslint/utils";

export enum DependencyArrayKind {
	MissingOrOmitted = 0,
	EmptyArray = 1,
	StaticArray = 2,
	DynamicOrUnknown = 3,
}

export function classifyDependencyArray(
	argument: TSESTree.CallExpressionArgument | undefined,
	isStaticArray: (arrayExpression: TSESTree.ArrayExpression) => boolean,
): DependencyArrayKind {
	if (argument === undefined) return DependencyArrayKind.MissingOrOmitted;
	if (argument.type === AST_NODE_TYPES.SpreadElement) return DependencyArrayKind.DynamicOrUnknown;

	const expression = unwrapExpression(argument);
	if (expression.type !== AST_NODE_TYPES.ArrayExpression) return DependencyArrayKind.DynamicOrUnknown;
	if (expression.elements.length === 0) return DependencyArrayKind.EmptyArray;
	return isStaticArray(expression) ? DependencyArrayKind.StaticArray : DependencyArrayKind.DynamicOrUnknown;
}
