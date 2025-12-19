import { DefinitionType } from "@typescript-eslint/scope-manager";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";

type MessageIds = "identityBindingMap" | "identityArrayMap";

export interface NoIdentityMapOptions {
	readonly bindingPatterns?: ReadonlyArray<string>;
}

type Options = [NoIdentityMapOptions?];

const DEFAULT_BINDING_PATTERNS: ReadonlyArray<string> = ["binding"];

/**
 * Gets the name of a simple parameter (Identifier or AssignmentPattern with Identifier left).
 * Returns undefined for destructuring or rest patterns.
 * @param param - The parameter node to extract the name from
 * @returns The parameter name or undefined if not a simple identifier
 */
function getParameterName(param: TSESTree.Parameter): string | undefined {
	if (param.type === AST_NODE_TYPES.Identifier) return param.name;

	// Handle default parameter: (x = defaultValue) => x
	if (param.type === AST_NODE_TYPES.AssignmentPattern && param.left.type === AST_NODE_TYPES.Identifier) {
		return param.left.name;
	}
	return undefined;
}

/**
 * Checks if a block body contains only a single return statement that returns the given identifier.
 * @param body - The block statement to check
 * @param paramName - The parameter name to match against the return value
 * @returns True if the block only returns the parameter unchanged
 */
function isBlockReturningIdentity(body: TSESTree.BlockStatement, paramName: string): boolean {
	if (body.body.length !== 1) return false;
	const [statement] = body.body;
	if (statement?.type !== AST_NODE_TYPES.ReturnStatement) return false;
	if (!statement.argument) return false;
	if (statement.argument.type !== AST_NODE_TYPES.Identifier) return false;
	return statement.argument.name === paramName;
}

/**
 * Checks if an expression is an identity callback (returns its single parameter unchanged).
 *
 * Matches:
 * - Arrow expression: `v => v`, `(v) => v`, `(v: T) => v`
 * - Arrow block: `v => { return v; }`
 * - Function expression: `function(v) { return v; }`
 *
 * @param callback - The callback expression to check
 * @returns True if the callback is an identity function
 */
function isIdentityCallback(callback: TSESTree.Expression): boolean {
	// Arrow function
	if (callback.type === AST_NODE_TYPES.ArrowFunctionExpression) {
		if (callback.params.length !== 1) return false;
		const [param] = callback.params;
		if (param === undefined) return false;
		const paramName = getParameterName(param);
		if (paramName === undefined || paramName === "") return false;

		// Expression body: v => v
		if (callback.body.type === AST_NODE_TYPES.Identifier) {
			return callback.body.name === paramName;
		}

		// Block body: v => { return v; }
		if (callback.body.type === AST_NODE_TYPES.BlockStatement) {
			return isBlockReturningIdentity(callback.body, paramName);
		}
		return false;
	}

	// Function expression
	if (callback.type === AST_NODE_TYPES.FunctionExpression) {
		if (callback.params.length !== 1) return false;
		const [param] = callback.params;
		if (param === undefined) return false;
		const paramName = getParameterName(param);
		if (paramName === undefined || paramName === "") return false;
		return isBlockReturningIdentity(callback.body, paramName);
	}

	return false;
}

/**
 * Finds a variable in the current or parent scopes.
 * @param context - The rule context
 * @param identifier - The identifier to find
 * @returns The variable definition or undefined if not found
 */
function findVariable(
	context: TSESLint.RuleContext<MessageIds, Options>,
	identifier: TSESTree.Identifier,
): TSESLint.Scope.Variable | undefined {
	let scope = context.sourceCode.getScope(identifier) as TSESLint.Scope.Scope | undefined;
	while (scope) {
		const variable = scope.set.get(identifier.name);
		if (variable) return variable;
		scope = scope.upper ?? undefined;
	}
	return undefined;
}

/**
 * Gets the hook name from a call expression (e.g., "useBinding" from `useBinding(0)`).
 * @param node - The call expression
 * @returns The hook name or undefined if not an identifier or member expression
 */
