import { DefinitionType, ScopeType } from "@typescript-eslint/scope-manager";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";

import { getReactSources, isReactImport } from "../constants/react-sources";
import { createRule } from "../utilities/create-rule";
import { DEFAULT_STATIC_GLOBAL_FACTORIES } from "./no-useless-use-spring";

import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

import type { EnvironmentMode } from "../types/environment-mode";

type DependencyMode = "empty-or-omitted" | "non-updating" | "aggressive";
type MessageIds = "uselessUseMemo";

export interface NoUselessUseMemoOptions {
	readonly dependencyMode?: DependencyMode;
	readonly environment?: EnvironmentMode;
	readonly staticGlobalFactories?: ReadonlyArray<string>;
}

type Options = [NoUselessUseMemoOptions?];

interface NormalizedOptions {
	readonly dependencyMode: DependencyMode;
	readonly environment: EnvironmentMode;
	readonly staticGlobalFactories: ReadonlySet<string>;
}

enum DependenciesKind {
	MissingOrOmitted = 0,
	EmptyArray = 1,
	StaticArray = 2,
	DynamicOrUnknown = 3,
}

const DEFAULT_OPTIONS: Required<NoUselessUseMemoOptions> = {
	dependencyMode: "non-updating",
	environment: "roblox-ts",
	staticGlobalFactories: DEFAULT_STATIC_GLOBAL_FACTORIES,
};

const STATIC_UNARY_OPERATORS = new Set(["+", "-", "!", "~", "typeof", "void"]);

function normalizeOptions(raw?: NoUselessUseMemoOptions): NormalizedOptions {
	return {
		dependencyMode: raw?.dependencyMode ?? DEFAULT_OPTIONS.dependencyMode,
		environment: raw?.environment ?? DEFAULT_OPTIONS.environment,
		staticGlobalFactories: new Set(raw?.staticGlobalFactories ?? DEFAULT_OPTIONS.staticGlobalFactories),
	};
}

function getImportedName(specifier: TSESTree.ImportSpecifier): string | undefined {
	const { imported } = specifier;
	if (imported.type === AST_NODE_TYPES.Identifier) return imported.name;
	if (imported.type === AST_NODE_TYPES.Literal && typeof imported.value === "string") return imported.value;
	return undefined;
}

function isUseMemoCall(
	node: TSESTree.CallExpression,
	memoIdentifiers: ReadonlySet<string>,
	reactNamespaces: ReadonlySet<string>,
): boolean {
	const { callee } = node;

	if (callee.type === AST_NODE_TYPES.Identifier) return memoIdentifiers.has(callee.name);

	if (callee.type !== AST_NODE_TYPES.MemberExpression) return false;
	if (callee.computed) return false;
	if (callee.object.type !== AST_NODE_TYPES.Identifier) return false;
	if (callee.property.type !== AST_NODE_TYPES.Identifier) return false;

	return reactNamespaces.has(callee.object.name) && callee.property.name === "useMemo";
}

function isStandaloneUseMemo(node: TSESTree.CallExpression): boolean {
	const { parent } = node;
	if (parent === undefined) return false;

	if (parent.type === AST_NODE_TYPES.ExpressionStatement) return true;

	if (parent.type === AST_NODE_TYPES.UnaryExpression && parent.operator === "void") {
		const grandparent = parent.parent;
		if (grandparent === undefined) return false;
		return grandparent.type === AST_NODE_TYPES.ExpressionStatement;
	}

	return false;
}

