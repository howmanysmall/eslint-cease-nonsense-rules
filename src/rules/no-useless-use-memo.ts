import { getReactSources, isReactImport } from "$constants/react-sources";
import { DEFAULT_STATIC_GLOBAL_FACTORIES } from "$rules/no-useless-use-spring";
import { getImportSpecifierName } from "$utilities/ast-utilities";
import { createRule } from "$utilities/create-rule";
import { classifyDependencyArray, DependencyArrayKind } from "$utilities/dependency-array-utilities";
import { isNamedReactHookCall } from "$utilities/react-hook-utilities";
import { isStaticExpression } from "$utilities/static-expression-utilities";
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

function isStaticMemoExpression(
	context: TSESLint.RuleContext<MessageIds, Options>,
	expression: TSESTree.Expression,
	options: NormalizedOptions,
): boolean {
	return isStaticExpression({
		expression,
		sourceCode: context.sourceCode,
		staticGlobalFactories: options.staticGlobalFactories,
		unaryOperators: STATIC_UNARY_OPERATORS,
	});
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

				if (!isStaticMemoExpression(context, callbackExpression, options)) return;

				const dependencies = classifyDependencyArray(node.arguments[1], (arrayExpression) =>
					isStaticMemoExpression(context, arrayExpression, options),
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
