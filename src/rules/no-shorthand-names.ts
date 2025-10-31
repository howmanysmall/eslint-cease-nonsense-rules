import type { Rule } from "eslint";
import Type from "typebox";
import { Compile } from "typebox/compile";

interface RuleOptions {
	readonly allowPropertyAccess?: Array<string>;
	readonly shorthands?: Record<string, string>;
}

const isRuleOptions = Compile(
	Type.Object({
		allowPropertyAccess: Type.Optional(Type.Array(Type.String())),
		shorthands: Type.Optional(Type.Record(Type.String(), Type.String())),
	}),
);

interface NormalizedOptions {
	readonly shorthands: ReadonlyMap<string, string>;
	readonly allowPropertyAccess: ReadonlySet<string>;
	readonly selector: string;
}

const DEFAULT_OPTIONS: Required<RuleOptions> = {
	allowPropertyAccess: ["char"],
	shorthands: {
		args: "parameters",
		char: "character",
		dt: "deltaTime",
		plr: "player",
	},
};

function isUnknownRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

const ESCAPE_REGEXP = /[.*+?^${}()|[\]\\]/g;
function escapeRegex(value: string): string {
	return value.replaceAll(ESCAPE_REGEXP, "\\$&");
}

function normalizeOptions(rawOptions: RuleOptions | undefined): NormalizedOptions {
	const mergedShorthands: Record<string, string> = { ...DEFAULT_OPTIONS.shorthands };
	if (rawOptions?.shorthands)
		for (const [key, value] of Object.entries(rawOptions.shorthands)) mergedShorthands[key] = value;

	const shorthandsMap = new Map(Object.entries(mergedShorthands));
	const allowPropertyAccessSource = rawOptions?.allowPropertyAccess ?? DEFAULT_OPTIONS.allowPropertyAccess;

	// oxlint-disable-next-line no-array-callback-reference
	const escapedKeys = Array.from(shorthandsMap.keys()).map(escapeRegex);
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

				const parent = node.parent;

				if (
					allowPropertyAccess.has(shorthandName) &&
					parent !== undefined &&
					isUnknownRecord(parent) &&
					parent.type === "MemberExpression" &&
					parent.property === node
				)
					return;

				if (shorthandName === "plr" && parent?.type === "VariableDeclarator" && parent.id === node) {
					const { init } = parent;
					if (
						init &&
						isUnknownRecord(init) &&
						init.type === "MemberExpression" &&
						init.object !== undefined &&
						isUnknownRecord(init.object) &&
						init.object.type === "Identifier" &&
						init.object.name === "Players" &&
						init.property !== undefined &&
						isUnknownRecord(init.property) &&
						init.property.type === "Identifier" &&
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
