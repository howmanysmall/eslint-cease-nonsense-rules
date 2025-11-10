import { AST_NODE_TYPES } from "@typescript-eslint/types";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

type MessageIds = "noInstanceMethodWithoutThis";

export interface NoInstanceMethodsOptions {
	checkPrivate?: boolean;
	checkProtected?: boolean;
	checkPublic?: boolean;
}

type NormalizedOptions = Readonly<Required<NoInstanceMethodsOptions>>;

interface RuleDocsWithRecommended extends TSESLint.RuleMetaDataDocs {
	readonly recommended?: boolean;
}

const DEFAULT_OPTIONS: Required<NoInstanceMethodsOptions> = {
	checkPrivate: true,
	checkProtected: true,
	checkPublic: true,
};

function normalizeOptions(rawOptions: NoInstanceMethodsOptions | undefined): NormalizedOptions {
	const mergedOptions: Required<NoInstanceMethodsOptions> = { ...DEFAULT_OPTIONS };
	if (rawOptions?.checkPrivate !== undefined) mergedOptions.checkPrivate = rawOptions.checkPrivate;
	if (rawOptions?.checkProtected !== undefined) mergedOptions.checkProtected = rawOptions.checkProtected;
	if (rawOptions?.checkPublic !== undefined) mergedOptions.checkPublic = rawOptions.checkPublic;

	return mergedOptions;
}

function shouldCheckMethod(node: TSESTree.MethodDefinition, options: NormalizedOptions): boolean {
	if (node.static) return false;
	if (node.kind !== "method") return false;

	const accessibility = node.accessibility ?? "public";
	if (accessibility === "private" && !options.checkPrivate) return false;
	if (accessibility === "protected" && !options.checkProtected) return false;
	if (accessibility === "public" && !options.checkPublic) return false;

	return true;
}

function isNode(value: unknown): value is TSESTree.Node {
	return typeof value === "object" && value !== null && "type" in value;
}

// Widen node to allow safe enumeration without producing implicit any values
function hasDynamicProperties(_node: TSESTree.Node): _node is TSESTree.Node & { readonly [key: string]: unknown } {
	return true;
}

function traverseForThis(currentNode: TSESTree.Node, visited: WeakSet<TSESTree.Node>): boolean {
	if (visited.has(currentNode)) return false;
	visited.add(currentNode);
	if (currentNode.type === AST_NODE_TYPES.ThisExpression || currentNode.type === AST_NODE_TYPES.Super) return true;

	if (!hasDynamicProperties(currentNode)) return false;

	for (const key in currentNode) {
		const childValue = currentNode[key];
		if (childValue === null || childValue === undefined) continue;

		if (Array.isArray(childValue)) {
			for (const item of childValue) if (isNode(item) && traverseForThis(item, visited)) return true;
			continue;
		}

		if (isNode(childValue) && traverseForThis(childValue, visited)) return true;
	}

	return false;
}

function methodUsesThis(node: TSESTree.MethodDefinition): boolean {
	const value = node.value;
	if (value === undefined || value.type !== AST_NODE_TYPES.FunctionExpression) return false;
	return traverseForThis(value, new WeakSet());
}

const noInstanceMethodsWithoutThis: TSESLint.RuleModuleWithMetaDocs<
	MessageIds,
	[NoInstanceMethodsOptions | undefined],
	RuleDocsWithRecommended
> = {
	create(context) {
		const rawOptions = context.options[0];
		const options = normalizeOptions(rawOptions);

		return {
			MethodDefinition(node: TSESTree.MethodDefinition) {
				if (!shouldCheckMethod(node, options)) return;
				if (methodUsesThis(node)) return;

				const methodName = node.key.type === AST_NODE_TYPES.Identifier ? node.key.name : "unknown";

				context.report({
					data: { methodName },
					messageId: "noInstanceMethodWithoutThis",
					node,
				});
			},
		};
	},
	defaultOptions: [DEFAULT_OPTIONS],
	meta: {
		docs: {
			description:
				"Detect instance methods that do not use 'this' and suggest converting them to standalone functions for better performance in roblox-ts.",
			recommended: true,
		},
		messages: {
			noInstanceMethodWithoutThis:
				"Method '{{methodName}}' does not use 'this' and creates unnecessary metatable overhead in roblox-ts. Convert it to a standalone function for better performance.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					checkPrivate: {
						default: true,
						description: "Check private methods (default: true)",
						type: "boolean",
					},
					checkProtected: {
						default: true,
						description: "Check protected methods (default: true)",
						type: "boolean",
					},
					checkPublic: {
						default: true,
						description: "Check public methods (default: true)",
						type: "boolean",
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
};

export default noInstanceMethodsWithoutThis;
