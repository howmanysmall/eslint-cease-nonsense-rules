import { createRule } from "$utilities/create-rule";
import { AST_NODE_TYPES } from "@typescript-eslint/types";

import type { TSESTree } from "@typescript-eslint/types";

/*
 * Rule: use-hook-at-top-level
 * Tracks a small control-flow context stack for component/hook functions
 * to detect hooks used conditionally, inside loops, nested functions, try
 * blocks, or after early returns. Finally blocks are allowed (they always run),
 * and recursion is treated as a violation because it implies conditional
 * termination and non-deterministic hook ordering.
 */

interface ControlFlowContext {
	readonly afterEarlyReturn: boolean;
	readonly functionDepth: number;
	readonly inConditional: boolean;
	readonly inLoop: boolean;
	readonly inNestedFunction: boolean;
	readonly inTryBlock: boolean;
	readonly isComponentOrHook: boolean;
}

export interface UseHookAtTopLevelOptions {
	/** Strategy 1: Simple name-based filtering Hooks to completely ignore (both React and ECS hooks with these names) */
	readonly ignoreHooks?: ReadonlyArray<string>;

	/**
	 * Strategy 2: Smart import source control Control which import sources should be checked true = check hooks from
	 * this source, false = ignore hooks from this source
	 */
	readonly importSources?: Record<string, boolean>;

	/**
	 * Strategy 3: Whitelist mode Only check hooks that match these exact names If provided, ignoreHooks and
	 * importSources are ignored
	 */
	readonly onlyHooks?: ReadonlyArray<string>;
}

const HOOK_NAME_PATTERN = /^use[A-Z]/u;
const COMPONENT_NAME_PATTERN = /^[A-Z]/u;
function isReactHook(name: string): boolean {
	return HOOK_NAME_PATTERN.test(name);
}

function isComponent(name: string): boolean {
	return COMPONENT_NAME_PATTERN.test(name);
}

function isComponentOrHook(
	node: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression,
): boolean {
	if (node.type === AST_NODE_TYPES.FunctionDeclaration && node.id) {
		const { name } = node.id;
		return isComponent(name) || isReactHook(name);
	}

	if (node.type === AST_NODE_TYPES.FunctionExpression || node.type === AST_NODE_TYPES.ArrowFunctionExpression) {
		const { parent } = node;
		if (parent === undefined) return false;

		if (parent.type === AST_NODE_TYPES.VariableDeclarator && parent.id.type === AST_NODE_TYPES.Identifier) {
			const { name } = parent.id;
			return isComponent(name) || isReactHook(name);
		}

		if (parent.type === AST_NODE_TYPES.Property && parent.key.type === AST_NODE_TYPES.Identifier) {
			const { name } = parent.key;
			return isComponent(name) || isReactHook(name);
		}

		if (parent.type === AST_NODE_TYPES.MethodDefinition && parent.key.type === AST_NODE_TYPES.Identifier) {
			const { name } = parent.key;
			return isComponent(name) || isReactHook(name);
		}
	}

	return false;
}

function isHookCall(node: TSESTree.CallExpression): boolean {
	const { callee } = node;

	if (callee.type === AST_NODE_TYPES.Identifier) return isReactHook(callee.name);

	if (callee.type === AST_NODE_TYPES.MemberExpression && callee.property.type === AST_NODE_TYPES.Identifier) {
		return isReactHook(callee.property.name);
	}

	return false;
}

const FUNCTION_BOUNDARIES = new Set<AST_NODE_TYPES>([
	AST_NODE_TYPES.FunctionDeclaration,
	AST_NODE_TYPES.FunctionExpression,
	AST_NODE_TYPES.ArrowFunctionExpression,
]);

