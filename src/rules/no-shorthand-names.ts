import type { Rule } from "eslint";

interface ShorthandInfo {
	shorthand: string;
	replacement: string;
	messageId: "useLocalPlayer" | "usePlayer" | "useParameters" | "useDeltaTime" | "useCharacter";
}

const SHORTHANDS: readonly ShorthandInfo[] = [
	{ messageId: "useParameters", replacement: "parameters", shorthand: "args" },
	{ messageId: "useDeltaTime", replacement: "deltaTime", shorthand: "dt" },
	{ messageId: "useCharacter", replacement: "character", shorthand: "char" },
] as const;

/**
 * Checks if a node is Players.LocalPlayer member expression.
 *
 * @param node - The node to check.
 * @returns True if node is Players.LocalPlayer.
 */
function isPlayersLocalPlayer(node: unknown): boolean {
	if (!node || typeof node !== "object") return false;
	const n = node as { type?: string; object?: unknown; property?: unknown };
	if (n.type !== "MemberExpression") return false;

	const obj = n.object;
	const prop = n.property;
	if (!obj || typeof obj !== "object" || !prop || typeof prop !== "object") return false;

	const objNode = obj as { type?: string; name?: string };
	const propNode = prop as { type?: string; name?: string };

	return (
		objNode.type === "Identifier" &&
		objNode.name === "Players" &&
		propNode.type === "Identifier" &&
		propNode.name === "LocalPlayer"
	);
}

/**
 * Checks if an identifier is used as a property access.
 *
 * @param node - The identifier node to check.
 * @returns True if the identifier is a property in a member expression.
 */
function isPropertyAccess(node: { parent?: unknown }): boolean {
	const parent = node.parent;
	if (!parent || typeof parent !== "object") return false;

	const p = parent as { type?: string; property?: unknown };
	return p.type === "MemberExpression" && p.property === node;
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
		return {
			Identifier(node) {
				const name = node.name;

				// Special case: plr
				if (name === "plr") {
					// Skip if it's a property access
					if (isPropertyAccess(node)) return;

					// Check if this is a variable declarator with Players.LocalPlayer
					const parent = node.parent;
					if (
						parent?.type === "VariableDeclarator" &&
						parent.id === node &&
						isPlayersLocalPlayer(parent.init)
					) {
						context.report({
							messageId: "useLocalPlayer",
							node,
						});
						return;
					}

					// Default case: use player
					context.report({
						messageId: "usePlayer",
						node,
					});
					return;
				}

				// Check other shorthands
				for (const { messageId, shorthand } of SHORTHANDS) {
					if (name === shorthand) {
						// Special case: char - skip property access
						if (shorthand === "char" && isPropertyAccess(node)) continue;

						context.report({
							messageId,
							node,
						});
						return;
					}
				}
			},
		};
	},
	meta: {
		docs: {
			description: "Ban shorthand variable names. Use descriptive full names instead.",
			recommended: false,
		},
		messages: {
			useCharacter: "Use 'character' instead of 'char' shorthand",
			useDeltaTime: "Use 'deltaTime' instead of 'dt' shorthand",
			useLocalPlayer: "Use 'localPlayer' instead of 'plr' when assigning Players.LocalPlayer",
			useParameters: "Use 'parameters' instead of 'args' shorthand",
			usePlayer: "Use 'player' instead of 'plr' shorthand",
		},
		schema: [],
		type: "suggestion",
	},
};

export default noShorthandNames;
