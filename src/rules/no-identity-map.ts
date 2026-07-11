import { getCallExpressionName, getCalleeName } from "$utilities/ast-utilities";
import { createRule } from "$utilities/create-rule";
import { isVariableDefinition } from "$utilities/scope-utilities";
import { findVariableInScope } from "$utilities/static-expression-utilities";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";

import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

type MessageIds = "identityBindingMap" | "identityArrayMap";

export interface NoIdentityMapOptions {
	readonly bindingPatterns?: ReadonlyArray<string>;
}

type Options = [NoIdentityMapOptions?];

const DEFAULT_BINDING_PATTERNS: ReadonlyArray<string> = ["binding"];

function getParameterName(parameter: TSESTree.Parameter): string | undefined {
	if (parameter.type === AST_NODE_TYPES.Identifier) return parameter.name;
	if (parameter.type === AST_NODE_TYPES.AssignmentPattern && parameter.left.type === AST_NODE_TYPES.Identifier) {
		return parameter.left.name;
	}
	return undefined;
}

function isBlockReturningIdentity(body: TSESTree.BlockStatement, parameterName: string): boolean {
	if (body.body.length !== 1) return false;
	const [statement] = body.body;
	if (statement?.type !== AST_NODE_TYPES.ReturnStatement) return false;
	if (!statement.argument) return false;
	if (statement.argument.type !== AST_NODE_TYPES.Identifier) return false;
	return statement.argument.name === parameterName;
}

function getSingleParameterName(parameters: ReadonlyArray<TSESTree.Parameter>): string | undefined {
	let parameterCount = 0;
	let parameterName: string | undefined;

	for (const parameter of parameters) {
		parameterCount += 1;
		if (parameterCount > 1) return undefined;
		parameterName = getParameterName(parameter);
	}

	return parameterName;
}

function isArrowIdentityCallback(callback: TSESTree.ArrowFunctionExpression): boolean {
	const name = getSingleParameterName(callback.params);
	if (name === undefined) return false;

	const { body } = callback;
	if (body.type === AST_NODE_TYPES.Identifier) return body.name === name;
	if (body.type === AST_NODE_TYPES.BlockStatement) return isBlockReturningIdentity(body, name);
	return false;
}

function isFunctionIdentityCallback(callback: TSESTree.FunctionExpression): boolean {
	const name = getSingleParameterName(callback.params);
	return name !== undefined && isBlockReturningIdentity(callback.body, name);
}

function isIdentityCallback(callback: TSESTree.Expression): boolean {
	if (callback.type === AST_NODE_TYPES.ArrowFunctionExpression) return isArrowIdentityCallback(callback);
	if (callback.type === AST_NODE_TYPES.FunctionExpression) return isFunctionIdentityCallback(callback);

	return false;
}

function isJoinBindingsCall(node: TSESTree.CallExpression): boolean {
	return getCallExpressionName(node) === "joinBindings";
}

function isBindingInitialization(variable: TSESLint.Scope.Variable): boolean {
	for (const definition of variable.defs) {
		if (!isVariableDefinition(definition)) continue;
		const { init } = definition.node;
		if (!init || init.type !== AST_NODE_TYPES.CallExpression) continue;

		const hookName = getCallExpressionName(init);
		if (hookName === "useBinding" || isJoinBindingsCall(init)) return true;

		if (init.callee.type === AST_NODE_TYPES.MemberExpression && getCalleeName(init.callee) === "map") return true;
	}
	return false;
}

function isLikelyBinding(
	context: TSESLint.RuleContext<MessageIds, Options>,
	callee: TSESTree.MemberExpression,
	patterns: ReadonlyArray<string>,
): boolean {
	const { object } = callee;

	if (object.type === AST_NODE_TYPES.Identifier) {
		const lowerName = object.name.toLowerCase();
		for (const pattern of patterns) if (lowerName.includes(pattern.toLowerCase())) return true;

		const variable = findVariableInScope(context.sourceCode, object);
		if (variable !== undefined && isBindingInitialization(variable)) return true;
	}

	if (
		object.type === AST_NODE_TYPES.CallExpression &&
		object.callee.type === AST_NODE_TYPES.MemberExpression &&
		getCalleeName(object.callee) === "map"
	) {
		return true;
	}

	return object.type === AST_NODE_TYPES.CallExpression && isJoinBindingsCall(object);
}

const noIdentityMap = createRule<Options, MessageIds>({
	create(context) {
		const [{ bindingPatterns = DEFAULT_BINDING_PATTERNS } = {}] = context.options;

		return {
			CallExpression(node): void {
				const { callee } = node;

				if (callee.type !== AST_NODE_TYPES.MemberExpression) return;

				if (callee.computed) return;
				if (callee.property.type !== AST_NODE_TYPES.Identifier) return;
				if (callee.property.name !== "map") return;

				if (node.arguments.length !== 1) return;
				const [callback] = node.arguments;
				if (!callback || callback.type === AST_NODE_TYPES.SpreadElement) return;

				if (!isIdentityCallback(callback)) return;

				const isBinding = isLikelyBinding(context, callee, bindingPatterns);

				context.report({
					fix(fixer) {
						const objectText = context.sourceCode.getText(callee.object);
						return fixer.replaceText(node, objectText);
					},
					messageId: isBinding ? "identityBindingMap" : "identityArrayMap",
					node,
				});
			},
		};
	},
	meta: {
		defaultOptions: [{}],
		docs: {
			description: "Disallow pointless identity `.map()` calls that return the parameter unchanged",
		},
		fixable: "code",
		messages: {
			identityArrayMap:
				"Pointless identity `.map()` call on Array. Use `table.clone(array)` or `[...array]` instead.",
			identityBindingMap: "Pointless identity `.map()` call on Binding. Use the original binding directly.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					bindingPatterns: {
						default: [...DEFAULT_BINDING_PATTERNS],
						description: "Variable name patterns to recognize as Bindings (case insensitive)",
						items: { type: "string" },
						type: "array",
					},
				},
				type: "object",
			},
		],
		type: "suggestion",
	},
	name: "no-identity-map",
});

export default noIdentityMap;
