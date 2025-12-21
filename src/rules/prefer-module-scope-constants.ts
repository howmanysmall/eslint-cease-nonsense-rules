import type { Rule, Scope } from "eslint";
import type { VariableDeclarator } from "estree";

// Pattern for SCREAMING_SNAKE_CASE: starts with uppercase, contains only uppercase, digits, and underscores
const SCREAMING_SNAKE_CASE = /^[A-Z][A-Z0-9_]*$/;

/**
 * Checks if the scope is at module/global level (top scope).
 * Handles both ES modules and CommonJS.
 * @param scope - The scope to check
 * @returns True if the scope is at module/global level
 */
function isTopScope(scope: Scope.Scope): boolean {
	const { type } = scope;

	if (type === "module" || type === "global") {
		return true;
	}

	// CommonJS wraps files in a function scope, but this is still conceptually "module scope"
	if (scope.upper?.type === "global") {
		const block = scope.upper.block as { sourceType?: string };
		if (block.sourceType === "commonjs") {
			return true;
		}
	}

	return false;
}

const preferModuleScopeConstants: Rule.RuleModule = {
	create(context) {
		let inConstDeclaration = false;

		return {
			VariableDeclaration(node) {
				inConstDeclaration = node.kind === "const";
			},
			"VariableDeclaration:exit"() {
				inConstDeclaration = false;
			},
			VariableDeclarator(node: VariableDeclarator) {
				const { id } = node;

				// Skip destructuring patterns - only check simple identifiers
				if (id.type !== "Identifier") return;

				// Skip if not SCREAMING_SNAKE_CASE
				if (!SCREAMING_SNAKE_CASE.test(id.name)) return;

				// Check if it's a const declaration
				if (!inConstDeclaration) {
					context.report({
						message:
							"You must use `const` when defining screaming snake case variables. If this is not a constant, use camelcase instead.",
						node,
					});
					return;
				}

				// Check if at module scope
				const scope = context.sourceCode.getScope(node);
				if (!isTopScope(scope)) {
					context.report({
						message:
							"You must place screaming snake case at module scope. If this is not meant to be a module-scoped variable, use camelcase instead.",
						node,
					});
				}
			},
		};
	},
	meta: {
		docs: {
			description:
				"Prefer that screaming snake case variables always be defined using `const`, and always appear at module scope.",
			recommended: true,
		},
		schema: [],
		type: "suggestion",
	},
};

export default preferModuleScopeConstants;
