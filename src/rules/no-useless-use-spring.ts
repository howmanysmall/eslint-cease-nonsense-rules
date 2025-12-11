import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { DefinitionType, ScopeType } from "@typescript-eslint/scope-manager";

type MessageIds = "uselessSpring";

export interface NoUselessUseSpringOptions {
	readonly springHooks?: ReadonlyArray<string>;
	readonly treatEmptyDepsAsViolation?: boolean;
}

type Options = [NoUselessUseSpringOptions?];

interface NormalizedOptions {
	readonly springHooks: ReadonlySet<string>;
	readonly treatEmptyDepsAsViolation: boolean;
}

const DEFAULT_OPTION_VALUES: Required<NoUselessUseSpringOptions> = {
	springHooks: ["useSpring"],
	treatEmptyDepsAsViolation: true,
};

const STATIC_UNARY_OPERATORS = new Set(["-", "+", "!", "~", "typeof", "void", "delete"]);

enum DepsKind {
	MissingOrOmitted = 0,
	EmptyArray = 1,
	StaticArray = 2,
	DynamicOrUnknown = 3,
}

function unwrapExpression(expression: TSESTree.Expression): TSESTree.Expression {
	let current = expression;
	while (true) {
		if (current.type === AST_NODE_TYPES.TSAsExpression) {
			current = current.expression;
			continue;
		}
		if (current.type === AST_NODE_TYPES.TSTypeAssertion) {
			current = current.expression;
			continue;
		}
		if (current.type === AST_NODE_TYPES.TSNonNullExpression) {
			current = current.expression;
			continue;
		}
		if (current.type === AST_NODE_TYPES.ChainExpression) {
			current = current.expression;
			continue;
		}

		return current;
	}
}

function findVariable(
	context: TSESLint.RuleContext<MessageIds, Options>,
	identifier: TSESTree.Identifier,
	// eslint's type definitions for Scope differ from @typescript-eslint's; cast for compatibility
): TSESLint.Scope.Variable | undefined {
	let scope = context.sourceCode.getScope(identifier) as TSESLint.Scope.Scope | undefined;
	while (scope) {
		const variable = scope.set.get(identifier.name);
		if (variable) return variable;
		scope = scope.upper ?? undefined;
	}

	return undefined;
}

function isModuleLevelScope(scope: TSESLint.Scope.Scope): boolean {
	return scope.type === ScopeType.module || scope.type === ScopeType.global;
}

function isImport(variable: TSESLint.Scope.Variable): boolean {
	for (const definition of variable.defs) if (definition.type === DefinitionType.ImportBinding) return true;
	return false;
}

function getConstInitializer(definition: TSESLint.Scope.Definition | undefined): TSESTree.Expression | undefined {
	if (definition === undefined || definition.type !== DefinitionType.Variable) return undefined;
	const declarator = definition.node;

	if (declarator.type !== AST_NODE_TYPES.VariableDeclarator) return undefined;
	const declaration = definition.parent;

	if (declaration?.type !== AST_NODE_TYPES.VariableDeclaration) return undefined;
	if (declaration.kind !== "const") return undefined;
	return declarator.init ?? undefined;
}

function isStaticIdentifier(
	context: TSESLint.RuleContext<MessageIds, Options>,
	identifier: TSESTree.Identifier,
	seen: Set<TSESTree.Node>,
): boolean {
	const variable = findVariable(context, identifier);
	if (variable === undefined) return false;
	if (!isModuleLevelScope(variable.scope)) return false;
	if (isImport(variable)) return true;

	for (const definition of variable.defs) {
		const initializer = getConstInitializer(definition);
		if (initializer === undefined) continue;
		if (isStaticExpression(context, initializer, seen)) return true;
	}

	return false;
}

function isStaticMemberProperty(
	property: TSESTree.Expression | TSESTree.PrivateIdentifier,
	seen: Set<TSESTree.Node>,
): boolean {
	if (property.type === AST_NODE_TYPES.PrivateIdentifier) return false;
	if (property.type === AST_NODE_TYPES.Identifier) return true;
	return isStaticExpressionInner(property, seen);
}

function isStaticCallCallee(
	context: TSESLint.RuleContext<MessageIds, Options>,
	callee: TSESTree.Expression,
	seen: Set<TSESTree.Node>,
): boolean {
	const unwrapped = unwrapExpression(callee);
	if (unwrapped.type === AST_NODE_TYPES.Identifier) return isStaticIdentifier(context, unwrapped, seen);
	if (unwrapped.type === AST_NODE_TYPES.MemberExpression) {
		if (!isStaticExpression(context, unwrapped.object, seen)) return false;
		if (unwrapped.computed) return isStaticMemberProperty(unwrapped.property, seen);
		return unwrapped.property.type === AST_NODE_TYPES.Identifier;
	}

	return false;
}

