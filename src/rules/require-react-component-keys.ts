import type { TSESTree } from "@typescript-eslint/types";
import type { Rule } from "eslint";

/**
 * Checks if a JSX element has a key attribute.
 *
 * @param node - The JSX element to check.
 * @returns True if the element has a key attribute.
 */
function hasKeyAttribute(node: TSESTree.JSXElement): boolean {
	return node.openingElement.attributes.some((attr) => attr.type === "JSXAttribute" && attr.name.name === "key");
}

/**
 * Checks if a JSX element is a top-level return from a component.
 *
 * @param node - The JSX element or fragment to check.
 * @returns True if the element is directly returned from a component.
 */
function isTopLevelReturn(node: TSESTree.JSXElement | TSESTree.JSXFragment): boolean {
	// Check if this element is a direct child of a return statement
	let parent = node.parent;
	if (!parent) return false;

	// Handle return with parentheses: return (<div>...)
	if (parent.type === "JSXExpressionContainer") parent = parent.parent;

	// Handle direct return
	if (parent?.type === "ReturnStatement") return true;

	// Handle arrow function direct return: () => <div>
	if (parent?.type === "ArrowFunctionExpression") return true;

	return false;
}

const requireReactComponentKeys: Rule.RuleModule = {
	/**
	 * Creates the ESLint rule visitor.
	 *
	 * @param context - The ESLint rule context.
	 * @returns The visitor object with AST node handlers.
	 */
	create(context) {
		const returnStack = new Array<{ node: TSESTree.Node; depth: number }>();

		/**
		 * Checks a JSX element or fragment for required key prop.
		 *
		 * @param node - The JSX element or fragment to check.
		 */
		function checkElement(node: TSESTree.JSXElement | TSESTree.JSXFragment): void {
			// Top-level return doesn't need key
			if (isTopLevelReturn(node)) return;

			// Fragments always need keys when not top-level
			if (node.type === "JSXFragment") {
				context.report({
					messageId: "missingKey",
					node,
				});
				return;
			}

			// Check if element has key
			if (hasKeyAttribute(node)) return;
			context.report({
				messageId: "missingKey",
				node,
			});
		}

		return {
			// Track function/component boundaries for top-level detection
			"FunctionDeclaration, FunctionExpression, ArrowFunctionExpression"(node: TSESTree.Node) {
				returnStack.push({ depth: returnStack.length, node });
			},

			"FunctionDeclaration, FunctionExpression, ArrowFunctionExpression:exit"() {
				returnStack.pop();
			},

			// Check JSX elements
			JSXElement(node) {
				checkElement(node);
			},

			// Check JSX fragments
			JSXFragment(node) {
				checkElement(node);
			},
		};
	},
	meta: {
		docs: {
			description: "Enforce key props on all React elements except top-level returns",
			recommended: false,
		},
		fixable: undefined,
		messages: {
			missingKey: "All React elements except top-level returns require a key prop",
		},
		schema: [],
		type: "problem",
	},
};

export default requireReactComponentKeys;
