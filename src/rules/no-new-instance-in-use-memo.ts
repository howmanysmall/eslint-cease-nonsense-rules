import { TSESTree } from "@typescript-eslint/types";

import { getReactSources, isReactImport } from "../constants/react-sources";
import type { EnvironmentMode } from "../types/environment-mode";
import { createRule } from "../utilities/create-rule";

type MessageIds = "noNewInUseMemo";

export interface NoNewInstanceInUseMemoOptions {
	readonly constructors?: ReadonlyArray<string>;
	readonly environment?: EnvironmentMode;
}

type Options = [NoNewInstanceInUseMemoOptions?];

interface NormalizedOptions {
	readonly constructors: ReadonlySet<string>;
	readonly environment: EnvironmentMode;
}

const DEFAULT_OPTIONS: Required<NoNewInstanceInUseMemoOptions> = {
	constructors: ["Instance"],
	environment: "roblox-ts",
};

function normalizeOptions(raw?: NoNewInstanceInUseMemoOptions): NormalizedOptions {
	return {
		constructors: new Set(raw?.constructors ?? DEFAULT_OPTIONS.constructors),
		environment: raw?.environment ?? DEFAULT_OPTIONS.environment,
	};
}

function getImportedName(specifier: TSESTree.ImportSpecifier): string | undefined {
	const { imported } = specifier;
	if (imported.type === TSESTree.AST_NODE_TYPES.Identifier) return imported.name;
	if (imported.type === TSESTree.AST_NODE_TYPES.Literal && typeof imported.value === "string") return imported.value;
	return undefined;
}

function isUseMemoCall(
	node: TSESTree.CallExpression,
	memoIdentifiers: ReadonlySet<string>,
	reactNamespaces: ReadonlySet<string>,
): boolean {
	const { callee } = node;

	if (callee.type === TSESTree.AST_NODE_TYPES.Identifier) return memoIdentifiers.has(callee.name);
	if (callee.type !== TSESTree.AST_NODE_TYPES.MemberExpression) return false;
	if (callee.computed) return false;
	if (callee.object.type !== TSESTree.AST_NODE_TYPES.Identifier) return false;
	if (callee.property.type !== TSESTree.AST_NODE_TYPES.Identifier) return false;

	return reactNamespaces.has(callee.object.name) && callee.property.name === "useMemo";
}

function isFunctionLike(node: TSESTree.Node): node is TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression {
	return (
		node.type === TSESTree.AST_NODE_TYPES.ArrowFunctionExpression ||
		node.type === TSESTree.AST_NODE_TYPES.FunctionExpression
	);
}

function isCallExpression(node: TSESTree.Node | undefined): node is TSESTree.CallExpression {
	return node?.type === TSESTree.AST_NODE_TYPES.CallExpression;
}

function isInsideUseMemoCallback(
	node: TSESTree.NewExpression,
	memoIdentifiers: ReadonlySet<string>,
	reactNamespaces: ReadonlySet<string>,
): boolean {
	let current: TSESTree.Node | undefined = node.parent;

	while (current) {
		if (isFunctionLike(current)) {
			const callExpression: TSESTree.Node | undefined = current.parent;
			if (isCallExpression(callExpression) && callExpression.arguments[0] === current) {
				if (!isUseMemoCall(callExpression, memoIdentifiers, reactNamespaces)) {
					current = callExpression;
					continue;
				}

				return true;
			}
		}

		current = current.parent;
	}

	return false;
}

const noNewInstanceInUseMemo = createRule<Options, MessageIds>({
	create(context) {
		const options = normalizeOptions(context.options[0]);
		if (options.constructors.size === 0) return {};

		const reactSources = getReactSources(options.environment);
		const memoIdentifiers = new Set<string>();
		const reactNamespaces = new Set<string>();

		return {
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
					if (getImportedName(specifier) === "useMemo") memoIdentifiers.add(specifier.local.name);
				}
			},

			NewExpression(node): void {
				if (node.callee.type !== TSESTree.AST_NODE_TYPES.Identifier) return;

				const constructorName = node.callee.name;
				if (!options.constructors.has(constructorName)) return;
				if (!isInsideUseMemoCallback(node, memoIdentifiers, reactNamespaces)) return;

				context.report({
					data: { constructorName },
					messageId: "noNewInUseMemo",
					node,
				});
			},
		};
	},
	defaultOptions: [{}],
	meta: {
		docs: {
			description:
				"Disallow configured constructor calls (default: new Instance) inside React useMemo callbacks.",
		},
		messages: {
			noNewInUseMemo:
				"Avoid creating '{{constructorName}}' with `new` inside useMemo. Create it outside the memo callback or use an effect/ref pattern.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					constructors: {
						description: "Constructor identifiers that should be disallowed inside useMemo callbacks.",
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
		type: "problem",
	},
	name: "no-new-instance-in-use-memo",
});

export default noNewInstanceInUseMemo;
