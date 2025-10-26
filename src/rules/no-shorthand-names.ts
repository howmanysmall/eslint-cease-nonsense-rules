import type { Rule } from "eslint";

interface RuleOptions {
	readonly shorthands?: Record<string, string>;
	readonly allowPropertyAccess?: Array<string>;
}

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

function isStringRecord(value: unknown): value is Record<string, string> {
	return isUnknownRecord(value) && Object.values(value).every((v) => typeof v === "string");
}

function isStringArray(value: unknown): value is Array<string> {
	return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function escapeRegex(str: string): string {
	return str.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isRuleOptions(value: unknown): value is RuleOptions {
	if (!isUnknownRecord(value)) return false;

	return (
		(!("shorthands" in value) || isStringRecord(value.shorthands)) &&
		(!("allowPropertyAccess" in value) || isStringArray(value.allowPropertyAccess))
	);
}

function normalizeOptions(rawOptions: RuleOptions | undefined): NormalizedOptions {
	const mergedShorthands: Record<string, string> = { ...DEFAULT_OPTIONS.shorthands };
	if (rawOptions?.shorthands)
		for (const [key, value] of Object.entries(rawOptions.shorthands)) mergedShorthands[key] = value;

	const shorthandsMap = new Map(Object.entries(mergedShorthands));
	const allowPropertyAccessSource = rawOptions?.allowPropertyAccess ?? DEFAULT_OPTIONS.allowPropertyAccess;

	const escapedKeys = Array.from(shorthandsMap.keys()).map((key) => escapeRegex(key));
	const selector = `Identifier[name=/^(${escapedKeys.join("|")})$/]`;

	return {
		allowPropertyAccess: new Set(allowPropertyAccessSource),
		selector,
		shorthands: shorthandsMap,
	};
}

const noShorthandNames: Rule.RuleModule = {
	create(context) {
		const validatedOptions = isRuleOptions(context.options[0]) ? context.options[0] : undefined;
		const normalized = normalizeOptions(validatedOptions);
		const { shorthands, allowPropertyAccess, selector } = normalized;

		return {
			[selector](node: Rule.Node & { name: string; parent?: unknown }) {
				const shorthandName = node.name;
				const replacement = shorthands.get(shorthandName);
				if (!replacement) return;

				const parent = node.parent;

				if (
					allowPropertyAccess.has(shorthandName) &&
					parent &&
					isUnknownRecord(parent) &&
					parent.type === "MemberExpression" &&
					parent.property === node
				)
					return;

				if (shorthandName === "plr" && parent?.type === "VariableDeclarator" && parent.id === node) {
					const init = parent.init;
					if (
						init &&
						isUnknownRecord(init) &&
						init.type === "MemberExpression" &&
						init.object &&
						isUnknownRecord(init.object) &&
						init.object.type === "Identifier" &&
						init.object.name === "Players" &&
						init.property &&
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
