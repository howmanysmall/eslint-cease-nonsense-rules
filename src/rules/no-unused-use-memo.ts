import { TSESTree } from "@typescript-eslint/types";

import { getReactSources, isReactImport } from "../constants/react-sources";
import type { EnvironmentMode } from "../types/environment-mode";
import { createRule } from "../utilities/create-rule";

type MessageIds = "unusedUseMemo";

export interface NoUnusedUseMemoOptions {
	readonly environment?: EnvironmentMode;
}

type Options = [NoUnusedUseMemoOptions?];

const DEFAULT_OPTIONS: Required<NoUnusedUseMemoOptions> = {
	environment: "roblox-ts",
};

function isUseMemoCall(
	node: TSESTree.CallExpression,
	memoIdentifiers: Set<string>,
	reactNamespaces: Set<string>,
): boolean {
	const { callee } = node;

	if (callee.type === TSESTree.AST_NODE_TYPES.Identifier) return memoIdentifiers.has(callee.name);

	if (callee.type !== TSESTree.AST_NODE_TYPES.MemberExpression) return false;
	if (callee.computed) return false;
	if (callee.object.type !== TSESTree.AST_NODE_TYPES.Identifier) return false;
	if (callee.property.type !== TSESTree.AST_NODE_TYPES.Identifier) return false;

	return reactNamespaces.has(callee.object.name) && callee.property.name === "useMemo";
}

function isStandaloneUseMemo(node: TSESTree.CallExpression): boolean {
	const { parent } = node;
	if (!parent) return false;

	if (parent.type === TSESTree.AST_NODE_TYPES.ExpressionStatement) return true;

	if (parent.type === TSESTree.AST_NODE_TYPES.UnaryExpression && parent.operator === "void") {
		const grandparent = parent.parent;
		if (!grandparent) return false;
		return grandparent.type === TSESTree.AST_NODE_TYPES.ExpressionStatement;
	}

	return false;
}

export default createRule<Options, MessageIds>({
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
				if (!isUseMemoCall(node, memoIdentifiers, reactNamespaces)) return;
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

					if (specifier.type !== TSESTree.AST_NODE_TYPES.ImportSpecifier) continue;

					let importedName: string | undefined;
					if (specifier.imported.type === TSESTree.AST_NODE_TYPES.Identifier) {
						importedName = specifier.imported.name;
					} else if (
						specifier.imported.type === TSESTree.AST_NODE_TYPES.Literal &&
						typeof specifier.imported.value === "string"
					) {
						importedName = specifier.imported.value;
					}

					if (importedName === "useMemo") memoIdentifiers.add(specifier.local.name);
				}
			},
		};
	},
	defaultOptions: [{}],
	meta: {
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
