import type { TSESTree } from "@typescript-eslint/types";
import type { Rule } from "eslint";

/**
 * Context tracking for control flow analysis.
 */
interface ControlFlowContext {
	readonly inConditional: boolean;
	readonly afterEarlyReturn: boolean;
	readonly inLoop: boolean;
	readonly inNestedFunction: boolean;
	readonly inTryBlock: boolean;
	readonly functionDepth: number;
	readonly isComponentOrHook: boolean;
}

/**
 * Pre-compiled regex for hook name detection (performance optimization).
 */
const HOOK_NAME_PATTERN = /^use[A-Z]/;

/**
 * Pre-compiled regex for component name detection (performance optimization).
 */
const COMPONENT_NAME_PATTERN = /^[A-Z]/;

/**
 * Checks if a function name matches the React hook naming convention.
 *
 * @param name - The function name to check.
 * @returns True if the name starts with "use" followed by an uppercase letter.
 */
function isReactHook(name: string): boolean {
	return HOOK_NAME_PATTERN.test(name);
}

/**
 * Checks if a function name matches the React component naming convention.
 *
 * @param name - The function name to check.
 * @returns True if the name starts with an uppercase letter.
 */
function isComponent(name: string): boolean {
	return COMPONENT_NAME_PATTERN.test(name);
}

/**
 * Determines if a function is a React component or custom hook.
 *
 * @param node - The function node to check.
 * @returns True if the function is a component or hook.
 */
function isComponentOrHook(
	node: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression,
): boolean {
	// Function declarations with names
	if (node.type === "FunctionDeclaration" && node.id) {
		const { name } = node.id;
		return isComponent(name) || isReactHook(name);
	}

	// Function expressions and arrow functions: check parent context
	if (node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression") {
		const { parent } = node;
		if (!parent) return false;

		// Variable declarator: const Component = () => {}
		if (parent.type === "VariableDeclarator" && parent.id.type === "Identifier") {
			const { name } = parent.id;
			return isComponent(name) || isReactHook(name);
		}

		// Property: { Component: () => {} }
		if (parent.type === "Property" && parent.key.type === "Identifier") {
			const { name } = parent.key;
			return isComponent(name) || isReactHook(name);
		}

		// Method definition: class { Component() {} }
		if (parent.type === "MethodDefinition" && parent.key.type === "Identifier") {
			const { name } = parent.key;
			return isComponent(name) || isReactHook(name);
		}
	}

	return false;
}

/**
 * Checks if a call expression is a hook call.
 *
 * @param node - The call expression node.
 * @returns True if the call is a hook.
 */
function isHookCall(node: TSESTree.CallExpression): boolean {
	const { callee } = node;

	// Direct call: useEffect(...)
	if (callee.type === "Identifier") {
		return isReactHook(callee.name);
	}

	// Member expression: React.useEffect(...)
	if (callee.type === "MemberExpression" && callee.property.type === "Identifier") {
		return isReactHook(callee.property.name);
	}

	return false;
}

/**
 * Checks if a node is inside a finally block.
 *
 * @param node - The node to check.
 * @returns True if the node is in a finally block.
 */
function isInFinallyBlock(node: TSESTree.Node): boolean {
	let current: TSESTree.Node | undefined = node.parent;
	const maxDepth = 20;

	for (let depth = 0; depth < maxDepth && current; depth++) {
		// Stop at function boundaries
		if (
			current.type === "FunctionDeclaration" ||
			current.type === "FunctionExpression" ||
			current.type === "ArrowFunctionExpression"
		) {
			return false;
		}

		// Found try statement - check if we're in the finalizer
		if (current.type === "TryStatement") {
			// Walk back down to see which block we're in
			let checkNode: TSESTree.Node | undefined = node;
			while (checkNode && checkNode !== current) {
				if (checkNode === current.finalizer) return true;
				checkNode = checkNode.parent;
			}
			return false;
		}

		current = current.parent;
	}

	return false;
}

