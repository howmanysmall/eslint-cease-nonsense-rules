import { isGlobalScope } from "$utilities/scope-utilities";
import { AST_NODE_TYPES } from "@typescript-eslint/types";
import { isEnumMember, isExpression, isTypeNode } from "typescript";

import type { TSESLint } from "@typescript-eslint/utils";
import type { Declaration, EnumMember, Node as TypeScriptNode, Type, TypeChecker, TypeNode } from "typescript";

interface ContextualTypeChecker {
	readonly getContextualType: (node: Parameters<TypeChecker["getContextualType"]>[0]) => Type | undefined;
}

export function getContextualTypeForExpressionNode(
	checker: ContextualTypeChecker,
	node: TypeScriptNode,
): Type | undefined {
	if (!isExpression(node)) return undefined;
	return checker.getContextualType(node) ?? undefined;
}

export function getTypeNodeResult<Result>(
	node: TypeScriptNode,
	callback: (node: TypeNode) => Result,
): Result | undefined {
	if (!isTypeNode(node)) return undefined;
	return callback(node);
}

export function getRequiredEnumMemberDeclaration(declaration: Declaration | undefined): EnumMember {
	if (declaration !== undefined && isEnumMember(declaration)) return declaration;

	const error = new Error("Expected enum member symbol to have an enum member declaration.");
	Error.captureStackTrace(error, getRequiredEnumMemberDeclaration);
	throw error;
}

export function isScriptProgramScope(scope: TSESLint.Scope.Scope): boolean {
	const upperScope = scope.upper;
	if (upperScope === null || !isGlobalScope(upperScope)) return false;

	const { block } = upperScope;
	return block.type === AST_NODE_TYPES.Program && block.sourceType === "script";
}
