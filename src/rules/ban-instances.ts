import { TSESTree } from "@typescript-eslint/types";
import type { TSESLint } from "@typescript-eslint/utils";
import Type from "typebox";
import { Compile } from "typebox/compile";

/**
 * Configuration for banned Roblox Instance classes.
 *
 * Supports two formats:
 * - Array: `["Part", "Frame"]` - uses default message
 * - Object: `{ Part: "Use MeshPart instead" }` - uses custom message
 *
 * @example
 * ```typescript
 * // Array format
 * { bannedInstances: ["Part", "Frame", "Script"] }
 *
 * // Object format with custom messages
 * { bannedInstances: { Part: "Use MeshPart instead", Script: "Scripts should not be created at runtime" } }
 * ```
 */
export interface BanInstancesOptions {
	readonly bannedInstances: ReadonlyArray<string> | Readonly<Record<string, string>>;
}

type Options = [BanInstancesOptions?];
type MessageIds = "bannedInstance" | "bannedInstanceCustom";

const isArrayConfig = Compile(Type.Array(Type.String()));
const isObjectConfig = Compile(Type.Record(Type.String(), Type.String()));
const isOptionsObject = Compile(
	Type.Object({
		bannedInstances: Type.Union([Type.Array(Type.String()), Type.Record(Type.String(), Type.String())]),
	}),
);

interface NormalizedConfig {
	readonly bannedClasses: ReadonlyMap<string, string | undefined>;
}

function normalizeConfig(options: unknown): NormalizedConfig {
	if (!isOptionsObject.Check(options)) return { bannedClasses: new Map() };

	const { bannedInstances } = options;

	if (isArrayConfig.Check(bannedInstances)) {
		const map = new Map<string, string | undefined>();
		for (const className of bannedInstances) map.set(className, undefined);
		return { bannedClasses: map };
	}

	if (isObjectConfig.Check(bannedInstances)) {
		const map = new Map<string, string | undefined>();
		for (const [className, message] of Object.entries(bannedInstances)) map.set(className, message);
		return { bannedClasses: map };
	}

	return { bannedClasses: new Map() };
}

interface RuleDocsWithRecommended extends TSESLint.RuleMetaDataDocs {
	readonly recommended?: boolean;
}

const docs: RuleDocsWithRecommended = {
	description: "Ban specified Roblox Instance classes in new Instance() calls and JSX elements.",
	recommended: false,
};

const banInstances: TSESLint.RuleModuleWithMetaDocs<MessageIds, Options, RuleDocsWithRecommended> = {
	create(context) {
		const config = normalizeConfig(context.options[0]);

		if (config.bannedClasses.size === 0) return {};

		function reportBannedClass(node: TSESTree.Node, className: string): void {
			const customMessage = config.bannedClasses.get(className);

			if (customMessage !== undefined && customMessage !== "") {
				context.report({
					data: { className, customMessage },
					messageId: "bannedInstanceCustom",
					node,
				});
			} else {
				context.report({
					data: { className },
					messageId: "bannedInstance",
					node,
				});
			}
		}

		return {
			// Handle: <classname> JSX elements (lowercase = Roblox Instance)
			// Capitalized JSX elements like <Part> are custom React components
			JSXOpeningElement(node: TSESTree.JSXOpeningElement) {
				const { name } = node;

				if (name.type !== TSESTree.AST_NODE_TYPES.JSXIdentifier) return;

				const elementName = name.name;
				const firstChar = elementName.charAt(0);

				// Only lowercase JSX elements are Roblox Instances
				if (firstChar !== firstChar.toLowerCase()) return;

				// Capitalize first letter to match Roblox class name convention
				const className = firstChar.toUpperCase() + elementName.slice(1);
				if (!config.bannedClasses.has(className)) return;

				reportBannedClass(node, className);
			},
			// Handle: new Instance("ClassName")
			NewExpression(node: TSESTree.NewExpression) {
				if (node.callee.type !== TSESTree.AST_NODE_TYPES.Identifier) return;
				if (node.callee.name !== "Instance") return;

				const [firstArgument] = node.arguments;
				if (!firstArgument || firstArgument.type !== TSESTree.AST_NODE_TYPES.Literal) return;
				if (typeof firstArgument.value !== "string") return;

				const className = firstArgument.value;
				if (!config.bannedClasses.has(className)) return;

				reportBannedClass(node, className);
			},
		};
	},
	defaultOptions: [{ bannedInstances: [] }],
	meta: {
		docs,
		messages: {
			bannedInstance: "Instance class '{{className}}' is banned.",
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
};

export default banInstances;
