import { TSESTree } from "@typescript-eslint/types";
import type { Rule } from "eslint";

/*
 * Rule: use-hook-at-top-level
 * Tracks a small control-flow context stack for component/hook functions
 * to detect hooks used conditionally, inside loops, nested functions, try
 * blocks, or after early returns. Finally blocks are allowed (they always run),
 * and recursion is treated as a violation because it implies conditional
 * termination and non-deterministic hook ordering.
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

const HOOK_NAME_PATTERN = /^use[A-Z]/;
const COMPONENT_NAME_PATTERN = /^[A-Z]/;
function isReactHook(name: string): boolean {
	return HOOK_NAME_PATTERN.test(name);
}

function isComponent(name: string): boolean {
	return COMPONENT_NAME_PATTERN.test(name);
}

function isComponentOrHook(
	node: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression,
): boolean {
	if (node.type === TSESTree.AST_NODE_TYPES.FunctionDeclaration && node.id) {
		const { name } = node.id;
		return isComponent(name) || isReactHook(name);
	}

	if (
		node.type === TSESTree.AST_NODE_TYPES.FunctionExpression ||
		node.type === TSESTree.AST_NODE_TYPES.ArrowFunctionExpression
	) {
		const { parent } = node;
		if (!parent) return false;

		if (
			parent.type === TSESTree.AST_NODE_TYPES.VariableDeclarator &&
			parent.id.type === TSESTree.AST_NODE_TYPES.Identifier
		) {
			const { name } = parent.id;
			return isComponent(name) || isReactHook(name);
		}

		if (
			parent.type === TSESTree.AST_NODE_TYPES.Property &&
			parent.key.type === TSESTree.AST_NODE_TYPES.Identifier
		) {
			const { name } = parent.key;
			return isComponent(name) || isReactHook(name);
		}

		if (
			parent.type === TSESTree.AST_NODE_TYPES.MethodDefinition &&
			parent.key.type === TSESTree.AST_NODE_TYPES.Identifier
		) {
			const { name } = parent.key;
			return isComponent(name) || isReactHook(name);
		}
	}

	return false;
}

function isHookCall(node: TSESTree.CallExpression): boolean {
	const { callee } = node;

	if (callee.type === TSESTree.AST_NODE_TYPES.Identifier) return isReactHook(callee.name);

	if (
		callee.type === TSESTree.AST_NODE_TYPES.MemberExpression &&
		callee.property.type === TSESTree.AST_NODE_TYPES.Identifier
	)
		return isReactHook(callee.property.name);

	return false;
}

const FUNCTION_BOUNDARIES = new Set<TSESTree.AST_NODE_TYPES>([
	TSESTree.AST_NODE_TYPES.FunctionDeclaration,
	TSESTree.AST_NODE_TYPES.FunctionExpression,
	TSESTree.AST_NODE_TYPES.ArrowFunctionExpression,
]);

function isInFinallyBlock(node: TSESTree.Node): boolean {
	let current: TSESTree.Node | undefined = node.parent;
	const maxDepth = 20;

	for (let depth = 0; depth < maxDepth && current; depth += 1) {
		if (FUNCTION_BOUNDARIES.has(current.type)) return false;

		if (current.type === TSESTree.AST_NODE_TYPES.TryStatement) {
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

function isRecursiveCall(node: TSESTree.CallExpression, functionName: string | undefined): boolean {
	if (!functionName) return false;

	const { callee } = node;
	if (callee.type === "Identifier") return callee.name === functionName;

	return false;
}

const useHookAtTopLevel: Rule.RuleModule = {
	create(context) {
		const contextStack = new Array<ControlFlowContext>();
		let currentFunctionName: string | undefined;

		function getCurrentContext(): ControlFlowContext | undefined {
			return contextStack.length > 0 ? contextStack.at(-1) : undefined;
		}
		function pushContext(newContext: ControlFlowContext): void {
			contextStack.push(newContext);
		}
		function popContext(): void {
			contextStack.pop();
		}
		function updateContext(updates: Partial<ControlFlowContext>): void {
			const current = getCurrentContext();
			if (current) contextStack[contextStack.length - 1] = { ...current, ...updates };
		}

		function handleFunctionEnter(node: unknown): void {
			const funcNode = node as
				| TSESTree.FunctionDeclaration
				| TSESTree.FunctionExpression
				| TSESTree.ArrowFunctionExpression;
			const current = getCurrentContext();
			const depth = current ? current.functionDepth + 1 : 0;

			const isComp = isComponentOrHook(funcNode);

			if (funcNode.type === TSESTree.AST_NODE_TYPES.FunctionDeclaration && funcNode.id)
				currentFunctionName = funcNode.id.name;

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
		function handleFunctionExit(): void {
			const current = getCurrentContext();
			if (current) popContext();
			currentFunctionName = undefined;
		}

		return {
			ArrowFunctionExpression: handleFunctionEnter,
			"ArrowFunctionExpression:exit": handleFunctionExit,

			CallExpression(node) {
				const callNode = node as unknown as TSESTree.CallExpression;

				if (!isHookCall(callNode)) return;

				const current = getCurrentContext();

				if (!current) return;

				if (!current.isComponentOrHook && !current.inNestedFunction) return;

				if (isInFinallyBlock(callNode)) return;

				if (isRecursiveCall(callNode, currentFunctionName)) {
					context.report({
						messageId: "recursiveHookCall",
						node: callNode,
					});
					return;
				}

				if (current.inNestedFunction) {
					context.report({
						messageId: "nestedFunction",
						node: callNode,
					});
					return;
				}

				if (current.inConditional) {
					context.report({
						messageId: "conditionalHook",
						node: callNode,
					});
					return;
				}

				if (current.inLoop) {
					context.report({
						messageId: "loopHook",
						node: callNode,
					});
					return;
				}

				if (current.inTryBlock) {
					context.report({
						messageId: "tryBlockHook",
						node: callNode,
					});
					return;
				}

				if (current.afterEarlyReturn) {
					context.report({
						messageId: "afterEarlyReturn",
						node: callNode,
					});
				}
			},

			ConditionalExpression() {
				updateContext({ inConditional: true });
			},
			"ConditionalExpression:exit"() {
				updateContext({ inConditional: false });
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

			ForStatement() {
				updateContext({ inLoop: true });
			},
			"ForStatement:exit"() {
				updateContext({ inLoop: false });
			},
			FunctionDeclaration: handleFunctionEnter,

			"FunctionDeclaration:exit": handleFunctionExit,
			FunctionExpression: handleFunctionEnter,
			"FunctionExpression:exit": handleFunctionExit,

			IfStatement() {
				updateContext({ inConditional: true });
			},
			"IfStatement:exit"() {
				updateContext({ inConditional: false });
			},

			LogicalExpression() {
				updateContext({ inConditional: true });
			},
			"LogicalExpression:exit"() {
				updateContext({ inConditional: false });
			},

			"ReturnStatement:exit"() {
				updateContext({ afterEarlyReturn: true });
			},

			SwitchStatement() {
				updateContext({ inConditional: true });
			},
			"SwitchStatement:exit"() {
				updateContext({ inConditional: false });
			},

			TryStatement() {
				updateContext({ inTryBlock: true });
			},
			"TryStatement:exit"() {
				updateContext({ inTryBlock: false });
			},

			WhileStatement() {
				updateContext({ inLoop: true });
			},
			"WhileStatement:exit"() {
				updateContext({ inLoop: false });
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
