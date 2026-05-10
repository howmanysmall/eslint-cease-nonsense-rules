import { AST_NODE_TYPES } from "@typescript-eslint/utils";

import type { TSESTree } from "@typescript-eslint/utils";
import type { Type, TypeChecker } from "typescript";

const REACT_ELEMENT_TYPE_NAMES = new Set(["Element", "ReactElement", "ReactNode", "ReactChild", "ReactFragment"]);

export function isFunctionLikeNode(
	node: TSESTree.Node,
): node is TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression {
	return (
		node.type === AST_NODE_TYPES.FunctionDeclaration ||
		node.type === AST_NODE_TYPES.FunctionExpression ||
		node.type === AST_NODE_TYPES.ArrowFunctionExpression
	);
}

export function isLikelyReactComponentName(name: string): boolean {
	const [firstCharacter] = name;
	if (firstCharacter === undefined || firstCharacter < "A" || firstCharacter > "Z" || name.includes("_")) {
		return false;
	}

	for (const character of name) if (character >= "a" && character <= "z") return true;
	return false;
}

function isDefinitelyNotReactReturnType(checker: TypeChecker, type: Type): boolean {
	if (type.isUnion()) {
		return type.types.every((memberType) => isDefinitelyNotReactReturnType(checker, memberType));
	}

	const typeString = checker.typeToString(type);
	if (
		typeString === "null" ||
		typeString.includes("Element") ||
		typeString.includes("ReactNode") ||
		typeString.includes("ReactElement")
	) {
		return false;
	}

	const symbol = type.getSymbol() ?? type.aliasSymbol;
	if (symbol) {
		const name = symbol.getName();
		if (REACT_ELEMENT_TYPE_NAMES.has(name)) return false;
	}

	if (
		typeString === "string" ||
		typeString === "number" ||
		typeString === "boolean" ||
		typeString === "undefined" ||
		typeString === "void" ||
		typeString === "never"
	) {
		return true;
	}

	if (symbol) {
		const name = symbol.getName();
		if (!(REACT_ELEMENT_TYPE_NAMES.has(name) || name.includes("Element"))) return true;
	}

	return false;
}

export function isReactComponentFunction(checker: TypeChecker, functionType: Type): boolean {
	const callSignatures = functionType.getCallSignatures();
	if (callSignatures.length === 0) return true;

	const [firstSignature] = callSignatures;
	if (!firstSignature) return true;

	const returnType = checker.getReturnTypeOfSignature(firstSignature);
	return !isDefinitelyNotReactReturnType(checker, returnType);
}
