import { getReactSources, isReactImport } from "$constants/react-sources";
import { createRule } from "$utilities/create-rule";
import { getDefinedValue } from "$utilities/defined-utilities";
import { isNamedReactHookCall } from "$utilities/react-hook-utilities";
import { TSESTree } from "@typescript-eslint/types";
import { ESLintUtils } from "@typescript-eslint/utils";

import type { EnvironmentMode } from "$types/environment-mode";
import type { Type, TypeChecker } from "typescript";

type MessageIds = "memoWithChildren";

export interface NoMemoChildrenOptions {
	/**
	 * Component names to allow with children despite memo wrapper.
	 *
	 * @default [ ]
	 */
	readonly allowedComponents?: ReadonlyArray<string>;

	/**
	 * The React environment: 'roblox-ts' uses `@rbxts/react`, 'standard' uses react.
	 *
	 * @default "roblox-ts"
	 */
	readonly environment?: EnvironmentMode;
}

type Options = [NoMemoChildrenOptions?];

const DEFAULT_OPTIONS: Required<NoMemoChildrenOptions> = {
	allowedComponents: [],
	environment: "roblox-ts",
};

function typeHasChildrenProperty(checker: TypeChecker, type: Type): boolean {
	if (checker.getPropertiesOfType(type).some((property) => property.getName() === "children")) return true;

	return type.isUnion() && type.types.some((innerType) => typeHasChildrenProperty(checker, innerType));
}

function getPropertiesTypeFromTypeArgument(
	services: ReturnType<typeof ESLintUtils.getParserServices>,
	checker: TypeChecker,
	node: TSESTree.CallExpression,
): Type | undefined {
	const typeArgumentNode = node.typeArguments?.params.at(0);
	if (typeArgumentNode === undefined) return undefined;

	const tsTypeArgumentNode = getDefinedValue(
		services.esTreeNodeToTSNodeMap.get(typeArgumentNode),
		"Expected memo type argument to have a TypeScript node.",
	);
	return checker.getTypeAtLocation(tsTypeArgumentNode);
}

function getPropertiesTypeFromFirstArgument(
	services: ReturnType<typeof ESLintUtils.getParserServices>,
	checker: TypeChecker,
	node: TSESTree.CallExpression,
): Type | undefined {
	const firstArgument = node.arguments.at(0);
	if (firstArgument === undefined) return undefined;

	const tsNode = services.esTreeNodeToTSNodeMap.get(firstArgument);
	const componentType = checker.getTypeAtLocation(tsNode);
	const [firstSignature] = componentType.getCallSignatures();
	const [propertiesParameter] = firstSignature?.getParameters() ?? [];
	return propertiesParameter === undefined ? undefined : checker.getTypeOfSymbol(propertiesParameter);
}

function getPropertiesTypeFromMemoCall(
	services: ReturnType<typeof ESLintUtils.getParserServices>,
	checker: TypeChecker,
	node: TSESTree.CallExpression,
): Type | undefined {
	return (
		getPropertiesTypeFromTypeArgument(services, checker, node) ??
		getPropertiesTypeFromFirstArgument(services, checker, node)
	);
}

function getComponentName(node: TSESTree.CallExpression): string | undefined {
	const [firstArgument] = node.arguments;
	if (firstArgument === undefined) return undefined;

	if (firstArgument.type === TSESTree.AST_NODE_TYPES.Identifier) return firstArgument.name;
	if (firstArgument.type === TSESTree.AST_NODE_TYPES.FunctionExpression && firstArgument.id !== null) {
		return firstArgument.id.name;
	}

	const { parent } = node;
	if (
		parent?.type === TSESTree.AST_NODE_TYPES.VariableDeclarator &&
		parent.id.type === TSESTree.AST_NODE_TYPES.Identifier
	) {
		return parent.id.name;
	}

	return undefined;
}

const noMemoChildren = createRule<Options, MessageIds>({
	create(context) {
		const options: Required<NoMemoChildrenOptions> = {
			...DEFAULT_OPTIONS,
			...context.options[0],
		};

		const reactSources = getReactSources(options.environment);
		const memoIdentifiers = new Set<string>();
		const reactNamespaces = new Set<string>();
		const allowedSet = new Set(options.allowedComponents);

		const services = ESLintUtils.getParserServices(context);
		const checker = services.program.getTypeChecker();

		return {
			CallExpression(node): void {
				if (
					!isNamedReactHookCall(node, "memo", memoIdentifiers, reactNamespaces, {
						allowComputedIdentifierProperty: true,
					})
				) {
					return;
				}

				const componentName = getComponentName(node);
				if (componentName !== undefined && allowedSet.has(componentName)) return;

				const propertiesType = getPropertiesTypeFromMemoCall(services, checker, node);
				if (propertiesType === undefined) return;

				if (typeHasChildrenProperty(checker, propertiesType)) {
					context.report({
						data: { componentName: componentName ?? "Component" },
						messageId: "memoWithChildren",
						node,
					});
				}
			},

			ImportDeclaration(node): void {
				if (!isReactImport(node, reactSources)) return;

				for (const specifier of node.specifiers) {
					if (
						specifier.type === TSESTree.AST_NODE_TYPES.ImportDefaultSpecifier ||
						specifier.type === TSESTree.AST_NODE_TYPES.ImportNamespaceSpecifier
					) {
						reactNamespaces.add(specifier.local.name);
						continue;
					}

					const importedName =
						specifier.imported.type === TSESTree.AST_NODE_TYPES.Identifier
							? specifier.imported.name
							: specifier.imported.value;

					if (importedName === "memo") memoIdentifiers.add(specifier.local.name);
				}
			},
		};
	},
	meta: {
		defaultOptions: [DEFAULT_OPTIONS],
		docs: {
			description:
				"Disallow React.memo on components with children props, which defeats memoization since children change on every render.",
		},
		messages: {
			memoWithChildren:
				"React.memo is ineffective on '{{componentName}}' because it accepts a 'children' prop. " +
				"The 'children' prop is typically a new JSX element on every render, causing the shallow comparison " +
				"performed by memo to return false on every render, negating any performance benefit. " +
				"Either remove 'children' from the props interface, pass children via a render prop pattern, " +
				"or remove the React.memo wrapper entirely.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					allowedComponents: {
						default: [],
						description:
							"Component names to allow with children despite memo wrapper. " +
							"Use this for components where you've verified memoization is still beneficial.",
						items: { type: "string" },
						type: "array",
					},
					environment: {
						default: "roblox-ts",
						description: "The React environment: 'roblox-ts' uses @rbxts/react, 'standard' uses react.",
						enum: ["roblox-ts", "standard"],
						type: "string",
					},
				},
				type: "object",
			},
		],
		type: "suggestion",
	},
	name: "no-memo-children",
});

export default noMemoChildren;
