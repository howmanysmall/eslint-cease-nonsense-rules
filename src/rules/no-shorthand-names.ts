import type { Rule } from "eslint";

/**
 * Configuration options for the no-shorthand-names rule.
 */
interface RuleOptions {
	shorthands?: Record<string, string>;
	allowPropertyAccess?: Array<string>;
}

interface NormalizedOptions {
	readonly shorthands: ReadonlyMap<string, string>;
	readonly allowPropertyAccess: ReadonlySet<string>;
	readonly selector: string;
}

/**
 * Default configuration values for the rule.
 */
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

/**
 * Escapes special regex characters in a string.
 *
 * @param str - The string to escape.
 * @returns The escaped string safe for use in regex.
 */
function escapeRegex(str: string): string {
	return str.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Type guard to check if an unknown value is valid RuleOptions.
 *
 * @param value - The value to check.
 * @returns True if the value is valid RuleOptions.
 */
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

	// Build regex selector to only visit identifiers matching shorthand names
	const escapedKeys = Array.from(shorthandsMap.keys()).map((key) => escapeRegex(key));
	const selector = `Identifier[name=/^(${escapedKeys.join("|")})$/]`;

	return {
		allowPropertyAccess: new Set(allowPropertyAccessSource),
		selector,
		shorthands: shorthandsMap,
	};
}

/**
 * Bans shorthand variable names in favor of descriptive full names.
 *
 * Enforces:
 * - `plr` → `player` (or `localPlayer` for Players.LocalPlayer assignments)
 * - `args` → `parameters`
 * - `dt` → `deltaTime`
 * - `char` → `character` (except when used as property access)
 *
 * @example
 * // ❌ Reports
 * const plr = getPlayer();
 * const args = [1, 2, 3];
 * const dt = 0.016;
 * const char = getCharacter();
 *
 * // ✅ OK
 * const player = getPlayer();
 * const localPlayer = Players.LocalPlayer;
 * const parameters = [1, 2, 3];
 * const deltaTime = 0.016;
 * const character = getCharacter();
 * const model = entity.char; // property access is allowed
 */
const noShorthandNames: Rule.RuleModule = {
	/**
	 * Creates the ESLint rule visitor.
	 *
	 * @param context - The ESLint rule context.
	 * @returns The visitor object with AST node handlers.
	 */
	create(context) {
		const validatedOptions = isRuleOptions(context.options[0]) ? context.options[0] : undefined;
		const normalized = normalizeOptions(validatedOptions);
		const { shorthands, allowPropertyAccess, selector } = normalized;

		return {
			[selector](node: Rule.Node & { name: string; parent?: unknown }) {
				const shorthandName = node.name;
				const replacement = shorthands.get(shorthandName);
				if (!replacement) return;

				// Cache parent lookup
				const parent = node.parent;

				// Inline property access check
				if (
					allowPropertyAccess.has(shorthandName) &&
					parent &&
					isUnknownRecord(parent) &&
					parent.type === "MemberExpression" &&
					parent.property === node
				)
					return;

				// Special case: plr → localPlayer for Players.LocalPlayer
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
