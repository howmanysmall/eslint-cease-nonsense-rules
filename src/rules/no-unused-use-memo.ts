import { getReactSources, isReactImport } from "$constants/react-sources";
import { getImportSpecifierName } from "$utilities/ast-utilities";
import { createRule } from "$utilities/create-rule";
import { isNamedReactHookCall } from "$utilities/react-hook-utilities";
import { TSESTree } from "@typescript-eslint/types";

import type { ReactEnvironmentOptions } from "$types/react-environment-options";

type MessageIds = "unusedUseMemo";

export type NoUnusedUseMemoOptions = ReactEnvironmentOptions;

type Options = [NoUnusedUseMemoOptions?];

const DEFAULT_OPTIONS: Required<NoUnusedUseMemoOptions> = {
	environment: "roblox-ts",
};

function isStandaloneUseMemo(node: TSESTree.CallExpression): boolean {
	const { parent } = node;

	if (parent?.type === TSESTree.AST_NODE_TYPES.ExpressionStatement) return true;

	return (
		parent?.type === TSESTree.AST_NODE_TYPES.UnaryExpression &&
		parent.operator === "void" &&
		parent.parent?.type === TSESTree.AST_NODE_TYPES.ExpressionStatement
	);
}

const noUnusedUseMemo = createRule<Options, MessageIds>({
	create(context) {
		const options: Required<NoUnusedUseMemoOptions> = {
			...DEFAULT_OPTIONS,
			...context.options[0],
		};

		const reactSources = getReactSources(options.environment);
		const memoIdentifiers = new Set<string>();
		const reactNamespaces = new Set<string>();

		return {
			CallExpression(node): void {
				if (!isNamedReactHookCall(node, "useMemo", memoIdentifiers, reactNamespaces)) return;
				if (!isStandaloneUseMemo(node)) return;

				context.report({
					messageId: "unusedUseMemo",
					node,
				});
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

					const importedName = getImportSpecifierName(specifier);
					if (importedName === "useMemo") memoIdentifiers.add(specifier.local.name);
				}
			},
		};
	},
	meta: {
		defaultOptions: [{}],
		docs: {
			description:
				"Disallow standalone useMemo calls that ignore the memoized value; use useEffect for side effects instead.",
		},
		messages: {
			unusedUseMemo:
				"useMemo is being used as a standalone statement, so its value is ignored. " +
				"If you need side effects, use useEffect instead. Using useMemo to avoid effect rules " +
				"(for example require-named-effect-functions) is invalid.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
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
		type: "problem",
	},
	name: "no-unused-use-memo",
});

export default noUnusedUseMemo;