function isInFinallyBlock(node: TSESTree.Node): boolean {
	let current: TSESTree.Node | undefined = node.parent;
	const maxDepth = 20;
	let inFinallyBlock = false;

	for (let depth = 0; depth < maxDepth && current; depth += 1) {
		if (FUNCTION_BOUNDARIES.has(current.type)) break;

		if (current.type === AST_NODE_TYPES.TryStatement) {
			let checkNode: TSESTree.Node | undefined = node;
			while (checkNode && checkNode !== current) {
				if (checkNode === current.finalizer) {
					inFinallyBlock = true;
					break;
				}
				checkNode = checkNode.parent;
			}
			break;
		}

		current = current.parent;
	}

	return inFinallyBlock;
}

function isRecursiveCall(node: TSESTree.CallExpression, functionName?: string): boolean {
	if (functionName === undefined || functionName.length === 0) return false;

	const { callee } = node;
	return callee.type === AST_NODE_TYPES.Identifier && callee.name === functionName;
}

type MessageIds =
	| "afterEarlyReturn"
	| "conditionalHook"
	| "loopHook"
	| "nestedFunction"
	| "recursiveHookCall"
	| "tryBlockHook";
type Options = [UseHookAtTopLevelOptions?];

function getHookName(callee: TSESTree.Expression): string | undefined {
	if (callee.type === AST_NODE_TYPES.Identifier) return callee.name;
	return callee.type === AST_NODE_TYPES.MemberExpression && callee.property.type === AST_NODE_TYPES.Identifier
		? callee.property.name
		: undefined;
}

