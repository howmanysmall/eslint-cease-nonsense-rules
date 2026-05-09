import { isKeyOfNode, isNode } from "./oxc-utilities";

import type { ESTree, Scope, SourceCode } from "oxlint-plugin-utilities";

export function unwrapExpression(expression: ESTree.Expression): ESTree.Expression {
	let current: ESTree.Expression = expression;

	while (true) {
		switch (current.type) {
			case "ChainExpression":
			case "ParenthesizedExpression":
			case "TSAsExpression":
			case "TSInstantiationExpression":
			case "TSNonNullExpression":
			case "TSSatisfiesExpression":
			case "TSTypeAssertion": {
				current = current.expression;
				break;
			}

			default:
				return current;
		}
	}
}

export function getMemberPropertyName(node: ESTree.MemberExpression): string | undefined {
	if (node.computed) {
		return node.property.type === "Literal" && typeof node.property.value === "string"
			? node.property.value
			: undefined;
	}

	return node.property.type === "Identifier" ? node.property.name : undefined;
}

export function hasShadowedBinding(sourceCode: SourceCode, node: ESTree.Node, name: string): boolean {
	let scope: null | Scope = sourceCode.getScope(node);

	while (scope !== null) {
		const variable = scope.set.get(name);
		if (variable !== undefined && variable.defs.length > 0) return true;
		scope = scope.upper;
	}

	return false;
}

export function walkAst(node: ESTree.Node, callback: (child: ESTree.Node) => void): void {
	const stack = [node];
	while (stack.length > 0) {
		const current = stack.pop();
		if (current === undefined) break;
		callback(current);

		for (const key in current) {
			if (isKeyOfNode(key)) continue;

			const value: unknown = Reflect.get(current, key);
			if (typeof value !== "object" || value === null) continue;

			if (value === current.parent) continue;

			if (Array.isArray(value)) {
				for (let index = value.length - 1; index >= 0; index -= 1) {
					const item = value[index];
					// oxlint-disable-next-line max-depth
					if (isNode(item)) stack.push(item);
				}
				continue;
			}

			if (isNode(value)) stack.push(value);
		}
	}
}
