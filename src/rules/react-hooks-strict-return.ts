import type { Rule, Scope } from "eslint";
import type {
	ArrowFunctionExpression,
	Expression,
	FunctionDeclaration,
	FunctionExpression,
	Node,
	ReturnStatement,
	SpreadElement,
	VariableDeclarator,
} from "estree";

const MAX_RETURN_ELEMENTS = 2;

// Pattern to match React hook names (useX where X is uppercase or digit)
const HOOK_PATTERN = /^use[A-Z0-9].*$/;

type FunctionNode = FunctionDeclaration | FunctionExpression | ArrowFunctionExpression;

/**
 * Checks if a node is a React hook based on its name.
 * @param node - The function or variable declarator node
 * @returns True if the node represents a React hook
 */
function isHookNode(node: FunctionNode | VariableDeclarator): boolean {
	let name: string | undefined;

	if (node.type === "VariableDeclarator" && node.id.type === "Identifier") {
		const { id } = node;
		({ name } = id);
	} else if (node.type === "FunctionDeclaration" && node.id) {
		const { id } = node;
		({ name } = id);
	} else if (
		node.type === "FunctionExpression" &&
		node.id
	) {
		const { id } = node;
		({ name } = id);
	} else if (
		node.type === "ArrowFunctionExpression" &&
		(node.parent as Node | undefined)?.type === "VariableDeclarator" &&
		(node.parent as VariableDeclarator).id.type === "Identifier"
	) {
		const { id } = node.parent as VariableDeclarator;
		({ name } = id);
	}

	return name !== undefined && HOOK_PATTERN.test(name);
}

/**
 * Gets a variable by name from the scope chain.
 * @param scope - The scope to search in
 * @param name - The variable name
 * @returns The variable if found, undefined otherwise
 */
function getVariableByName(scope: Scope.Scope, name: string): Scope.Variable | undefined {
	let current: Scope.Scope | null = scope;
	while (current) {
		const variable = current.set.get(name);
		if (variable) return variable;
		current = current.upper;
	}
	return undefined;
}

/**
 * Gets the elements from a variable's initializer if it's an array.
 * @param scope - The scope to search in
 * @param name - The variable name
 * @returns Array of elements from the variable's initializer
 */
function getArrayElementsFromVariable(scope: Scope.Scope, name: string): Array<Expression | SpreadElement | null> {
	const variable = getVariableByName(scope, name);
	if (!variable) return [];

	const elements: Array<Expression | SpreadElement | null> = [];

	for (const ref of variable.references) {
		const { identifier } = ref;
		if (!identifier.parent) continue;

		const parent = identifier.parent as VariableDeclarator;
		if (parent.type !== "VariableDeclarator") continue;
		if (!parent.init || parent.init.type !== "ArrayExpression") continue;

		elements.push(...parent.init.elements);
	}

	return elements;
}

/**
 * Counts the effective number of elements in a return value.
 * For spread elements, recursively resolves variable references.
 * @param argument - The return statement argument
 * @param scope - The scope to search for variable references
 * @returns The count of elements in the return value
 */
function countReturnElements(
	argument: Expression,
	scope: Scope.Scope,
): number {
	// Not an array - check if it's a variable reference to an array
	if (argument.type === "Identifier") {
		const elements = getArrayElementsFromVariable(scope, argument.name);
		return elements.length;
	}

	if (argument.type !== "ArrayExpression") {
		// Objects and other types are fine
		return 0;
	}

	let count = 0;
	for (const element of argument.elements) {
		if (element === null) {
			count++;
		} else if (element.type === "SpreadElement") {
			// Resolve spread elements
			if (element.argument.type === "Identifier") {
				const spreadElements = getArrayElementsFromVariable(scope, element.argument.name);
				count += spreadElements.length;
			} else if (element.argument.type === "ArrayExpression") {
				count += element.argument.elements.length;
			} else {
				// Unknown spread, count as 1
				count++;
			}
		} else {
			count++;
		}
	}

	return count;
}

/**
 * Checks if a return statement exceeds the maximum allowed return properties.
 * @param node - The return statement node
 * @param scope - The scope to search for variable references
 * @returns True if the return statement exceeds the maximum allowed properties
 */
function exceedsMaxReturnProperties(node: ReturnStatement, scope: Scope.Scope): boolean {
	const { argument } = node;
	if (argument === null || argument === undefined) return false;

	// Objects are always fine regardless of size
	if (argument.type === "ObjectExpression") return false;

	// Check if it's a variable reference to an object
	if (argument.type === "Identifier") {
		const variable = getVariableByName(scope, argument.name);
		if (variable) {
			for (const ref of variable.references) {
				const parent = ref.identifier.parent as VariableDeclarator;
				if (parent?.type === "VariableDeclarator" && parent.init?.type === "ObjectExpression") {
					return false;
				}
			}
		}
	}

	const elementCount = countReturnElements(argument, scope);
	return elementCount > MAX_RETURN_ELEMENTS;
}

const reactHooksStrictReturn: Rule.RuleModule = {
	create(context) {
		let hookDepth = 0;

		function enterHook(node: FunctionNode | VariableDeclarator): void {
			if (isHookNode(node)) {
				hookDepth++;
			}
		}

		function exitHook(node: FunctionNode | VariableDeclarator): void {
			if (isHookNode(node)) {
				hookDepth--;
			}
		}

		return {
			ArrowFunctionExpression(node): void {
				// Check if parent is a VariableDeclarator with hook name
				if ((node.parent as Node | undefined)?.type === "VariableDeclarator") {
					const parent = node.parent as VariableDeclarator;
					if (parent.id.type === "Identifier" && HOOK_PATTERN.test(parent.id.name)) {
						hookDepth++;
					}
				}
			},
			"ArrowFunctionExpression:exit"(node: ArrowFunctionExpression): void {
				if ((node.parent as Node | undefined)?.type === "VariableDeclarator") {
					const parent = node.parent as VariableDeclarator;
					if (parent.id.type === "Identifier" && HOOK_PATTERN.test(parent.id.name)) {
						hookDepth--;
					}
				}
			},
			FunctionDeclaration: enterHook,
			"FunctionDeclaration:exit": exitHook,
			FunctionExpression: enterHook,
			"FunctionExpression:exit": exitHook,
			ReturnStatement(node: ReturnStatement): void {
				if (hookDepth === 0) return;

				const scope = context.sourceCode.getScope(node);
				if (exceedsMaxReturnProperties(node, scope)) {
					context.report({
						messageId: "hooksStrictReturn",
						node,
					});
				}
			},
			VariableDeclarator: enterHook,
			"VariableDeclarator:exit": exitHook,
		};
	},
	meta: {
		docs: {
			description: "Restrict the number of returned items from React hooks.",
			recommended: true,
		},
		messages: {
			hooksStrictReturn: "React hooks must return a tuple of two or fewer values or a single object.",
		},
		schema: [],
		type: "suggestion",
	},
};

export default reactHooksStrictReturn;
