import { TSESTree } from "@typescript-eslint/types";
import type { TSESLint } from "@typescript-eslint/utils";
import Typebox from "typebox";
import { Compile } from "typebox/compile";
import type { ReadonlyRecord } from "../types/utility-types";

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
	readonly bannedInstances: ReadonlyArray<string> | ReadonlyRecord<string, string>;
}

type Options = [BanInstancesOptions?];
type MessageIds = "bannedInstance" | "bannedInstanceCustom";

const isArrayConfig = Compile(Typebox.Array(Typebox.String()));
const isObjectConfig = Compile(Typebox.Record(Typebox.String(), Typebox.String()));
const isOptionsObject = Compile(
	Typebox.Object({
		bannedInstances: Typebox.Union([
			Typebox.Array(Typebox.String()),
			Typebox.Record(Typebox.String(), Typebox.String()),
		]),
	}),
);

interface BannedClassEntry {
	readonly originalName: string;
	readonly message: string | undefined;
}

interface NormalizedConfig {
	readonly bannedClasses: ReadonlyMap<string, BannedClassEntry>;
}

function normalizeConfig(options: unknown): NormalizedConfig {
	if (!isOptionsObject.Check(options)) return { bannedClasses: new Map() };

	const { bannedInstances } = options;
	const bannedClasses = new Map<string, BannedClassEntry>();

	if (isArrayConfig.Check(bannedInstances)) {
		for (const className of bannedInstances) {
			bannedClasses.set(className.toLowerCase(), { message: undefined, originalName: className });
		}
	} else if (isObjectConfig.Check(bannedInstances)) {
		for (const [className, message] of Object.entries(bannedInstances)) {
			bannedClasses.set(className.toLowerCase(), { message, originalName: className });
		}
	}

	return { bannedClasses: bannedClasses };
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
			JSXOpeningElement(node: TSESTree.JSXOpeningElement) {
				const { name } = node;

				if (name.type !== TSESTree.AST_NODE_TYPES.JSXIdentifier) return;

				const elementName = name.name;
				const firstChar = elementName.charAt(0);

				if (firstChar !== firstChar.toLowerCase()) return;

				const entry = config.bannedClasses.get(elementName.toLowerCase());
				if (!entry) return;

				reportBannedClass(node, entry);
			},

			NewExpression(node: TSESTree.NewExpression) {
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
