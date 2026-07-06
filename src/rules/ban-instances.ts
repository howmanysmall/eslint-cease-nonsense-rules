import { createRule } from "$utilities/create-rule";
import { TSESTree } from "@typescript-eslint/types";

import type { ReadonlyRecord } from "$types/utility-types";

/**
 * Configuration for banned Roblox Instance classes.
 *
 * Supports two formats: - Array: `["Part", "Frame"]` - uses default message - Object: `{ Part: "Use MeshPart instead"
 * }` - uses custom message
 *
 * @example
 * 	```typescript
 * 	// Array format
 * 	{ bannedInstances: ["Part", "Frame", "Script"] }
 *
 * 	// Object format with custom messages
 * 	{ bannedInstances: { Part: "Use MeshPart instead", Script: "Scripts should not be created at runtime" } }
 * 	```;
 */
export interface BanInstancesOptions {
	readonly bannedInstances: ReadonlyArray<string> | ReadonlyRecord<string, string>;
}

type Options = [BanInstancesOptions];
type MessageIds = "bannedInstance" | "bannedInstanceCustom";

interface BannedClassEntry {
	readonly message: string | undefined;
	readonly originalName: string;
}

interface NormalizedConfig {
	readonly bannedClasses: ReadonlyMap<string, BannedClassEntry>;
}

function isBannedInstancesArray(
	bannedInstances: BanInstancesOptions["bannedInstances"],
): bannedInstances is ReadonlyArray<string> {
	return Array.isArray(bannedInstances);
}

function normalizeConfig(options: BanInstancesOptions): NormalizedConfig {
	const { bannedInstances } = options;
	const bannedClasses = new Map<string, BannedClassEntry>();

	if (isBannedInstancesArray(bannedInstances)) {
		for (const className of bannedInstances) {
			bannedClasses.set(className.toLowerCase(), { message: undefined, originalName: className });
		}
		return { bannedClasses };
	}

	for (const [className, message] of Object.entries(bannedInstances)) {
		bannedClasses.set(className.toLowerCase(), { message, originalName: className });
	}

	return { bannedClasses };
}

const banInstances = createRule<Options, MessageIds>({
	create(context) {
		const config = normalizeConfig(context.options[0]);

		if (config.bannedClasses.size === 0) return {};

		function reportBannedClass(node: TSESTree.Node, entry: BannedClassEntry): void {
			const { originalName, message } = entry;

			if (message !== undefined && message !== "") {
				context.report({
					data: { className: originalName, customMessage: message },
					messageId: "bannedInstanceCustom",
					node,
				});
			} else {
				context.report({
					data: { className: originalName },
					messageId: "bannedInstance",
					node,
				});
			}
		}

		return {
			JSXOpeningElement(node: TSESTree.JSXOpeningElement): void {
				const { name } = node;

				if (name.type !== TSESTree.AST_NODE_TYPES.JSXIdentifier) return;

				const elementName = name.name;
				const firstCharacter = elementName.charAt(0);

				if (firstCharacter !== firstCharacter.toLowerCase()) return;

				const entry = config.bannedClasses.get(elementName.toLowerCase());
				if (!entry) return;

				reportBannedClass(node, entry);
			},

			NewExpression(node: TSESTree.NewExpression): void {
				if (node.callee.type !== TSESTree.AST_NODE_TYPES.Identifier) return;
				if (node.callee.name !== "Instance") return;

				const [firstArgument] = node.arguments;
				if (!firstArgument || firstArgument.type !== TSESTree.AST_NODE_TYPES.Literal) return;
				if (typeof firstArgument.value !== "string") return;

				const entry = config.bannedClasses.get(firstArgument.value.toLowerCase());
				if (!entry) return;

				reportBannedClass(node, entry);
			},
		};
	},
	meta: {
		defaultOptions: [{ bannedInstances: [] }],
		docs: {
			description: "Ban specified Roblox Instance classes in new Instance() calls and JSX elements.",
		},
		messages: {
			bannedInstance:
				"Instance class '{{className}}' is banned by project configuration. This class may cause performance issues, is deprecated, or has a better alternative. Check project guidelines for the recommended replacement.",
			bannedInstanceCustom: "{{customMessage}}",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					bannedInstances: {
						description:
							"Instance classes to ban. Array of names or object mapping names to custom messages.",
						oneOf: [
							{
								items: { type: "string" },
								type: "array",
							},
							{
								additionalProperties: { type: "string" },
								type: "object",
							},
						],
					},
				},
				required: ["bannedInstances"],
				type: "object",
			},
		],
		type: "problem",
	},
	name: "ban-instances",
});

export default banInstances;
