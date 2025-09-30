import type { TSESTree } from "@typescript-eslint/types";
import type { Rule } from "eslint";

/**
 * Configuration options for the require-react-component-keys rule.
 */
interface RuleOptions {
	ignoreCallExpressions?: string[];
	allowRootKeys?: boolean;
	requireKeysForSingleChildren?: boolean;
}

/**
 * Default configuration values for the rule.
 */
const DEFAULT_OPTIONS: Required<RuleOptions> = {
	allowRootKeys: false,
	ignoreCallExpressions: ["ReactTree.mount"],
	requireKeysForSingleChildren: false,
};

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

/**
 * Checks if a JSX element is an argument to an ignored call expression.
 *
 * @param node - The JSX element or fragment to check.
 * @param ignoreList - List of function names to ignore.
 * @returns True if the element is passed to an ignored function.
 */
function isIgnoredCallExpression(node: TSESTree.JSXElement | TSESTree.JSXFragment, ignoreList: string[]): boolean {
	let parent: TSESTree.Node | undefined = node.parent;
	if (!parent) return false;

	// Traverse up to find CallExpression
	while (parent && parent.type !== "CallExpression") {
		// Stop if we hit a JSX boundary (element is a child of JSX)
		if (parent.type === "JSXElement" || parent.type === "JSXFragment") return false;
		parent = parent.parent;
		if (!parent) break;
	}

	if (!parent || parent.type !== "CallExpression") return false;

	const callExpr = parent;
	const { callee } = callExpr;

	// Check for simple identifier calls: mount(...)
	if (callee.type === "Identifier" && ignoreList.includes(callee.name)) return true;

	// Check for member expression calls: ReactTree.mount(...)
	if (callee.type === "MemberExpression") {
		const memberExpr = callee;
		if (memberExpr.object.type === "Identifier" && memberExpr.property.type === "Identifier") {
			const fullName = `${memberExpr.object.name}.${memberExpr.property.name}`;
			return ignoreList.includes(fullName);
		}
	}

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
		const options: Required<RuleOptions> = {
			...DEFAULT_OPTIONS,
			...context.options[0],
		};
		const returnStack = new Array<{ node: TSESTree.Node; depth: number }>();

		/**
		 * Checks a JSX element or fragment for required key prop.
		 *
		 * @param node - The JSX element or fragment to check.
		 */
		function checkElement(node: TSESTree.JSXElement | TSESTree.JSXFragment): void {
			const isRoot = isTopLevelReturn(node);
			const isIgnored = isIgnoredCallExpression(node, options.ignoreCallExpressions);

			// Check if root component has a key (and it's not allowed)
			if (isRoot && !options.allowRootKeys && node.type === "JSXElement" && hasKeyAttribute(node)) {
				context.report({
					messageId: "rootComponentWithKey",
					node,
				});
				return;
			}

			// Skip key requirement for root returns and ignored call expressions
			if (isRoot || isIgnored) return;

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
			rootComponentWithKey: "Root component returns should not have key props",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					allowRootKeys: {
						default: false,
						description: "Allow key props on root component returns",
						type: "boolean",
					},
					ignoreCallExpressions: {
						default: ["ReactTree.mount"],
						description: "Function calls where JSX arguments don't need keys",
						items: { type: "string" },
						type: "array",
					},
					requireKeysForSingleChildren: {
						default: false,
						description: "Require keys even for single children",
						type: "boolean",
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
};

export default requireReactComponentKeys;
