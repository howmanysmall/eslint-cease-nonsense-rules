import { unwrapExpression } from "$utilities/ast-utilities";
import { createRule } from "$utilities/create-rule";
import { classifyDependencyArray, DependencyArrayKind } from "$utilities/dependency-array-utilities";
import {
	findVariableInScope,
	getConstInitializer,
	isImportVariable,
	isModuleLevelScope,
	isStaticIdentifierReference,
} from "$utilities/static-expression-utilities";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";

import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

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

function isStaticMemberProperty(
	property: TSESTree.Expression,
	seen: Set<TSESTree.Node>,
	options: NormalizedOptions,
): boolean {
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
		if (!(isNonPatternExpression(value) && isStaticExpression(context, value, seen, options))) return false;
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

function isObjectProperty(property: TSESTree.ObjectExpression["properties"][number]): property is TSESTree.Property {
	return property.type === AST_NODE_TYPES.Property;
}

function objectHasFromAndTo(objectExpr: TSESTree.ObjectExpression): boolean {
	let hasFrom = false;
	let hasTo = false;

	for (const property of objectExpr.properties.filter(isObjectProperty)) {
		if (property.computed) continue;
		if (property.key.type !== AST_NODE_TYPES.Identifier) continue;

		if (property.key.name === "from") hasFrom = true;
		if (property.key.name === "to") hasTo = true;
		if (hasFrom && hasTo) return true;
	}

	return false;
}

function getModuleLevelConstObjectInitializer(
	context: TSESLint.RuleContext<MessageIds, Options>,
	identifier: TSESTree.Identifier,
): ReadonlyArray<TSESTree.ObjectExpression> {
	const variable = findVariableInScope(context.sourceCode, identifier);
	if (variable === undefined) return [];
	if (!isModuleLevelScope(variable.scope) || isImportVariable(variable)) return [];

	const initializers = new Array<TSESTree.ObjectExpression>();
	for (const definition of variable.defs) {
		const initializer = getConstInitializer(definition);
		if (initializer === undefined) continue;

		const normalizedInitializer = unwrapExpression(initializer);
		if (normalizedInitializer.type === AST_NODE_TYPES.ObjectExpression) initializers.push(normalizedInitializer);
	}

	return initializers;
}

function getStaticObjectLikeConfigInitializers(
	context: TSESLint.RuleContext<MessageIds, Options>,
	expression: TSESTree.Expression,
	seen: Set<TSESTree.Node>,
	options: NormalizedOptions,
): ReadonlyArray<TSESTree.ObjectExpression> {
	const unwrapped = unwrapExpression(expression);
	if (unwrapped.type === AST_NODE_TYPES.ObjectExpression) {
		return isStaticObjectExpression(context, unwrapped, seen, options) ? [unwrapped] : [];
	}

	if (unwrapped.type !== AST_NODE_TYPES.Identifier) return [];

	const staticInitializers = new Array<TSESTree.ObjectExpression>();
	for (const normalizedInitializer of getModuleLevelConstObjectInitializer(context, unwrapped)) {
		if (isStaticObjectExpression(context, normalizedInitializer, seen, options)) {
			staticInitializers.push(normalizedInitializer);
		}
	}

	return staticInitializers;
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

function checkStaticBinaryOrLogical(
	context: TSESLint.RuleContext<MessageIds, Options> | undefined,
	expression: TSESTree.BinaryExpression | TSESTree.LogicalExpression,
	seen: Set<TSESTree.Node>,
	options: NormalizedOptions,
): boolean {
	return (
		isNonPrivateExpression(expression.left) &&
		isNonPrivateExpression(expression.right) &&
		isStaticExpression(context, expression.left, seen, options) &&
		isStaticExpression(context, expression.right, seen, options)
	);
}

function checkStaticCallOrNewExpression(
	context: TSESLint.RuleContext<MessageIds, Options> | undefined,
	callee: TSESTree.Expression,
	seen: Set<TSESTree.Node>,
	options: NormalizedOptions,
	parameters: ReadonlyArray<TSESTree.CallExpressionArgument> = [],
): boolean {
	if (context === undefined) return false;
	if (!isStaticCallCallee(context, callee, seen, options)) return false;
	return parameters.every(
		(argument) =>
			argument.type !== AST_NODE_TYPES.SpreadElement && isStaticExpression(context, argument, seen, options),
	);
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
			return context !== undefined && isStaticArrayExpression(context, unwrapped, seen, options);

		case AST_NODE_TYPES.ObjectExpression:
			return context !== undefined && isStaticObjectExpression(context, unwrapped, seen, options);

		case AST_NODE_TYPES.Identifier:
			return context !== undefined && isStaticIdentifier(context, unwrapped, seen, options);

		case AST_NODE_TYPES.MemberExpression: {
			return (
				isStaticExpression(context, unwrapped.object, seen, options) &&
				(!unwrapped.computed || isStaticMemberProperty(unwrapped.property, seen, options))
			);
		}

		case AST_NODE_TYPES.CallExpression:
		case AST_NODE_TYPES.NewExpression:
			return checkStaticCallOrNewExpression(context, unwrapped.callee, seen, options, unwrapped.arguments);

		case AST_NODE_TYPES.SequenceExpression: {
			return (
				unwrapped.expressions.length > 0 &&
				unwrapped.expressions.every((expr) => isStaticExpression(context, expr, seen, options))
			);
		}

		case AST_NODE_TYPES.AssignmentExpression:
			return isStaticExpression(context, unwrapped.right, seen, options);

		default:
			return false;
	}
}

function depsAreNonUpdating(kind: DependencyArrayKind, options: NormalizedOptions): boolean {
	if (kind === DependencyArrayKind.MissingOrOmitted || kind === DependencyArrayKind.StaticArray) return true;
	if (kind === DependencyArrayKind.EmptyArray) return options.treatEmptyDepsAsViolation;
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

const noUselessUseSpring = createRule<Options, MessageIds>({
	create(context) {
		const [rawOptions] = context.options;
		const options = { ...DEFAULT_OPTION_VALUES, ...rawOptions };
		const normalized: NormalizedOptions = {
			...options,
			springHooks: new Set(options.springHooks),
			staticGlobalFactories: new Set(options.staticGlobalFactories),
		};

		return {
			CallExpression(node): void {
				if (!isSpringHookCall(node, normalized)) return;

				const [configArgument] = node.arguments;
				if (configArgument === undefined) return;
				if (configArgument.type === AST_NODE_TYPES.SpreadElement) return;

				const seen = new Set<TSESTree.Node>();
				const staticConfigObjects = getStaticObjectLikeConfigInitializers(
					context,
					configArgument,
					seen,
					normalized,
				);
				if (staticConfigObjects.length === 0) return;

				// Mount animations with both `from` and `to` are valid - they animate once on mount
				if (staticConfigObjects.some(objectHasFromAndTo)) return;

				const depsKind = classifyDependencyArray(node.arguments[1], (arrayExpression) =>
					isStaticArrayExpression(context, arrayExpression, seen, normalized),
				);
				if (!depsAreNonUpdating(depsKind, normalized)) return;

				context.report({
					messageId: "uselessSpring",
					node,
				});
			},
		};
	},
	meta: {
		defaultOptions: [DEFAULT_OPTION_VALUES],
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
	name: "no-useless-use-spring",
});

export default noUselessUseSpring;