const useHookAtTopLevel = createRule<Options, MessageIds>({
	create(context, [rawOptions]) {
		const configuration = rawOptions ?? {};
		const contextStack = new Array<ControlFlowContext>();
		let currentFunctionName: string | undefined;

		const importSourceMap = new Map<string, string>();

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

		// oxlint-disable-next-line sonar/cognitive-complexity -- sybau
		function shouldIgnoreHook(hookName: string, node: TSESTree.CallExpression): boolean {
			const { onlyHooks, ignoreHooks, importSources } = configuration;
			if (onlyHooks && onlyHooks.length > 0) return !onlyHooks.includes(hookName);
			if (ignoreHooks?.includes(hookName) === true) return true;

			if (importSources && Object.keys(importSources).length > 0) {
				const { callee } = node;
				if (callee.type === AST_NODE_TYPES.MemberExpression) {
					const objectName =
						callee.object.type === AST_NODE_TYPES.Identifier ? callee.object.name : undefined;

					if (objectName !== undefined && objectName.length > 0 && importSources[objectName] === false) {
						return true;
					}
					if (objectName !== undefined && objectName.length > 0 && importSources[objectName] === true) {
						return false;
					}
				}

				if (callee.type === AST_NODE_TYPES.Identifier) {
					const importSource = importSourceMap.get(hookName);
					if (
						importSource !== undefined &&
						importSource.length > 0 &&
						importSources[importSource] === false
					) {
						return true;
					}
					if (importSource !== undefined && importSource.length > 0 && importSources[importSource] === true) {
						return false;
					}
				}
			}

			return false;
		}

		function handleFunctionEnter(
			node: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression,
		): void {
			const current = getCurrentContext();
			const depth = current ? current.functionDepth + 1 : 0;

			const isComponentOrHookFlag = isComponentOrHook(node);
			if (node.type === AST_NODE_TYPES.FunctionDeclaration && node.id) currentFunctionName = node.id.name;

			if (current?.isComponentOrHook === true) {
				pushContext({
					afterEarlyReturn: false,
					functionDepth: depth,
					inConditional: false,
					inLoop: false,
					inNestedFunction: true,
					inTryBlock: false,
					isComponentOrHook: false,
				});
			} else if (isComponentOrHookFlag) {
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

			CallExpression(node): void {
				if (!isHookCall(node)) return;

				const { callee } = node;
				const hookName = getHookName(callee);
				if (hookName === undefined || hookName.length === 0 || shouldIgnoreHook(hookName, node)) return;

				const current = getCurrentContext();
				if (!current) return;
				if (!(current.isComponentOrHook || current.inNestedFunction) || isInFinallyBlock(node)) return;

				if (isRecursiveCall(node, currentFunctionName)) {
					context.report({
						messageId: "recursiveHookCall",
						node,
					});
					return;
				}

				if (current.inNestedFunction) {
					context.report({
						messageId: "nestedFunction",
						node,
					});
					return;
				}

				if (current.inConditional) {
					context.report({
						messageId: "conditionalHook",
						node,
					});
					return;
				}

				if (current.inLoop) {
					context.report({
						messageId: "loopHook",
						node,
					});
					return;
				}

				if (current.inTryBlock) {
					context.report({
						messageId: "tryBlockHook",
						node,
					});
					return;
				}

				if (current.afterEarlyReturn) {
					context.report({
						messageId: "afterEarlyReturn",
						node,
					});
				}
			},

			ConditionalExpression(): void {
				updateContext({ inConditional: true });
			},
			"ConditionalExpression:exit"(): void {
				updateContext({ inConditional: false });
			},

			DoWhileStatement(): void {
				updateContext({ inLoop: true });
			},
			"DoWhileStatement:exit"(): void {
				updateContext({ inLoop: false });
			},

			ForInStatement(): void {
				updateContext({ inLoop: true });
			},
			"ForInStatement:exit"(): void {
				updateContext({ inLoop: false });
			},

			ForOfStatement(): void {
				updateContext({ inLoop: true });
			},
			"ForOfStatement:exit"(): void {
				updateContext({ inLoop: false });
			},

			ForStatement(): void {
				updateContext({ inLoop: true });
			},
			"ForStatement:exit"(): void {
				updateContext({ inLoop: false });
			},
			FunctionDeclaration: handleFunctionEnter,

			"FunctionDeclaration:exit": handleFunctionExit,
			FunctionExpression: handleFunctionEnter,
			"FunctionExpression:exit": handleFunctionExit,

			IfStatement(): void {
				updateContext({ inConditional: true });
			},
			"IfStatement:exit"(): void {
				updateContext({ inConditional: false });
			},

			ImportDeclaration(node): void {
				const importNode = node;
				const source = importNode.source.value;

				if (!configuration.importSources || Object.keys(configuration.importSources).length === 0) return;

				for (const specifier of importNode.specifiers) {
					if (specifier.type !== AST_NODE_TYPES.ImportSpecifier) continue;

					const { imported } = specifier;
					if (imported.type !== AST_NODE_TYPES.Identifier) continue;
					if (isReactHook(imported.name)) importSourceMap.set(specifier.local.name, source);
				}
			},

			LogicalExpression(): void {
				updateContext({ inConditional: true });
			},
			"LogicalExpression:exit"(): void {
				updateContext({ inConditional: false });
			},

			"ReturnStatement:exit"(): void {
				updateContext({ afterEarlyReturn: true });
			},

			SwitchStatement(): void {
				updateContext({ inConditional: true });
			},
			"SwitchStatement:exit"(): void {
				updateContext({ inConditional: false });
			},

			TryStatement(): void {
				updateContext({ inTryBlock: true });
			},
			"TryStatement:exit"(): void {
				updateContext({ inTryBlock: false });
			},

			WhileStatement(): void {
				updateContext({ inLoop: true });
			},
			"WhileStatement:exit"(): void {
				updateContext({ inLoop: false });
			},
		};
	},
	defaultOptions: [{}],
	meta: {
		docs: {
			description:
				"Enforce that React hooks are only called at the top level of components or custom hooks, never conditionally or in nested functions",
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
					ignoreHooks: {
						description: "Hook names to ignore (both React and non-React hooks)",
						items: { type: "string" },
						type: "array",
					},
					importSources: {
						additionalProperties: { type: "boolean" },
						description:
							"Control which import sources to check. true = check hooks from source, false = ignore",
						type: "object",
					},
					onlyHooks: {
						description: "Only check hooks with these exact names (whitelist mode)",
						items: { type: "string" },
						type: "array",
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
	name: "use-hook-at-top-level",
});

export default useHookAtTopLevel;
