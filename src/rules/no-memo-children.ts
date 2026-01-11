import { TSESTree } from "@typescript-eslint/types";
import { ESLintUtils } from "@typescript-eslint/utils";
import type { Type, TypeChecker } from "typescript";
import { getReactSources, isReactImport } from "../constants/react-sources";
import type { EnvironmentMode } from "../types/environment-mode";
import { createRule } from "../utilities/create-rule";

type MessageIds = "memoWithChildren";

export interface NoMemoChildrenOptions {
	/**
	 * Component names to allow with children despite memo wrapper.
	 * @default []
	 */
	readonly allowedComponents?: ReadonlyArray<string>;

	/**
	 * The React environment: 'roblox-ts' uses `@rbxts/react`, 'standard' uses react.
	 * @default "roblox-ts"
	 */
	readonly environment?: EnvironmentMode;
}

type Options = [NoMemoChildrenOptions?];

const DEFAULT_OPTIONS: Required<NoMemoChildrenOptions> = {
	allowedComponents: [],
	environment: "roblox-ts",
};

function isMemoCall(
	node: TSESTree.CallExpression,
	memoIdentifiers: Set<string>,
	reactNamespaces: Set<string>,
): boolean {
	const { callee } = node;

	if (callee.type === TSESTree.AST_NODE_TYPES.Identifier) return memoIdentifiers.has(callee.name);

	if (
		callee.type === TSESTree.AST_NODE_TYPES.MemberExpression &&
		callee.object.type === TSESTree.AST_NODE_TYPES.Identifier &&
		callee.property.type === TSESTree.AST_NODE_TYPES.Identifier
	) {
		return reactNamespaces.has(callee.object.name) && callee.property.name === "memo";
	}

	return false;
}

function typeHasChildrenProperty(checker: TypeChecker, type: Type, visited = new WeakSet<Type>()): boolean {
	if (visited.has(type)) return false;
	visited.add(type);

	const allProperties = checker.getPropertiesOfType(type);
	for (const prop of allProperties) if (prop.getName() === "children") return true;

	if (type.isUnion()) {
		for (const constituent of type.types) if (typeHasChildrenProperty(checker, constituent, visited)) return true;
	}

	if (type.isIntersection()) {
		for (const constituent of type.types) if (typeHasChildrenProperty(checker, constituent, visited)) return true;
	}

	const baseTypes = type.getBaseTypes?.();
	if (baseTypes) {
		for (const baseType of baseTypes) if (typeHasChildrenProperty(checker, baseType, visited)) return true;
	}

	return false;
}

function getPropsTypeFromMemoCall(
	services: ReturnType<typeof ESLintUtils.getParserServices>,
	checker: TypeChecker,
	node: TSESTree.CallExpression,
): Type | undefined {
	const tsCallNode = services.esTreeNodeToTSNodeMap.get(node);
	if (!tsCallNode) return undefined;

	const memoResultType = checker.getTypeAtLocation(tsCallNode);
	if (!memoResultType) return undefined;

	const memoResultSignatures = memoResultType.getCallSignatures();
	if (memoResultSignatures.length > 0) {
		const [firstSignature] = memoResultSignatures;
		if (firstSignature) {
			const [propertyParameter] = firstSignature.getParameters();
			if (propertyParameter) return checker.getTypeOfSymbol(propertyParameter);
		}
	}

	if (node.typeArguments && node.typeArguments.params.length > 0) {
		const [typeArgNode] = node.typeArguments.params;
		if (typeArgNode) {
			const tsTypeArgNode = services.esTreeNodeToTSNodeMap.get(typeArgNode);
			if (tsTypeArgNode) {
				const typeFromArgument = checker.getTypeAtLocation(tsTypeArgNode);
				if (typeFromArgument) return typeFromArgument;
			}
		}
	}

	const [firstArgument] = node.arguments;
	if (!firstArgument) return undefined;

	const tsNode = services.esTreeNodeToTSNodeMap.get(firstArgument);
	if (!tsNode) return undefined;

	const componentType = checker.getTypeAtLocation(tsNode);
	if (!componentType) return undefined;

	const callSignatures = componentType.getCallSignatures();
	if (callSignatures.length === 0) return undefined;

	const [firstSignature] = callSignatures;
	if (!firstSignature) return undefined;

	const parameters = firstSignature.getParameters();
	if (parameters.length === 0) return undefined;

	const [propertiesParameter] = parameters;
	return propertiesParameter ? checker.getTypeOfSymbol(propertiesParameter) : undefined;
}

function getComponentName(node: TSESTree.CallExpression): string | undefined {
	const [firstArgument] = node.arguments;
	if (!firstArgument) return undefined;

	if (firstArgument.type === TSESTree.AST_NODE_TYPES.Identifier) return firstArgument.name;
	if (firstArgument.type === TSESTree.AST_NODE_TYPES.FunctionExpression && firstArgument.id) {
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

export default createRule<Options, MessageIds>({
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
				if (!isMemoCall(node, memoIdentifiers, reactNamespaces)) return;

				// Check if this component is in the allowlist
				const componentName = getComponentName(node);
				if (componentName && allowedSet.has(componentName)) return;

				// Get the props type
				const propsType = getPropsTypeFromMemoCall(services, checker, node);
				if (!propsType) return;

				// Check if props type has children
				if (typeHasChildrenProperty(checker, propsType)) {
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
					} else if (specifier.type === TSESTree.AST_NODE_TYPES.ImportSpecifier) {
						const importedName =
							specifier.imported.type === TSESTree.AST_NODE_TYPES.Identifier
								? specifier.imported.name
								: specifier.imported.value;

						if (importedName === "memo") memoIdentifiers.add(specifier.local.name);
					}
				}
			},
		};
	},
	defaultOptions: [DEFAULT_OPTIONS],
	meta: {
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