function unwrapExpression(expression: TSESTree.Expression): TSESTree.Expression {
	let current = expression;

	while (true) {
		if (current.type === AST_NODE_TYPES.TSAsExpression) {
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

		if (current.type === AST_NODE_TYPES.TSTypeAssertion) {
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
): TSESLint.Scope.Variable | undefined {
	let scope: TSESLint.Scope.Scope | null = context.sourceCode.getScope(identifier);

	while (scope !== null) {
		const variable = scope.set.get(identifier.name);
		if (variable !== undefined) return variable;
		scope = scope.upper;
	}

	return undefined;
}

function isModuleLevelScope(scope: TSESLint.Scope.Scope): boolean {
	return scope.type === ScopeType.module || scope.type === ScopeType.global;
}

function isImport(variable: TSESLint.Scope.Variable): boolean {
	for (const definition of variable.defs) {
		if (definition.type === DefinitionType.ImportBinding) return true;
	}

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

function isStaticMemberProperty(
	context: TSESLint.RuleContext<MessageIds, Options> | undefined,
	property: TSESTree.Expression | TSESTree.PrivateIdentifier,
	seen: Set<TSESTree.Node>,
	options: NormalizedOptions,
): boolean {
	if (property.type === AST_NODE_TYPES.PrivateIdentifier) return false;
	if (property.type === AST_NODE_TYPES.Identifier) return true;

	return isStaticExpressionInner(context, property, seen, options);
}

function isNonPrivateExpression(value: TSESTree.Expression | TSESTree.PrivateIdentifier): value is TSESTree.Expression {
	return value.type !== AST_NODE_TYPES.PrivateIdentifier;
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
		value.type !== AST_NODE_TYPES.ArrayPattern &&
		value.type !== AST_NODE_TYPES.ObjectPattern &&
		value.type !== AST_NODE_TYPES.RestElement &&
		value.type !== AST_NODE_TYPES.AssignmentPattern &&
		value.type !== AST_NODE_TYPES.TSEmptyBodyFunctionExpression
	);
}

function isStaticCallCallee(
	context: TSESLint.RuleContext<MessageIds, Options> | undefined,
	callee: TSESTree.Expression,
	seen: Set<TSESTree.Node>,
	options: NormalizedOptions,
): boolean {
	const unwrapped = unwrapExpression(callee);

	if (unwrapped.type === AST_NODE_TYPES.Identifier) {
		if (context === undefined) return false;
		return isStaticIdentifier(context, unwrapped, seen, options);
	}

	if (unwrapped.type !== AST_NODE_TYPES.MemberExpression) return false;
	if (!isStaticExpression(context, unwrapped.object, seen, options)) return false;

	if (unwrapped.computed) {
		if (!isNonPrivateExpression(unwrapped.property)) return false;
		return isStaticExpression(context, unwrapped.property, seen, options);
	}

	return unwrapped.property.type === AST_NODE_TYPES.Identifier;
}

function isStaticArrayExpression(
	context: TSESLint.RuleContext<MessageIds, Options>,
	arrayExpr: TSESTree.ArrayExpression,
	seen: Set<TSESTree.Node>,
	options: NormalizedOptions,
): boolean {
	for (const element of arrayExpr.elements) {
		if (element === null) return false;
		if (element.type === AST_NODE_TYPES.SpreadElement) return false;
		if (!isStaticExpression(context, element, seen, options)) return false;
	}

	return true;
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

		if (property.computed && !isStaticExpression(context, property.key, seen, options)) return false;
		if (!isNonPatternExpression(property.value)) return false;
		if (!isStaticExpression(context, property.value, seen, options)) return false;
	}

	return true;
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

function checkStaticBinaryOrLogical(
	context: TSESLint.RuleContext<MessageIds, Options> | undefined,
	expression: TSESTree.BinaryExpression | TSESTree.LogicalExpression,
	seen: Set<TSESTree.Node>,
	options: NormalizedOptions,
): boolean {
	if (!(isNonPrivateExpression(expression.left) && isNonPrivateExpression(expression.right))) return false;

	return (
		isStaticExpression(context, expression.left, seen, options) &&
		isStaticExpression(context, expression.right, seen, options)
	);
}

function isStaticExpressionInner(
	context: TSESLint.RuleContext<MessageIds, Options> | undefined,
	node: TSESTree.Expression,
	seen: Set<TSESTree.Node>,
	options: NormalizedOptions,
): boolean {
	return isStaticExpression(context, node, seen, options);
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
			return checkStaticBinaryOrLogical(context, unwrapped, seen, options);
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
				(!unwrapped.computed || isStaticMemberProperty(context, unwrapped.property, seen, options))
			);
		case AST_NODE_TYPES.ChainExpression:
			return isStaticExpression(context, unwrapped.expression, seen, options);
		case AST_NODE_TYPES.CallExpression:
			return checkStaticCallOrNewExpression(context, unwrapped.arguments, unwrapped.callee, seen, options);
		case AST_NODE_TYPES.NewExpression:
			return checkStaticCallOrNewExpression(context, unwrapped.arguments, unwrapped.callee, seen, options);
		case AST_NODE_TYPES.SequenceExpression:
			return (
				unwrapped.expressions.length > 0 &&
				unwrapped.expressions.every((expr) => isStaticExpression(context, expr, seen, options))
			);
		default:
			return false;
	}
}

function checkStaticCallOrNewExpression(
	context: TSESLint.RuleContext<MessageIds, Options> | undefined,
	args: ReadonlyArray<TSESTree.CallExpressionArgument> | undefined,
	callee: TSESTree.Expression,
	seen: Set<TSESTree.Node>,
	options: NormalizedOptions,
): boolean {
	if (!isStaticCallCallee(context, callee, seen, options)) return false;

	return (args ?? []).every(
		(argument) =>
			argument.type !== AST_NODE_TYPES.SpreadElement && isStaticExpression(context, argument, seen, options),
	);
}

function getReturnExpression(body: TSESTree.BlockStatement): TSESTree.Expression | undefined {
	if (body.body.length !== 1) return undefined;

	const [statement] = body.body;
	if (statement === undefined || statement.type !== AST_NODE_TYPES.ReturnStatement) return undefined;

	return statement.argument ?? undefined;
}

function getMemoCallbackExpression(node: TSESTree.CallExpression): TSESTree.Expression | undefined {
	const [callback] = node.arguments;
	if (callback === undefined) return undefined;
	if (
		callback.type !== AST_NODE_TYPES.ArrowFunctionExpression &&
		callback.type !== AST_NODE_TYPES.FunctionExpression
	) {
		return undefined;
	}

	if (callback.body.type !== AST_NODE_TYPES.BlockStatement) return callback.body;
	return getReturnExpression(callback.body);
}

function classifyDependencies(
	context: TSESLint.RuleContext<MessageIds, Options>,
	argument: TSESTree.CallExpressionArgument | undefined,
	seen: Set<TSESTree.Node>,
	options: NormalizedOptions,
): DependenciesKind {
	if (argument === undefined) return DependenciesKind.MissingOrOmitted;
	if (argument.type === AST_NODE_TYPES.SpreadElement) return DependenciesKind.DynamicOrUnknown;

	const expression = unwrapExpression(argument);
	if (expression.type !== AST_NODE_TYPES.ArrayExpression) return DependenciesKind.DynamicOrUnknown;

	if (expression.elements.length === 0) return DependenciesKind.EmptyArray;
	if (isStaticArrayExpression(context, expression, seen, options)) return DependenciesKind.StaticArray;

	return DependenciesKind.DynamicOrUnknown;
}

function dependenciesAreNonUpdating(kind: DependenciesKind, options: NormalizedOptions): boolean {
	switch (options.dependencyMode) {
		case "empty-or-omitted":
			return kind === DependenciesKind.MissingOrOmitted || kind === DependenciesKind.EmptyArray;
		case "non-updating":
			return (
				kind === DependenciesKind.MissingOrOmitted ||
				kind === DependenciesKind.EmptyArray ||
				kind === DependenciesKind.StaticArray
			);
		case "aggressive":
			return true;
	}
}

const noUselessUseMemo = createRule<Options, MessageIds>({
	create(context) {
		const options = normalizeOptions(context.options[0]);
		const reactSources = getReactSources(options.environment);
		const memoIdentifiers = new Set<string>();
		const reactNamespaces = new Set<string>();

		return {
			CallExpression(node): void {
				if (!isUseMemoCall(node, memoIdentifiers, reactNamespaces)) return;
				if (isStandaloneUseMemo(node)) return;
				if (node.arguments.length === 0) return;

				const callbackExpression = getMemoCallbackExpression(node);
				if (callbackExpression === undefined) return;

				const seen = new Set<TSESTree.Node>();
				if (!isStaticExpression(context, callbackExpression, seen, options)) return;

				const dependencies = classifyDependencies(context, node.arguments[1], seen, options);
				if (!dependenciesAreNonUpdating(dependencies, options)) return;

				context.report({
					messageId: "uselessUseMemo",
					node,
				});
			},

			ImportDeclaration(node): void {
				if (!isReactImport(node, reactSources)) return;

				for (const specifier of node.specifiers) {
					if (
						specifier.type === AST_NODE_TYPES.ImportDefaultSpecifier ||
						specifier.type === AST_NODE_TYPES.ImportNamespaceSpecifier
					) {
						reactNamespaces.add(specifier.local.name);
						continue;
					}

					if (specifier.type !== AST_NODE_TYPES.ImportSpecifier) continue;
					const importedName = getImportedName(specifier);
					if (importedName === "useMemo") memoIdentifiers.add(specifier.local.name);
				}
			},
		};
	},
	defaultOptions: [{}],
	meta: {
		docs: {
			description: "Disallow useMemo calls that only wrap values static enough to live at module scope.",
		},
		messages: {
			uselessUseMemo:
				"UseMemo is wrapping a static value. Move the value to module scope instead of paying hook overhead for no runtime benefit.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					dependencyMode: {
						default: "non-updating",
						description:
							"Controls which dependency arrays are considered non-updating when the memoized value is static.",
						enum: ["empty-or-omitted", "non-updating", "aggressive"],
						type: "string",
					},
					environment: {
						default: "roblox-ts",
						description: "The React environment: 'roblox-ts' uses @rbxts/react, 'standard' uses react.",
						enum: ["roblox-ts", "standard"],
						type: "string",
					},
					staticGlobalFactories: {
						default: [...DEFAULT_STATIC_GLOBAL_FACTORIES],
						description:
							"Global identifiers that should be treated as static factories when they are otherwise unresolved.",
						items: { type: "string" },
						type: "array",
					},
				},
				type: "object",
			},
		],
		type: "suggestion",
	},
	name: "no-useless-use-memo",
});

export default noUselessUseMemo;