function getHookName(node: TSESTree.CallExpression): string | undefined {
	const { callee } = node;
	if (callee.type === AST_NODE_TYPES.Identifier) {
		return callee.name;
	}
	if (callee.type === AST_NODE_TYPES.MemberExpression && callee.property.type === AST_NODE_TYPES.Identifier) {
		return callee.property.name;
	}
	return undefined;
}

/**
 * Checks if a call expression is `React.joinBindings()` or `joinBindings()`.
 * @param node - The call expression to check
 * @returns True if the call is to joinBindings
 */
function isJoinBindingsCall(node: TSESTree.CallExpression): boolean {
	const { callee } = node;
	if (callee.type === AST_NODE_TYPES.Identifier) {
		return callee.name === "joinBindings";
	}
	if (callee.type === AST_NODE_TYPES.MemberExpression && callee.property.type === AST_NODE_TYPES.Identifier) {
		return callee.property.name === "joinBindings";
	}
	return false;
}

/**
 * Checks if a variable was initialized from a Binding-producing expression.
 * @param variable - The variable to check
 * @returns True if the variable is likely a Binding
 */
function isBindingInitialization(variable: TSESLint.Scope.Variable): boolean {
	for (const def of variable.defs) {
		if (def.type !== DefinitionType.Variable) continue;
		const { init } = def.node;
		if (!init || init.type !== AST_NODE_TYPES.CallExpression) continue;

		const hookName = getHookName(init);
		if (hookName === "useBinding") return true;
		if (isJoinBindingsCall(init)) return true;

		// Result of .map() is likely a Binding if it's chained
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

/**
 * Determines if the callee object is likely a Binding based on heuristics.
 * @param context - The rule context
 * @param callee - The member expression being called
 * @param patterns - Patterns to match against variable names
 * @returns True if the object is likely a Binding
 */
function isLikelyBinding(
	context: TSESLint.RuleContext<MessageIds, Options>,
	callee: TSESTree.MemberExpression,
	patterns: ReadonlyArray<string>,
): boolean {
	const { object } = callee;

	// Check identifier-based heuristics
	if (object.type === AST_NODE_TYPES.Identifier) {
		const lowerName = object.name.toLowerCase();
		for (const pattern of patterns) {
			if (lowerName.includes(pattern.toLowerCase())) return true;
		}

		const variable = findVariable(context, object);
		if (variable && isBindingInitialization(variable)) return true;
	}

	// Chained .map() calls - the result of .map() on a Binding is also a Binding
	if (
		object.type === AST_NODE_TYPES.CallExpression &&
		object.callee.type === AST_NODE_TYPES.MemberExpression &&
		object.callee.property.type === AST_NODE_TYPES.Identifier &&
		object.callee.property.name === "map"
	) {
		return true;
	}

	// React.joinBindings() result
	if (object.type === AST_NODE_TYPES.CallExpression && isJoinBindingsCall(object)) {
		return true;
	}

	return false;
}

const noIdentityMap: TSESLint.RuleModuleWithMetaDocs<MessageIds, Options> = {
	create(context) {
		const [rawOptions] = context.options;
		const patterns = rawOptions?.bindingPatterns ?? DEFAULT_BINDING_PATTERNS;

		return {
			CallExpression(node) {
				const { callee } = node;

				// Must be a method call: x.map(...)
				if (callee.type !== AST_NODE_TYPES.MemberExpression) return;

				// Must be .map() call (not computed like x["map"])
				if (callee.computed) return;
				if (callee.property.type !== AST_NODE_TYPES.Identifier) return;
				if (callee.property.name !== "map") return;

				// Must have exactly one argument
				if (node.arguments.length !== 1) return;
				const [callback] = node.arguments;
				if (!callback || callback.type === AST_NODE_TYPES.SpreadElement) return;

				// Check if callback is identity function
				if (!isIdentityCallback(callback)) return;

				// Determine message based on whether it's likely a Binding
				const isBinding = isLikelyBinding(context, callee, patterns);

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
};

export default noIdentityMap;
