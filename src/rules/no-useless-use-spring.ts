import { DefinitionType, ScopeType } from "@typescript-eslint/scope-manager";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";

type MessageIds = "uselessSpring";

export interface NoUselessUseSpringOptions {
	readonly springHooks?: ReadonlyArray<string>;
	readonly staticGlobalFactories?: ReadonlyArray<string>;
	readonly treatEmptyDepsAsViolation?: boolean;
}

type Options = [NoUselessUseSpringOptions?];

interface NormalizedOptions {
	readonly springHooks: ReadonlySet<string>;
	readonly staticGlobalFactories: ReadonlySet<string>;
	readonly treatEmptyDepsAsViolation: boolean;
}

export const DEFAULT_STATIC_GLOBAL_FACTORIES: ReadonlyArray<string> = [
	"Axes",
	"BrickColor",
	"CFrame",
	"Color3",
	"ColorSequence",
	"ColorSequenceKeypoint",
	"DateTime",
	"Faces",
	"NumberRange",
	"NumberSequence",
	"NumberSequenceKeypoint",
	"PathWaypoint",
	"PhysicalProperties",
	"Ray",
	"Rect",
	"Region3",
	"Region3int16",
	"TweenInfo",
	"UDim",
	"UDim2",
	"Vector2",
	"Vector3",
	"Vector3int16",
	"Vector3int32",
];

const DEFAULT_OPTION_VALUES: Required<NoUselessUseSpringOptions> = {
	springHooks: ["useSpring"],
	staticGlobalFactories: DEFAULT_STATIC_GLOBAL_FACTORIES,
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
		if (current.type === AST_NODE_TYPES.TSSatisfiesExpression) {
			current = current.expression;
			continue;
		}
		if (current.type === AST_NODE_TYPES.TSInstantiationExpression) {
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
	// Eslint's type definitions for Scope differ from @typescript-eslint's; cast for compatibility
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
	options: NormalizedOptions,
): boolean {
	const variable = findVariable(context, identifier);
	if (variable === undefined) return options.staticGlobalFactories.has(identifier.name);
	if (!isModuleLevelScope(variable.scope)) return false;
	if (isImport(variable)) return true;

	for (const definition of variable.defs) {
		const initializer = getConstInitializer(definition);
		if (initializer === undefined) continue;
		if (isStaticExpression(context, initializer, seen, options)) return true;
	}

	return false;
}

function isStaticMemberProperty(
	property: TSESTree.Expression | TSESTree.PrivateIdentifier,
	seen: Set<TSESTree.Node>,
	options: NormalizedOptions,
): boolean {
	if (property.type === AST_NODE_TYPES.PrivateIdentifier) return false;
	if (property.type === AST_NODE_TYPES.Identifier) return true;
	return isStaticExpressionInner(property, seen, options);
}

function isStaticCallCallee(
	context: TSESLint.RuleContext<MessageIds, Options>,
	callee: TSESTree.Expression,
	seen: Set<TSESTree.Node>,
	options: NormalizedOptions,
): boolean {
	const unwrapped = unwrapExpression(callee);
	if (unwrapped.type === AST_NODE_TYPES.Identifier) return isStaticIdentifier(context, unwrapped, seen, options);
	if (unwrapped.type === AST_NODE_TYPES.MemberExpression) {
		if (!isStaticExpression(context, unwrapped.object, seen, options)) return false;
		if (unwrapped.computed) return isStaticMemberProperty(unwrapped.property, seen, options);
		return unwrapped.property.type === AST_NODE_TYPES.Identifier;
	}

	return false;
}

function isStaticObjectExpression(
	context: TSESLint.RuleContext<MessageIds, Options>,
	objectExpr: TSESTree.ObjectExpression,
	seen: Set<TSESTree.Node>,
	options: NormalizedOptions,
): boolean {
	for (const property of objectExpr.properties) {
		if (property.type !== AST_NODE_TYPES.Property) return false;
		if (property.kind !== "init") return false;
		if (property.computed && !isStaticExpressionInner(property.key, seen, options)) return false;
		const { value } = property;
		if (!isNonPatternExpression(value)) return false;
		if (!isStaticExpression(context, value, seen, options)) return false;
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
		| TSESTree.AssignmentPattern
		| TSESTree.TSEmptyBodyFunctionExpression,
): value is TSESTree.Expression {
	return (
		value.type !== AST_NODE_TYPES.PrivateIdentifier &&
		value.type !== AST_NODE_TYPES.AssignmentPattern &&
		value.type !== AST_NODE_TYPES.ArrayPattern &&
		value.type !== AST_NODE_TYPES.ObjectPattern &&
		value.type !== AST_NODE_TYPES.RestElement &&
		value.type !== AST_NODE_TYPES.TSEmptyBodyFunctionExpression
	);
}

function isNonPrivateExpression(value: TSESTree.Expression | TSESTree.PrivateIdentifier): value is TSESTree.Expression {
	return value.type !== AST_NODE_TYPES.PrivateIdentifier;
}

function objectHasFromAndTo(objectExpr: TSESTree.ObjectExpression): boolean {
	let hasFrom = false;
	let hasTo = false;

	for (const property of objectExpr.properties) {
		if (property.type !== AST_NODE_TYPES.Property) continue;
		if (property.computed) continue;
		if (property.key.type !== AST_NODE_TYPES.Identifier) continue;

		if (property.key.name === "from") hasFrom = true;
		if (property.key.name === "to") hasTo = true;
		if (hasFrom && hasTo) return true;
	}

	return false;
}

function hasFromAndToProperties(
	context: TSESLint.RuleContext<MessageIds, Options>,
	expression: TSESTree.Expression,
): boolean {
	const unwrapped = unwrapExpression(expression);

	if (unwrapped.type === AST_NODE_TYPES.ObjectExpression) return objectHasFromAndTo(unwrapped);

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
			if (objectHasFromAndTo(normalizedInitializer)) return true;
		}
	}

	return false;
}

