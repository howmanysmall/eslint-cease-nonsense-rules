import { getReactSources, isReactImport } from "$constants/react-sources";
import { DEFAULT_STATIC_GLOBAL_FACTORIES } from "$rules/no-useless-use-spring";
import { getImportSpecifierName, unwrapExpression } from "$utilities/ast-utilities";
import { createRule } from "$utilities/create-rule";
import { classifyDependencyArray, DependencyArrayKind } from "$utilities/dependency-array-utilities";
import { isNamedReactHookCall } from "$utilities/react-hook-utilities";
import { isStaticIdentifierReference } from "$utilities/static-expression-utilities";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";

import type { EnvironmentMode } from "$types/environment-mode";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

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

const DEFAULT_OPTIONS: Required<NoUselessUseMemoOptions> = {
	dependencyMode: "non-updating",
	environment: "roblox-ts",
	staticGlobalFactories: DEFAULT_STATIC_GLOBAL_FACTORIES,
};

const STATIC_UNARY_OPERATORS = new Set(["+", "-", "!", "~", "typeof", "void"]);

const NON_UPDATING_DEPENDENCIES_BY_MODE: Record<DependencyMode, ReadonlySet<DependencyArrayKind>> = {
	aggressive: new Set([
		DependencyArrayKind.MissingOrOmitted,
		DependencyArrayKind.EmptyArray,
		DependencyArrayKind.StaticArray,
		DependencyArrayKind.DynamicOrUnknown,
	]),
	"empty-or-omitted": new Set([DependencyArrayKind.MissingOrOmitted, DependencyArrayKind.EmptyArray]),
	"non-updating": new Set([
		DependencyArrayKind.MissingOrOmitted,
		DependencyArrayKind.EmptyArray,
		DependencyArrayKind.StaticArray,
	]),
};

function normalizeOptions(raw?: NoUselessUseMemoOptions): NormalizedOptions {
	const options = { ...DEFAULT_OPTIONS, ...raw };
	return {
		dependencyMode: options.dependencyMode,
		environment: options.environment,
		staticGlobalFactories: new Set(options.staticGlobalFactories),
	};
}

function isStandaloneUseMemo(node: TSESTree.CallExpression): boolean {
	switch (node.parent?.type) {
		case AST_NODE_TYPES.ExpressionStatement:
			return true;
		case AST_NODE_TYPES.UnaryExpression:
			return node.parent.operator === "void" && node.parent.parent?.type === AST_NODE_TYPES.ExpressionStatement;
		default:
			return false;
	}
}

function isStaticMemberProperty(
	context: TSESLint.RuleContext<MessageIds, Options>,
	property: TSESTree.Expression,
	seen: Set<TSESTree.Node>,
	options: NormalizedOptions,
): boolean {
	if (property.type === AST_NODE_TYPES.Identifier) return true;

	return isStaticExpressionInner(context, property, seen, options);
}

function isExpressionNode(
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
	context: TSESLint.RuleContext<MessageIds, Options>,
	callee: TSESTree.Expression,
	seen: Set<TSESTree.Node>,
	options: NormalizedOptions,
): boolean {
	const unwrapped = unwrapExpression(callee);

	if (unwrapped.type === AST_NODE_TYPES.Identifier) {
		return isStaticIdentifier(context, unwrapped, seen, options);
	}

	if (unwrapped.type !== AST_NODE_TYPES.MemberExpression) return false;
	if (!isStaticExpression(context, unwrapped.object, seen, options)) return false;

	if (unwrapped.computed) {
		return isStaticMemberProperty(context, unwrapped.property, seen, options);
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
		if (!(isExpressionNode(property.value) && isStaticExpression(context, property.value, seen, options))) {
			return false;
		}
	}

	return true;
}

function isStaticIdentifier(
	context: TSESLint.RuleContext<MessageIds, Options>,
	identifier: TSESTree.Identifier,
	seen: Set<TSESTree.Node>,
	options: NormalizedOptions,
): boolean {
	return isStaticIdentifierReference({
		identifier,
		isStaticExpression: (expression) => isStaticExpression(context, expression, seen, options),
		seen,
		sourceCode: context.sourceCode,
		staticGlobalFactories: options.staticGlobalFactories,
	});
}

function checkStaticBinaryOrLogical(
	context: TSESLint.RuleContext<MessageIds, Options>,
	expression: TSESTree.BinaryExpression | TSESTree.LogicalExpression,
	seen: Set<TSESTree.Node>,
	options: NormalizedOptions,
): boolean {
	if (!(isExpressionNode(expression.left) && isExpressionNode(expression.right))) return false;

	return (
		isStaticExpression(context, expression.left, seen, options) &&
		isStaticExpression(context, expression.right, seen, options)
	);
}

function isStaticExpressionInner(
	context: TSESLint.RuleContext<MessageIds, Options>,
	node: TSESTree.Expression,
	seen: Set<TSESTree.Node>,
	options: NormalizedOptions,
): boolean {
	return isStaticExpression(context, node, seen, options);
}

