import { TSESTree } from "@typescript-eslint/types";
import type { Rule } from "eslint";
import Type from "typebox";
import { Compile } from "typebox/compile";

export interface NoShorthandOptions {
	readonly allowPropertyAccess?: ReadonlyArray<string>;
	readonly shorthands?: Record<string, string>;
}

const isRuleOptions = Compile(
	Type.Object({
		allowPropertyAccess: Type.Optional(Type.Array(Type.String())),
		shorthands: Type.Optional(Type.Record(Type.String(), Type.String())),
	}),
);
const isUnknownRecord = Compile(Type.Record(Type.String(), Type.Unknown()));

interface NormalizedOptions {
	readonly shorthands: ReadonlyMap<string, string>;
	readonly allowPropertyAccess: ReadonlySet<string>;
	readonly selector: string;
}

const DEFAULT_OPTIONS: Required<NoShorthandOptions> = {
	allowPropertyAccess: ["char"],
	shorthands: {
		args: "parameters",
		char: "character",
		dt: "deltaTime",
		plr: "player",
	},
};

const ESCAPE_REGEXP = /[.*+?^${}()|[\]\\]/g;
const ESCAPE_WITH = String.raw`\$&`;

function normalizeOptions(rawOptions: NoShorthandOptions | undefined): NormalizedOptions {
	const mergedShorthands: Record<string, string> = { ...DEFAULT_OPTIONS.shorthands };
	if (rawOptions?.shorthands)
		for (const [key, value] of Object.entries(rawOptions.shorthands)) mergedShorthands[key] = value;

	const shorthandsMap = new Map(Object.entries(mergedShorthands));
	const allowPropertyAccessSource = rawOptions?.allowPropertyAccess ?? DEFAULT_OPTIONS.allowPropertyAccess;

	const escapedKeys = new Array<string>();
	let length = 0;
	for (const key of shorthandsMap.keys()) escapedKeys[length++] = key.replaceAll(ESCAPE_REGEXP, ESCAPE_WITH);

	const selector = `Identifier[name=/^(${escapedKeys.join("|")})$/]`;

	return {
		allowPropertyAccess: new Set(allowPropertyAccessSource),
		selector,
		shorthands: shorthandsMap,
	};
}

const noShorthandNames: Rule.RuleModule = {
	create(context) {
		const validatedOptions = isRuleOptions.Check(context.options[0]) ? context.options[0] : undefined;
		const { shorthands, allowPropertyAccess, selector } = normalizeOptions(validatedOptions);

		return {
			[selector](node: Rule.Node & { name: string; parent?: unknown }) {
				const shorthandName = node.name;
				const replacement = shorthands.get(shorthandName);
				if (replacement === undefined || replacement === "") return;

				const { parent } = node;

				if (
					allowPropertyAccess.has(shorthandName) &&
					parent !== undefined &&
					isUnknownRecord.Check(parent) &&
					parent.type === TSESTree.AST_NODE_TYPES.MemberExpression &&
					parent.property === node
				)
					return;

				if (
					shorthandName === "plr" &&
					parent?.type === TSESTree.AST_NODE_TYPES.VariableDeclarator &&
					parent.id === node
				) {
					const { init } = parent;
					if (
						init &&
						isUnknownRecord.Check(init) &&
						init.type === TSESTree.AST_NODE_TYPES.MemberExpression &&
						init.object !== undefined &&
						isUnknownRecord.Check(init.object) &&
						init.object.type === TSESTree.AST_NODE_TYPES.Identifier &&
						init.object.name === "Players" &&
						init.property !== undefined &&
						isUnknownRecord.Check(init.property) &&
						init.property.type === TSESTree.AST_NODE_TYPES.Identifier &&
						init.property.name === "LocalPlayer"
					) {
						context.report({
							data: { replacement: "localPlayer", shorthand: shorthandName },
							messageId: "useReplacement",
							node,
						});
						return;
					}
				}

				context.report({
					data: { replacement, shorthand: shorthandName },
					messageId: "useReplacement",
					node,
				});
			},
		};
	},
	meta: {
		docs: {
			description: "Ban shorthand variable names. Use descriptive full names instead.",
			recommended: true,
		},
		messages: {
			useReplacement: "Use '{{replacement}}' instead of '{{shorthand}}' shorthand",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					allowPropertyAccess: {
						description: "Shorthand names that are allowed as property access",
						items: { type: "string" },
						type: "array",
					},
					shorthands: {
						additionalProperties: { type: "string" },
						description: "Map of shorthand names to their full replacements",
						type: "object",
					},
				},
				type: "object",
			},
		],
		type: "suggestion",
	},
};

export default noShorthandNames;
