import { getCallExpressionName, unwrapExpression } from "$utilities/ast-utilities";
import { createRule } from "$utilities/create-rule";
import { classifyDependencyArray, DependencyArrayKind } from "$utilities/dependency-array-utilities";
import {
	findVariableInScope,
	getConstInitializer,
	isImportVariable,
	isModuleLevelScope,
	isStaticExpression,
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
	options: NormalizedOptions,
): ReadonlyArray<TSESTree.ObjectExpression> {
	const unwrapped = unwrapExpression(expression);
	if (unwrapped.type === AST_NODE_TYPES.ObjectExpression) {
		return isStaticSpringExpression(context, unwrapped, options) ? [unwrapped] : [];
	}

	if (unwrapped.type !== AST_NODE_TYPES.Identifier) return [];

	const staticInitializers = new Array<TSESTree.ObjectExpression>();
	for (const normalizedInitializer of getModuleLevelConstObjectInitializer(context, unwrapped)) {
		if (isStaticSpringExpression(context, normalizedInitializer, options)) {
			staticInitializers.push(normalizedInitializer);
		}
	}

	return staticInitializers;
}

function isStaticSpringExpression(
	context: TSESLint.RuleContext<MessageIds, Options>,
	expression: TSESTree.Expression,
	options: NormalizedOptions,
): boolean {
	return isStaticExpression({
		allowArrayHoles: true,
		allowAssignmentExpression: true,
		circularReferenceResult: true,
		expression,
		sourceCode: context.sourceCode,
		staticGlobalFactories: options.staticGlobalFactories,
		unaryOperators: STATIC_UNARY_OPERATORS,
	});
}

function depsAreNonUpdating(kind: DependencyArrayKind, options: NormalizedOptions): boolean {
	if (kind === DependencyArrayKind.MissingOrOmitted || kind === DependencyArrayKind.StaticArray) return true;
	if (kind === DependencyArrayKind.EmptyArray) return options.treatEmptyDepsAsViolation;
	return false;
}

function isSpringHookCall(node: TSESTree.CallExpression, options: NormalizedOptions): boolean {
	if (node.callee.type === AST_NODE_TYPES.MemberExpression && node.callee.computed) return false;
	return options.springHooks.has(getCallExpressionName(node) ?? "");
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

				const staticConfigObjects = getStaticObjectLikeConfigInitializers(context, configArgument, normalized);
				if (staticConfigObjects.length === 0) return;

				// Mount animations with both `from` and `to` are valid - they animate once on mount
				if (staticConfigObjects.some(objectHasFromAndTo)) return;

				const depsKind = classifyDependencyArray(node.arguments[1], (arrayExpression) =>
					isStaticSpringExpression(context, arrayExpression, normalized),
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