function isStaticExpression(
	context: TSESLint.RuleContext<MessageIds, Options>,
	expression: TSESTree.Expression,
	seen: Set<TSESTree.Node>,
	options: NormalizedOptions,
): boolean {
	const unwrapped = unwrapExpression(expression);
	if (seen.has(unwrapped)) return false;
	seen.add(unwrapped);

	switch (unwrapped.type) {
		case AST_NODE_TYPES.Literal:
			return true;
		case AST_NODE_TYPES.TemplateLiteral:
			return unwrapped.expressions.length === 0;
		case AST_NODE_TYPES.UnaryExpression: {
			return (
				STATIC_UNARY_OPERATORS.has(unwrapped.operator) &&
				isStaticExpression(context, unwrapped.argument, seen, options)
			);
		}
		case AST_NODE_TYPES.BinaryExpression:
		case AST_NODE_TYPES.LogicalExpression:
			return checkStaticBinaryOrLogical(context, unwrapped, seen, options);
		case AST_NODE_TYPES.ConditionalExpression: {
			return (
				isStaticExpression(context, unwrapped.test, seen, options) &&
				isStaticExpression(context, unwrapped.consequent, seen, options) &&
				isStaticExpression(context, unwrapped.alternate, seen, options)
			);
		}
		case AST_NODE_TYPES.ArrayExpression:
			return isStaticArrayExpression(context, unwrapped, seen, options);
		case AST_NODE_TYPES.ObjectExpression:
			return isStaticObjectExpression(context, unwrapped, seen, options);
		case AST_NODE_TYPES.Identifier:
			return isStaticIdentifier(context, unwrapped, seen, options);
		case AST_NODE_TYPES.MemberExpression: {
			return (
				isStaticExpression(context, unwrapped.object, seen, options) &&
				(!unwrapped.computed || isStaticMemberProperty(context, unwrapped.property, seen, options))
			);
		}
		case AST_NODE_TYPES.CallExpression:
			return checkStaticCallOrNewExpression(context, unwrapped.callee, seen, options, unwrapped.arguments);
		case AST_NODE_TYPES.NewExpression:
			return checkStaticCallOrNewExpression(context, unwrapped.callee, seen, options, unwrapped.arguments);
		case AST_NODE_TYPES.SequenceExpression: {
			return (
				unwrapped.expressions.length > 0 &&
				unwrapped.expressions.every((expr) => isStaticExpression(context, expr, seen, options))
			);
		}
		default:
			return false;
	}
}

function checkStaticCallOrNewExpression(
	context: TSESLint.RuleContext<MessageIds, Options>,
	callee: TSESTree.Expression,
	seen: Set<TSESTree.Node>,
	options: NormalizedOptions,
	parameters: ReadonlyArray<TSESTree.CallExpressionArgument> = [],
): boolean {
	if (!isStaticCallCallee(context, callee, seen, options)) return false;

	return parameters.every(
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

function getMemoCallbackExpression(callback: TSESTree.CallExpressionArgument): TSESTree.Expression | undefined {
	if (
		callback.type !== AST_NODE_TYPES.ArrowFunctionExpression &&
		callback.type !== AST_NODE_TYPES.FunctionExpression
	) {
		return undefined;
	}

	if (callback.body.type !== AST_NODE_TYPES.BlockStatement) return callback.body;
	return getReturnExpression(callback.body);
}

function dependenciesAreNonUpdating(kind: DependencyArrayKind, options: NormalizedOptions): boolean {
	return NON_UPDATING_DEPENDENCIES_BY_MODE[options.dependencyMode].has(kind);
}

const noUselessUseMemo = createRule<Options, MessageIds>({
	create(context) {
		const options = normalizeOptions(context.options[0]);
		const reactSources = getReactSources(options.environment);
		const memoIdentifiers = new Set<string>();
		const reactNamespaces = new Set<string>();

		return {
			CallExpression(node): void {
				if (!isNamedReactHookCall(node, "useMemo", memoIdentifiers, reactNamespaces)) return;
				if (isStandaloneUseMemo(node)) return;

				const [callbackArgument] = node.arguments;
				if (callbackArgument === undefined) return;

				const callbackExpression = getMemoCallbackExpression(callbackArgument);
				if (callbackExpression === undefined) return;

				const seen = new Set<TSESTree.Node>();
				if (!isStaticExpression(context, callbackExpression, seen, options)) return;

				const dependencies = classifyDependencyArray(node.arguments[1], (arrayExpression) =>
					isStaticArrayExpression(context, arrayExpression, seen, options),
				);
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

					const importedName = getImportSpecifierName(specifier);
					if (importedName === "useMemo") memoIdentifiers.add(specifier.local.name);
				}
			},
		};
	},
	meta: {
		defaultOptions: [{}],
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
