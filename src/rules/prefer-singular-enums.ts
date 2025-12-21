import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

type MessageIds = "notSingular";

// Irregular plural words that don't follow standard patterns
const IRREGULAR_PLURALS = new Set([
	"Children",
	"Dice",
	"Feet",
	"Geese",
	"Men",
	"Mice",
	"People",
	"Teeth",
	"Women",
]);

/**
 * Checks if a word is likely plural.
 *
 * Handles:
 * - Irregular plurals (Feet, People, Children, etc.)
 * - Regular -s suffix (excluding -ss, -us, -is endings which are often singular)
 * @param name - The word to check
 * @returns True if the word appears to be plural
 */
function isPlural(name: string): boolean {
	// Check irregular plurals
	if (IRREGULAR_PLURALS.has(name)) {
		return true;
	}

	// Regular plurals end in 's' but not:
	// - 'ss' (class, mass, etc.)
	// - 'us' (status, radius, alias, etc.)
	// - 'is' (analysis, axis, etc.)
	// - 'es' after certain consonants needs more context, but we keep it simple
	if (name.endsWith("s")) {
		if (name.endsWith("ss")) return false;
		if (name.endsWith("us")) return false;
		if (name.endsWith("is")) return false;
		return true;
	}

	return false;
}

const preferSingularEnums: TSESLint.RuleModuleWithMetaDocs<MessageIds> = {
	create(context) {
		return {
			TSEnumDeclaration(node: TSESTree.TSEnumDeclaration) {
				const { name } = node.id;

				if (isPlural(name)) {
					context.report({
						data: { name },
						message: `Enum '{{ name }}' should be singular.`,
						node,
					});
				}
			},
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description: "Prefer singular TypeScript enums.",
		},
		messages: {
			notSingular: "Enum '{{ name }}' should be singular.",
		},
		schema: [],
		type: "suggestion",
	},
};

export default preferSingularEnums;