function isStaticObjectLikeConfig(
	context: TSESLint.RuleContext<MessageIds, Options>,
	expression: TSESTree.Expression,
	seen: Set<TSESTree.Node>,
	options: NormalizedOptions,
): boolean {
	const unwrapped = unwrapExpression(expression);
	if (unwrapped.type === AST_NODE_TYPES.ObjectExpression)
		return isStaticObjectExpression(context, unwrapped, seen, options);

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
			if (isStaticObjectExpression(context, normalizedInitializer, seen, options)) return true;
		}
	}

	return false;
}

function isStaticArrayExpression(
	context: TSESLint.RuleContext<MessageIds, Options>,
	arrayExpr: TSESTree.ArrayExpression,
	seen: Set<TSESTree.Node>,
	options: NormalizedOptions,
): boolean {
	for (const element of arrayExpr.elements) {
		if (!element) continue;
		if (element.type === AST_NODE_TYPES.SpreadElement) return false;
		if (!isStaticExpression(context, element, seen, options)) return false;
	}

	return true;
}

function isStaticExpressionInner(
	node: TSESTree.Expression,
	seen: Set<TSESTree.Node>,
	options: NormalizedOptions,
): boolean {
	return isStaticExpression(undefined, node, seen, options);
}

function isStaticExpression(
	context: TSESLint.RuleContext<MessageIds, Options> | undefined,
	expression: TSESTree.Expression,
	seen: Set<TSESTree.Node>,
	options: NormalizedOptions,
): boolean {
	const unwrapped = unwrapExpression(expression);
	if (seen.has(unwrapped)) return true;
	seen.add(unwrapped);

	switch (unwrapped.type) {
		case AST_NODE_TYPES.Literal:
			return true;

		case AST_NODE_TYPES.TemplateLiteral:
			return unwrapped.expressions.length === 0;

		case AST_NODE_TYPES.UnaryExpression:
			return (
				STATIC_UNARY_OPERATORS.has(unwrapped.operator) &&
				isStaticExpression(context, unwrapped.argument, seen, options)
			);

		case AST_NODE_TYPES.BinaryExpression:
		case AST_NODE_TYPES.LogicalExpression:
			if (!(isNonPrivateExpression(unwrapped.left) && isNonPrivateExpression(unwrapped.right))) return false;
			return (
				isStaticExpression(context, unwrapped.left, seen, options) &&
				isStaticExpression(context, unwrapped.right, seen, options)
			);

		case AST_NODE_TYPES.ConditionalExpression:
			return (
				isStaticExpression(context, unwrapped.test, seen, options) &&
				isStaticExpression(context, unwrapped.consequent, seen, options) &&
				isStaticExpression(context, unwrapped.alternate, seen, options)
			);

		case AST_NODE_TYPES.ArrayExpression:
			return context !== undefined && isStaticArrayExpression(context, unwrapped, seen, options);

		case AST_NODE_TYPES.ObjectExpression:
			return context !== undefined && isStaticObjectExpression(context, unwrapped, seen, options);

		case AST_NODE_TYPES.Identifier:
			return context !== undefined && isStaticIdentifier(context, unwrapped, seen, options);

		case AST_NODE_TYPES.MemberExpression:
			return (
				isStaticExpression(context, unwrapped.object, seen, options) &&
				(!unwrapped.computed || isStaticMemberProperty(unwrapped.property, seen, options))
			);

		case AST_NODE_TYPES.ChainExpression:
			return isStaticExpression(context, unwrapped.expression, seen, options);

		case AST_NODE_TYPES.CallExpression:
			return (
				context !== undefined &&
				isStaticCallCallee(context, unwrapped.callee, seen, options) &&
				unwrapped.arguments.every(
					(arg) =>
						arg.type !== AST_NODE_TYPES.SpreadElement && isStaticExpression(context, arg, seen, options),
				)
			);

		case AST_NODE_TYPES.NewExpression:
			return (
				context !== undefined &&
				isStaticCallCallee(context, unwrapped.callee, seen, options) &&
				(unwrapped.arguments ?? []).every(
					(arg) =>
						arg.type !== AST_NODE_TYPES.SpreadElement && isStaticExpression(context, arg, seen, options),
				)
			);

		case AST_NODE_TYPES.SequenceExpression:
			return (
				unwrapped.expressions.length > 0 &&
				unwrapped.expressions.every((expr) => isStaticExpression(context, expr, seen, options))
			);

		case AST_NODE_TYPES.AssignmentExpression:
			return isStaticExpression(context, unwrapped.right, seen, options);

		default:
			return false;
	}
}