function isStaticObjectExpression(
	context: TSESLint.RuleContext<MessageIds, Options>,
	objectExpr: TSESTree.ObjectExpression,
	seen: Set<TSESTree.Node>,
): boolean {
	for (const property of objectExpr.properties) {
		if (property.type !== AST_NODE_TYPES.Property) return false;
		if (property.kind !== "init") return false;
		if (property.computed && !isStaticExpressionInner(property.key, seen)) return false;
		const value = property.value;
		if (!isNonPatternExpression(value)) return false;
		if (!isStaticExpression(context, value, seen)) return false;
	}

	return true;
}

function isNonPatternExpression(
	value:
		| TSESTree.Expression
		| TSESTree.PrivateIdentifier
		| TSESTree.ArrayPattern
		| TSESTree.ObjectPattern
		| TSESTree.RestElement
		| TSESTree.AssignmentPattern,
): value is TSESTree.Expression {
	return (
		value.type !== AST_NODE_TYPES.AssignmentPattern &&
		value.type !== AST_NODE_TYPES.ArrayPattern &&
		value.type !== AST_NODE_TYPES.ObjectPattern &&
		value.type !== AST_NODE_TYPES.RestElement
	);
}

function isStaticObjectLikeConfig(
	context: TSESLint.RuleContext<MessageIds, Options>,
	expression: TSESTree.Expression,
	seen: Set<TSESTree.Node>,
): boolean {
	const unwrapped = unwrapExpression(expression);
	if (unwrapped.type === AST_NODE_TYPES.ObjectExpression) return isStaticObjectExpression(context, unwrapped, seen);

	if (unwrapped.type === AST_NODE_TYPES.Identifier) {
		const variable = findVariable(context, unwrapped);
		if (variable === undefined) return false;
		if (!isModuleLevelScope(variable.scope)) return false;
		if (isImport(variable)) return false;

		for (const def of variable.defs) {
			const initializer = getConstInitializer(def);
			if (initializer === undefined) continue;
			const normalizedInitializer = unwrapExpression(initializer);
			if (normalizedInitializer.type !== AST_NODE_TYPES.ObjectExpression) continue;
			if (isStaticObjectExpression(context, normalizedInitializer, seen)) return true;
		}
	}

	return false;
}

function isStaticArrayExpression(
	context: TSESLint.RuleContext<MessageIds, Options>,
	arrayExpr: TSESTree.ArrayExpression,
	seen: Set<TSESTree.Node>,
): boolean {
	for (const element of arrayExpr.elements) {
		if (!element) continue;
		if (element.type === AST_NODE_TYPES.SpreadElement) return false;
		if (!isStaticExpression(context, element, seen)) return false;
	}

	return true;
}

function isStaticExpressionInner(node: TSESTree.Expression, seen: Set<TSESTree.Node>): boolean {
	return isStaticExpression(undefined, node, seen);
}

// eslint-disable-next-line typescript-eslint/switch-exhaustiveness-check
function isStaticExpression(
	context: TSESLint.RuleContext<MessageIds, Options> | undefined,
	expression: TSESTree.Expression,
	seen: Set<TSESTree.Node> = new Set(),
): boolean {
	const unwrapped = unwrapExpression(expression);
	if (seen.has(unwrapped)) return true;
	seen.add(unwrapped);

	// eslint-disable-next-line typescript-eslint/switch-exhaustiveness-check
	switch (unwrapped.type) {
		case AST_NODE_TYPES.Literal:
			return true;

		case AST_NODE_TYPES.TemplateLiteral:
			return unwrapped.expressions.length === 0;

		case AST_NODE_TYPES.UnaryExpression:
			return (
				STATIC_UNARY_OPERATORS.has(unwrapped.operator) && isStaticExpression(context, unwrapped.argument, seen)
			);

		case AST_NODE_TYPES.BinaryExpression:
		case AST_NODE_TYPES.LogicalExpression:
			return isStaticExpression(context, unwrapped.left, seen) && isStaticExpression(context, unwrapped.right, seen);

		case AST_NODE_TYPES.ConditionalExpression:
			return (
				isStaticExpression(context, unwrapped.test, seen) &&
				isStaticExpression(context, unwrapped.consequent, seen) &&
				isStaticExpression(context, unwrapped.alternate, seen)
			);

		case AST_NODE_TYPES.ArrayExpression:
			return context !== undefined && isStaticArrayExpression(context, unwrapped, seen);

		case AST_NODE_TYPES.ObjectExpression:
			return context !== undefined && isStaticObjectExpression(context, unwrapped, seen);

		case AST_NODE_TYPES.Identifier:
			return context !== undefined && isStaticIdentifier(context, unwrapped, seen);

		case AST_NODE_TYPES.MemberExpression:
			return (
				isStaticExpression(context, unwrapped.object, seen) &&
				(!unwrapped.computed || isStaticMemberProperty(unwrapped.property, seen))
			);

		case AST_NODE_TYPES.ChainExpression:
			return isStaticExpression(context, unwrapped.expression, seen);

		case AST_NODE_TYPES.CallExpression:
			return (
				context !== undefined &&
				isStaticCallCallee(context, unwrapped.callee, seen) &&
				unwrapped.arguments.every(
					(arg) => arg.type !== AST_NODE_TYPES.SpreadElement && isStaticExpression(context, arg, seen),
				)
			);

		case AST_NODE_TYPES.NewExpression:
			return (
				context !== undefined &&
				isStaticCallCallee(context, unwrapped.callee, seen) &&
				(unwrapped.arguments ?? []).every(
					(arg) => arg.type !== AST_NODE_TYPES.SpreadElement && isStaticExpression(context, arg, seen),
				)
			);

		case AST_NODE_TYPES.SequenceExpression:
			return (
				unwrapped.expressions.length > 0 &&
				unwrapped.expressions.every((expr) => isStaticExpression(context, expr, seen))
			);

		case AST_NODE_TYPES.AssignmentExpression:
			return isStaticExpression(context, unwrapped.right, seen);

		default:
			return false;
	}
}

