import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utilities/create-rule";

const MAX_RETURN_ELEMENTS = 2;

const HOOK_PATTERN = /^use[A-Z0-9].*$/;

type FunctionNode = TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression;

function isHookNode(node: FunctionNode | TSESTree.VariableDeclarator): boolean {
	let name: string | undefined;

	if (node.type === AST_NODE_TYPES.VariableDeclarator && node.id.type === AST_NODE_TYPES.Identifier) {
		({ name } = node.id);
	} else if (node.type === AST_NODE_TYPES.FunctionDeclaration && node.id) ({ name } = node.id);
	else if (node.type === AST_NODE_TYPES.FunctionExpression && node.id) ({ name } = node.id);

	return name !== undefined && HOOK_PATTERN.test(name);
}

function getVariableByName(scope: TSESLint.Scope.Scope, name: string): TSESLint.Scope.Variable | undefined {
	let current: TSESLint.Scope.Scope | null = scope;
	while (current) {
		const variable = current.set.get(name);
		if (variable) return variable;
		current = current.upper;
	}
	return undefined;
}

function getArrayElementsFromVariable(
	scope: TSESLint.Scope.Scope,
	name: string,
): ReadonlyArray<TSESTree.Expression | TSESTree.SpreadElement | null> {
	const variable = getVariableByName(scope, name);
	if (!variable) return [];

	const elements = new Array<TSESTree.Expression | TSESTree.SpreadElement | null>();

	for (const ref of variable.references) {
		const { identifier } = ref;
		if (!identifier.parent) continue;

		const { parent } = identifier;
		if (parent.type !== AST_NODE_TYPES.VariableDeclarator) continue;
		if (!parent.init || parent.init.type !== AST_NODE_TYPES.ArrayExpression) continue;

		elements.push(...parent.init.elements);
	}

	return elements;
}

function countReturnElements(argument: TSESTree.Expression, scope: TSESLint.Scope.Scope): number {
	if (argument.type === AST_NODE_TYPES.Identifier) return getArrayElementsFromVariable(scope, argument.name).length;
	if (argument.type !== AST_NODE_TYPES.ArrayExpression) return 0;

	let count = 0;
	for (const element of argument.elements) {
		if (element === null) count += 1;
		else if (element.type === AST_NODE_TYPES.SpreadElement) {
			if (element.argument.type === AST_NODE_TYPES.Identifier) {
				count += getArrayElementsFromVariable(scope, element.argument.name).length;
			} else if (element.argument.type === AST_NODE_TYPES.ArrayExpression) {
				count += element.argument.elements.length;
			} else count += 1;
		} else count += 1;
	}

	return count;
}

function exceedsMaxReturnProperties(node: TSESTree.ReturnStatement, scope: TSESLint.Scope.Scope): boolean {
	const { argument } = node;
	if (argument === null) return false;

	if (argument.type === AST_NODE_TYPES.ObjectExpression) return false;

	if (argument.type === AST_NODE_TYPES.Identifier) {
		const variable = getVariableByName(scope, argument.name);
		if (variable) {
			for (const { identifier } of variable.references) {
				const { parent } = identifier;
				if (
					parent?.type === AST_NODE_TYPES.VariableDeclarator &&
					parent.init?.type === AST_NODE_TYPES.ObjectExpression
				) {
					return false;
				}
			}
		}
	}

	return countReturnElements(argument, scope) > MAX_RETURN_ELEMENTS;
}

export default createRule({
	create(context) {
		let hookDepth = 0;

		function enterHook(node: FunctionNode | TSESTree.VariableDeclarator): void {
			if (isHookNode(node)) hookDepth += 1;
		}

		function exitHook(node: FunctionNode | TSESTree.VariableDeclarator): void {
			if (isHookNode(node)) hookDepth -= 1;
		}

		return {
			ArrowFunctionExpression(node): void {
				const { parent } = node;
				if (
					parent?.type === AST_NODE_TYPES.VariableDeclarator &&
					parent.id.type === AST_NODE_TYPES.Identifier &&
					HOOK_PATTERN.test(parent.id.name)
				) {
					hookDepth += 1;
				}
			},
			"ArrowFunctionExpression:exit"(node: TSESTree.ArrowFunctionExpression): void {
				const { parent } = node;
				if (
					parent?.type === AST_NODE_TYPES.VariableDeclarator &&
					parent.id.type === AST_NODE_TYPES.Identifier &&
					HOOK_PATTERN.test(parent.id.name)
				) {
					hookDepth -= 1;
				}
			},
			FunctionDeclaration: enterHook,
			"FunctionDeclaration:exit": exitHook,
			FunctionExpression: enterHook,
			"FunctionExpression:exit": exitHook,
			ReturnStatement(node: TSESTree.ReturnStatement): void {
				if (hookDepth === 0) return;

				const scope = context.sourceCode.getScope(node);
				if (exceedsMaxReturnProperties(node, scope)) {
					context.report({
						messageId: "hooksStrictReturn",
						node,
					});
				}
			},
			VariableDeclarator: enterHook,
			"VariableDeclarator:exit": exitHook,
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description: "Restrict the number of returned items from React hooks.",
		},
		messages: {
			hooksStrictReturn: "React hooks must return a tuple of two or fewer values or a single object.",
		},
		schema: [],
		type: "suggestion",
	},
	name: "react-hooks-strict-return",
});