/**
 * Checks if a call expression is recursive (calls itself).
 *
 * @param node - The call expression node.
 * @param functionName - The name of the containing function.
 * @returns True if the call is recursive.
 */
function isRecursiveCall(node: TSESTree.CallExpression, functionName: string | undefined): boolean {
	if (!functionName) return false;

	const { callee } = node;
	if (callee.type === "Identifier") {
		return callee.name === functionName;
	}

	return false;
}

const useHookAtTopLevel: Rule.RuleModule = {
	create(context) {
		// Context stack for tracking control flow
		const contextStack: ControlFlowContext[] = [];
		let currentFunctionName: string | undefined;

		/**
		 * Gets the current control flow context.
		 *
		 * @returns The current context or undefined if not in a component/hook.
		 */
		function getCurrentContext(): ControlFlowContext | undefined {
			return contextStack.length > 0 ? contextStack[contextStack.length - 1] : undefined;
		}

		/**
		 * Pushes a new context onto the stack.
		 *
		 * @param newContext - The context to push.
		 */
		function pushContext(newContext: ControlFlowContext): void {
			contextStack.push(newContext);
		}

		/**
		 * Pops the top context from the stack.
		 */
		function popContext(): void {
			contextStack.pop();
		}

		/**
		 * Updates the current context with new flags.
		 *
		 * @param updates - Partial context updates.
		 */
		function updateContext(updates: Partial<ControlFlowContext>): void {
			const current = getCurrentContext();
			if (!current) return;

			contextStack[contextStack.length - 1] = {
				...current,
				...updates,
			};
		}

		/**
		 * Handles function entry (component or hook).
		 *
		 * @param node - The function node.
		 */
		function handleFunctionEnter(node: unknown): void {
			const funcNode = node as
				| TSESTree.FunctionDeclaration
				| TSESTree.FunctionExpression
				| TSESTree.ArrowFunctionExpression;
			const current = getCurrentContext();
			const depth = current ? current.functionDepth + 1 : 0;

			// Check if this is a component or hook
			const isComp = isComponentOrHook(funcNode);

			// Store function name for recursion detection
			if (funcNode.type === "FunctionDeclaration" && funcNode.id) {
				currentFunctionName = funcNode.id.name;
			}

			// If we're already inside a component/hook, this is a nested function
			if (current?.isComponentOrHook) {
				pushContext({
					afterEarlyReturn: false,
					functionDepth: depth,
					inConditional: false,
					inLoop: false,
					inNestedFunction: true,
					inTryBlock: false,
					isComponentOrHook: false,
				});
			} else if (isComp) {
				// This is a top-level component or hook
				pushContext({
					afterEarlyReturn: false,
					functionDepth: depth,
					inConditional: false,
					inLoop: false,
					inNestedFunction: false,
					inTryBlock: false,
					isComponentOrHook: true,
				});
			}
		}

		/**
		 * Handles function exit.
		 */
		function handleFunctionExit(): void {
			const current = getCurrentContext();
			if (current) {
				popContext();
			}
			currentFunctionName = undefined;
		}

		return {
			// Function entry
			FunctionDeclaration: handleFunctionEnter,
			FunctionExpression: handleFunctionEnter,
			ArrowFunctionExpression: handleFunctionEnter,

			// Function exit
			"FunctionDeclaration:exit": handleFunctionExit,
			"FunctionExpression:exit": handleFunctionExit,
			"ArrowFunctionExpression:exit": handleFunctionExit,

			// Conditional statements
			IfStatement() {
				updateContext({ inConditional: true });
			},
			"IfStatement:exit"() {
				updateContext({ inConditional: false });
			},

			SwitchStatement() {
				updateContext({ inConditional: true });
			},
			"SwitchStatement:exit"() {
				updateContext({ inConditional: false });
			},

			ConditionalExpression() {
				updateContext({ inConditional: true });
			},
			"ConditionalExpression:exit"() {
				updateContext({ inConditional: false });
			},

			LogicalExpression() {
				updateContext({ inConditional: true });
			},
			"LogicalExpression:exit"() {
				updateContext({ inConditional: false });
			},

			// Early returns - set flag on exit so hooks IN the return expression aren't flagged
			"ReturnStatement:exit"() {
				updateContext({ afterEarlyReturn: true });
			},

			// Loops
			ForStatement() {
				updateContext({ inLoop: true });
			},
			"ForStatement:exit"() {
				updateContext({ inLoop: false });
			},

			WhileStatement() {
				updateContext({ inLoop: true });
			},
			"WhileStatement:exit"() {
				updateContext({ inLoop: false });
			},

			DoWhileStatement() {
				updateContext({ inLoop: true });
			},
			"DoWhileStatement:exit"() {
				updateContext({ inLoop: false });
			},

			ForInStatement() {
				updateContext({ inLoop: true });
			},
			"ForInStatement:exit"() {
				updateContext({ inLoop: false });
			},

			ForOfStatement() {
				updateContext({ inLoop: true });
			},
			"ForOfStatement:exit"() {
				updateContext({ inLoop: false });
			},

			// Try blocks
			TryStatement() {
				// Mark entering try block (but not finally)
				updateContext({ inTryBlock: true });
			},
			"TryStatement:exit"() {
				updateContext({ inTryBlock: false });
			},

			// Hook calls
			CallExpression(node) {
				const callNode = node as unknown as TSESTree.CallExpression;

				// Early exit: not a hook call
				if (!isHookCall(callNode)) return;

				const current = getCurrentContext();

				// Early exit: not in any tracked context
				if (!current) return;

				// Early exit: not in a component/hook and not in a nested function
				if (!current.isComponentOrHook && !current.inNestedFunction) return;

				// Allow hooks in finally blocks (they always execute)
				if (isInFinallyBlock(callNode)) return;

				// Check for recursion
				if (isRecursiveCall(callNode, currentFunctionName)) {
					context.report({
						messageId: "recursiveHookCall",
						node: callNode,
					});
					return;
				}

				// Check for nested function
				if (current.inNestedFunction) {
					context.report({
						messageId: "nestedFunction",
						node: callNode,
					});
					return;
				}

				// Check for conditional execution
				if (current.inConditional) {
					context.report({
						messageId: "conditionalHook",
						node: callNode,
					});
					return;
				}

				// Check for loops
				if (current.inLoop) {
					context.report({
						messageId: "loopHook",
						node: callNode,
					});
					return;
				}

				// Check for try blocks
				if (current.inTryBlock) {
					context.report({
						messageId: "tryBlockHook",
						node: callNode,
					});
					return;
				}

				// Check for early return (this should be caught by conditional, but double-check)
				if (current.afterEarlyReturn) {
					context.report({
						messageId: "afterEarlyReturn",
						node: callNode,
					});
				}
			},
		};
	},
	meta: {
		docs: {
			description:
				"Enforce that React hooks are only called at the top level of components or custom hooks, never conditionally or in nested functions",
			recommended: true,
			url: "https://react.dev/reference/rules/rules-of-hooks",
		},
		messages: {
			afterEarlyReturn:
				"This hook is being called after an early return. Hooks must be called unconditionally and in the same order every render.",
			conditionalHook:
				"This hook is being called conditionally. All hooks must be called in the exact same order in every component render.",
			loopHook:
				"This hook is being called inside a loop. All hooks must be called in the exact same order in every component render.",
			nestedFunction:
				"This hook is being called from a nested function. All hooks must be called unconditionally from the top-level component.",
			recursiveHookCall:
				"This hook is being called recursively. Recursive calls require a condition to terminate, which violates hook rules.",
			tryBlockHook:
				"This hook is being called inside a try block. Hooks must be called unconditionally at the top level.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					hooks: {
						description: "Additional custom hook names to check",
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

export default useHookAtTopLevel;
