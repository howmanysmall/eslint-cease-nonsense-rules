import { DefinitionType } from "@typescript-eslint/scope-manager";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utilities/create-rule";

type MessageIds = "identityBindingMap" | "identityArrayMap";

export interface NoIdentityMapOptions {
	readonly bindingPatterns?: ReadonlyArray<string>;
}

type Options = [NoIdentityMapOptions?];

const DEFAULT_BINDING_PATTERNS: ReadonlyArray<string> = ["binding"];

function getParameterName(param: TSESTree.Parameter): string | undefined {
	if (param.type === AST_NODE_TYPES.Identifier) return param.name;
	if (param.type === AST_NODE_TYPES.AssignmentPattern && param.left.type === AST_NODE_TYPES.Identifier) {
		return param.left.name;
	}
	return undefined;
}

function isBlockReturningIdentity(body: TSESTree.BlockStatement, paramName: string): boolean {
	if (body.body.length !== 1) return false;
	const [statement] = body.body;
	if (statement?.type !== AST_NODE_TYPES.ReturnStatement) return false;
	if (!statement.argument) return false;
	if (statement.argument.type !== AST_NODE_TYPES.Identifier) return false;
	return statement.argument.name === paramName;
}

function isIdentityCallback(callback: TSESTree.Expression): boolean {
	let isIdentity = false;

	if (callback.type === AST_NODE_TYPES.ArrowFunctionExpression && callback.params.length === 1) {
		const [parameter] = callback.params;
		if (parameter !== undefined) {
			const name = getParameterName(parameter);
			if (name !== undefined) {
				const { body } = callback;
				if (body.type === AST_NODE_TYPES.Identifier) isIdentity = body.name === name;
				if (body.type === AST_NODE_TYPES.BlockStatement) isIdentity = isBlockReturningIdentity(body, name);
			}
		}
	}

	if (callback.type === AST_NODE_TYPES.FunctionExpression && callback.params.length === 1) {
		const [parameter] = callback.params;
		if (parameter !== undefined) {
			const name = getParameterName(parameter);
			if (name !== undefined) isIdentity = isBlockReturningIdentity(callback.body, name);
		}
	}

	return isIdentity;
}

function findVariable(
	context: TSESLint.RuleContext<MessageIds, Options>,
	identifier: TSESTree.Identifier,
): TSESLint.Scope.Variable | undefined {
	let scope = context.sourceCode.getScope(identifier) as TSESLint.Scope.Scope | undefined;
	while (scope) {
		const variable = scope.set.get(identifier.name);
		if (variable !== undefined) return variable;
		scope = scope.upper ?? undefined;
	}
	return undefined;
}

function getHookName(node: TSESTree.CallExpression): string | undefined {
	const { callee } = node;
	if (callee.type === AST_NODE_TYPES.Identifier) return callee.name;
	if (callee.type === AST_NODE_TYPES.MemberExpression && callee.property.type === AST_NODE_TYPES.Identifier) {
		return callee.property.name;
	}
	return undefined;
}

function isJoinBindingsCall(node: TSESTree.CallExpression): boolean {
	const { callee } = node;
	if (callee.type === AST_NODE_TYPES.Identifier) return callee.name === "joinBindings";
	if (callee.type === AST_NODE_TYPES.MemberExpression && callee.property.type === AST_NODE_TYPES.Identifier) {
		return callee.property.name === "joinBindings";
	}
	return false;
}

function isBindingInitialization(variable: TSESLint.Scope.Variable): boolean {
	for (const def of variable.defs) {
		if (def.type !== DefinitionType.Variable) continue;
		const { init } = def.node;
		if (!init || init.type !== AST_NODE_TYPES.CallExpression) continue;

		const hookName = getHookName(init);
		if (hookName === "useBinding" || isJoinBindingsCall(init)) return true;

		if (
			init.callee.type === AST_NODE_TYPES.MemberExpression &&
			init.callee.property.type === AST_NODE_TYPES.Identifier &&
			init.callee.property.name === "map"
		) {
			return true;
		}
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

		const variable = findVariable(context, object);
		if (variable !== undefined && isBindingInitialization(variable)) return true;
	}

	if (
		object.type === AST_NODE_TYPES.CallExpression &&
		object.callee.type === AST_NODE_TYPES.MemberExpression &&
		object.callee.property.type === AST_NODE_TYPES.Identifier &&
		object.callee.property.name === "map"
	) {
		return true;
	}

	return object.type === AST_NODE_TYPES.CallExpression && isJoinBindingsCall(object);
}

export default createRule<Options, MessageIds>({
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
					node: node,
				});
			},
		};
	},
	defaultOptions: [{}],
	meta: {
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
