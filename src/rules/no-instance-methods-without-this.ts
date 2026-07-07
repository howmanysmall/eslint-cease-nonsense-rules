import { createRule } from "$utilities/create-rule";
import { AST_NODE_TYPES } from "@typescript-eslint/types";

import type { ReadonlyRecord } from "$types/utility-types";
import type { TSESTree } from "@typescript-eslint/utils";

type MessageIds = "noInstanceMethodWithoutThis";

export interface NoInstanceMethodsOptions {
	checkPrivate?: boolean;
	checkProtected?: boolean;
	checkPublic?: boolean;
}

type NormalizedOptions = Readonly<Required<NoInstanceMethodsOptions>>;

const DEFAULT_OPTIONS: NormalizedOptions = {
	checkPrivate: true,
	checkProtected: true,
	checkPublic: true,
};

function normalizeOptions({
	checkPrivate = DEFAULT_OPTIONS.checkPrivate,
	checkProtected = DEFAULT_OPTIONS.checkProtected,
	checkPublic = DEFAULT_OPTIONS.checkPublic,
}: NoInstanceMethodsOptions): NormalizedOptions {
	return {
		checkPrivate,
		checkProtected,
		checkPublic,
	};
}

function shouldCheckMethod(node: TSESTree.MethodDefinition, options: NormalizedOptions): boolean {
	if (node.static || node.kind !== "method") return false;

	const accessibility = node.accessibility ?? "public";
	if (accessibility === "private" && !options.checkPrivate) return false;
	if (accessibility === "protected" && !options.checkProtected) return false;
	if (accessibility === "public" && !options.checkPublic) return false;

	return true;
}

function isNode(value: unknown): value is TSESTree.Node {
	return typeof value === "object" && value !== null && "type" in value;
}

function getNodeProperties(node: TSESTree.Node): TSESTree.Node & ReadonlyRecord<string, unknown> {
	return { ...node };
}

// oxlint-disable-next-line sonar/cognitive-complexity -- lol.
function traverseForThis(currentNode: TSESTree.Node, visited: WeakSet<TSESTree.Node>): boolean {
	if (visited.has(currentNode)) return false;
	visited.add(currentNode);
	if (currentNode.type === AST_NODE_TYPES.ThisExpression || currentNode.type === AST_NODE_TYPES.Super) return true;

	const currentNodeProperties = getNodeProperties(currentNode);

	for (const childValue of Object.values(currentNodeProperties)) {
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
	const { value } = node;
	if (value === undefined || value.type !== AST_NODE_TYPES.FunctionExpression) return false;
	return traverseForThis(value, new WeakSet());
}

const noInstanceMethodsWithoutThis = createRule<[NoInstanceMethodsOptions], MessageIds>({
	create(context) {
		const [rawOptions] = context.options;
		const options = normalizeOptions(rawOptions);

		return {
			MethodDefinition(node: TSESTree.MethodDefinition): void {
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
	meta: {
		defaultOptions: [DEFAULT_OPTIONS],
		docs: {
			description:
				"Detect instance methods that do not use 'this' and suggest converting them to standalone functions for better performance in roblox-ts.",
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
	name: "no-instance-methods-without-this",
});

export default noInstanceMethodsWithoutThis;