function classifyDependencies(
	context: TSESLint.RuleContext<MessageIds, Options>,
	argument: TSESTree.CallExpressionArgument | undefined,
	seen: Set<TSESTree.Node>,
): DepsKind {
	if (argument === undefined) return DepsKind.MissingOrOmitted;
	if (argument.type === AST_NODE_TYPES.SpreadElement) return DepsKind.DynamicOrUnknown;

	const expr = unwrapExpression(argument);
	if (expr.type !== AST_NODE_TYPES.ArrayExpression) return DepsKind.DynamicOrUnknown;

	if (expr.elements.length === 0) return DepsKind.EmptyArray;

	if (isStaticArrayExpression(context, expr, seen)) return DepsKind.StaticArray;

	return DepsKind.DynamicOrUnknown;
}

function depsAreNonUpdating(kind: DepsKind, options: NormalizedOptions): boolean {
	if (kind === DepsKind.MissingOrOmitted || kind === DepsKind.StaticArray) return true;
	if (kind === DepsKind.EmptyArray) return options.treatEmptyDepsAsViolation;
	return false;
}

function isSpringHookCall(node: TSESTree.CallExpression, options: NormalizedOptions): boolean {
	return node.callee.type === AST_NODE_TYPES.Identifier && options.springHooks.has(node.callee.name);
}

const noUselessUseSpring: TSESLint.RuleModuleWithMetaDocs<MessageIds, Options> = {
	create(context) {
		const rawOptions = context.options[0];
		const normalized: NormalizedOptions = {
			...DEFAULT_OPTION_VALUES,
			...rawOptions,
			springHooks: new Set(rawOptions?.springHooks ?? DEFAULT_OPTION_VALUES.springHooks),
		};

		return {
			CallExpression(node) {
				if (!isSpringHookCall(node, normalized)) return;
				if (node.arguments.length === 0) return;

				const configArgument = node.arguments[0];
				if (!configArgument) return;
				if (configArgument.type === AST_NODE_TYPES.SpreadElement) return;

				const seen = new Set<TSESTree.Node>();
				if (!isStaticObjectLikeConfig(context, configArgument, seen)) return;

				const depsKind = classifyDependencies(context, node.arguments[1], seen);
				if (!depsAreNonUpdating(depsKind, normalized)) return;

				context.report({
					messageId: "uselessSpring",
					node,
				});
			},
		};
	},
	defaultOptions: [DEFAULT_OPTION_VALUES],
	meta: {
		docs: {
			description: "Disallow useSpring hooks whose config and dependencies are entirely static",
		},
		messages: {
			uselessSpring:
				"useSpring call has only static inputs and non-updating dependencies; replace it with a constant or remove the hook.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					springHooks: {
						description: "Hook identifiers that should be treated as spring hooks",
						items: { type: "string" },
						type: "array",
					},
					treatEmptyDepsAsViolation: {
						default: true,
						description: "Treat static config with an empty dependency array as a violation",
						type: "boolean",
					},
				},
				type: "object",
			},
		],
		type: "suggestion",
	},
};

export default noUselessUseSpring;