function classifyDependencies(
	context: TSESLint.RuleContext<MessageIds, Options>,
	argument: TSESTree.CallExpressionArgument | undefined,
	seen: Set<TSESTree.Node>,
	options: NormalizedOptions,
): DepsKind {
	if (argument === undefined) return DepsKind.MissingOrOmitted;
	if (argument.type === AST_NODE_TYPES.SpreadElement) return DepsKind.DynamicOrUnknown;

	const expr = unwrapExpression(argument);
	if (expr.type !== AST_NODE_TYPES.ArrayExpression) return DepsKind.DynamicOrUnknown;

	if (expr.elements.length === 0) return DepsKind.EmptyArray;
	if (isStaticArrayExpression(context, expr, seen, options)) return DepsKind.StaticArray;

	return DepsKind.DynamicOrUnknown;
}

function depsAreNonUpdating(kind: DepsKind, options: NormalizedOptions): boolean {
	if (kind === DepsKind.MissingOrOmitted || kind === DepsKind.StaticArray) return true;
	if (kind === DepsKind.EmptyArray) return options.treatEmptyDepsAsViolation;
	return false;
}

function isSpringHookCall(node: TSESTree.CallExpression, options: NormalizedOptions): boolean {
	const { callee } = node;

	if (callee.type === AST_NODE_TYPES.Identifier) return options.springHooks.has(callee.name);

	if (callee.type === AST_NODE_TYPES.MemberExpression && !callee.computed) {
		const { property } = callee;
		if (property.type === AST_NODE_TYPES.Identifier) return options.springHooks.has(property.name);
	}

	return false;
}

const noUselessUseSpring: TSESLint.RuleModuleWithMetaDocs<MessageIds, Options> = {
	create(context) {
		const [rawOptions] = context.options;
		const normalized: NormalizedOptions = {
			...DEFAULT_OPTION_VALUES,
			...rawOptions,
			springHooks: new Set(rawOptions?.springHooks ?? DEFAULT_OPTION_VALUES.springHooks),
			staticGlobalFactories: new Set(
				rawOptions?.staticGlobalFactories ?? DEFAULT_OPTION_VALUES.staticGlobalFactories,
			),
		};

		return {
			CallExpression(node) {
				if (!isSpringHookCall(node, normalized)) return;
				if (node.arguments.length === 0) return;

				const [configArgument] = node.arguments;
				if (!configArgument) return;
				if (configArgument.type === AST_NODE_TYPES.SpreadElement) return;

				const seen = new Set<TSESTree.Node>();
				if (!isStaticObjectLikeConfig(context, configArgument, seen, normalized)) return;

				// Mount animations with both `from` and `to` are valid - they animate once on mount
				if (hasFromAndToProperties(context, configArgument)) return;

				const depsKind = classifyDependencies(context, node.arguments[1], seen, normalized);
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
					staticGlobalFactories: {
						default: [...DEFAULT_STATIC_GLOBAL_FACTORIES],
						description: "Global factory identifiers that are treated as static constructors",
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
