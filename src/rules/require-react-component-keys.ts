import type { TSESTree } from "@typescript-eslint/types";
import type { Rule } from "eslint";

/**
 * Configuration options for the require-react-component-keys rule.
 */
interface RuleOptions {
	ignoreCallExpressions?: string[];
	allowRootKeys?: boolean;
}

/**
 * Default configuration values for the rule.
 */
const DEFAULT_OPTIONS: Required<RuleOptions> = {
	allowRootKeys: false,
	ignoreCallExpressions: ["ReactTree.mount"],
};

/**
 * Checks if a JSX element has a key attribute.
 *
 * @param node - The JSX element to check.
 * @returns True if the element has a key attribute.
 */
function hasKeyAttribute(node: TSESTree.JSXElement): boolean {
	for (const attr of node.openingElement.attributes) {
		if (attr.type === "JSXAttribute" && attr.name.name === "key") return true;
	}
	return false;
}

/**
 * Checks if a JSX element is a top-level return from a component.
 *
 * @param node - The JSX element or fragment to check.
 * @returns True if the element is directly returned from a component.
 */
function isTopLevelReturn(node: TSESTree.JSXElement | TSESTree.JSXFragment): boolean {
	let parent = node.parent;
	if (!parent) return false;

	// Handle return with parentheses: return (<div>...)
	if (parent.type === "JSXExpressionContainer") parent = parent.parent;
	if (!parent) return false;

	// Traverse through conditional and logical expressions
	// Example: return condition ? <A/> : <B/>
	// Example: return condition && <Component/>
	while (parent && (parent.type === "ConditionalExpression" || parent.type === "LogicalExpression")) {
		parent = parent.parent;
	}

	if (!parent) return false;

	// Handle direct return
	if (parent.type === "ReturnStatement") return true;

	// Handle arrow function direct return: () => <div>
	return parent.type === "ArrowFunctionExpression" && parent.parent?.type !== "CallExpression";
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

	// Handle JSXExpressionContainer wrapper
	if (parent.type === "JSXExpressionContainer") {
		parent = parent.parent;
		if (!parent) return false;
	}

	// Traverse up to find CallExpression
	const maxDepth = 10;
	for (let depth = 0; depth < maxDepth && parent; depth++) {
		const { type } = parent;

		// Found CallExpression - check if it's in the ignore list
		if (type === "CallExpression") {
			const { callee } = parent;

			// Simple identifier: mount(...)
			if (callee.type === "Identifier") return ignoreList.includes(callee.name);

			// Member expression: ReactTree.mount(...)
			if (
				callee.type === "MemberExpression" &&
				callee.object.type === "Identifier" &&
				callee.property.type === "Identifier"
			) {
				return ignoreList.includes(`${callee.object.name}.${callee.property.name}`);
			}

			return false;
		}

		// Stop at JSX or function boundaries
		if (
			type === "JSXElement" ||
			type === "JSXFragment" ||
			type === "FunctionDeclaration" ||
			type === "FunctionExpression" ||
			type === "ArrowFunctionExpression"
		) {
			return false;
		}

		parent = parent.parent;
	}

	return false;
}

/**
 * Checks if a JSX element is passed as a prop value.
 *
 * @param node - The JSX element or fragment to check.
 * @returns True if the element is passed as a prop value.
 */
function isJSXPropValue(node: TSESTree.JSXElement | TSESTree.JSXFragment): boolean {
	let parent = node.parent;
	if (!parent) return false;

	// Traverse through conditional and logical expressions
	// Example: fallback={condition ? <A/> : <B/>}
	// Example: fallback={placeholder ?? <></>}
	while (parent && (parent.type === "ConditionalExpression" || parent.type === "LogicalExpression")) {
		parent = parent.parent;
	}

	if (!parent) return false;

	// Handle JSXExpressionContainer wrapper: prop={<div/>}
	if (parent.type === "JSXExpressionContainer") {
		parent = parent.parent;
		if (!parent) return false;
	}

	// Check if parent is a JSXAttribute (prop)
	return parent.type === "JSXAttribute";
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

		/**
		 * Checks a JSX element or fragment for required key prop.
		 *
		 * @param node - The JSX element or fragment to check.
		 */
		function checkElement(node: TSESTree.JSXElement | TSESTree.JSXFragment): void {
			const isRoot = isTopLevelReturn(node);

			// Check if root component has a key (and it's not allowed)
			if (isRoot) {
				if (!options.allowRootKeys && node.type === "JSXElement" && hasKeyAttribute(node)) {
					context.report({
						messageId: "rootComponentWithKey",
						node,
					});
				}
				return;
			}

			// Skip key requirement for ignored call expressions
			if (isIgnoredCallExpression(node, options.ignoreCallExpressions)) return;

			// Skip key requirement for JSX passed as props
			if (isJSXPropValue(node)) return;

			// Fragments always need keys when not top-level
			if (node.type === "JSXFragment") {
				context.report({
					messageId: "missingKey",
					node,
				});
				return;
			}

			// Check if element has key
			if (!hasKeyAttribute(node)) {
				context.report({
					messageId: "missingKey",
					node,
				});
			}
		}

		return {
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
			recommended: true,
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
				},
				type: "object",
			},
		],
		type: "problem",
	},
};

export default requireReactComponentKeys;
