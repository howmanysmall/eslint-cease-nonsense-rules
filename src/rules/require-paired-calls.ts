import { AST_NODE_TYPES, type TSESTree } from "@typescript-eslint/types";
import type { Rule } from "eslint";
import type { Writable } from "type-fest";
import Type from "typebox";
import { Compile } from "typebox/compile";

const isStringArray = Compile(Type.Readonly(Type.Array(Type.String())));

/**
 * Configuration for a single opener/closer pair
 */
export interface PairConfiguration {
	/** Opener function name (e.g., "debug.profilebegin") */
	readonly opener: string;
	/** Closer function name(s) - single or alternatives */
	readonly closer: string | ReadonlyArray<string>;
	/** Alternative closers (any one satisfies) */
	readonly alternatives?: ReadonlyArray<string>;
	/** All listed closers must be called */
	readonly requireAll?: ReadonlyArray<string>;
	/** Disallow await/yield between opener and closer */
	readonly requireSync?: boolean;
	/** Platform-specific behavior */
	readonly platform?: "roblox";
	/** Custom yielding function patterns (for Roblox) */
	readonly yieldingFunctions?: ReadonlyArray<string>;
}
const isPairConfiguration = Compile(
	Type.Readonly(
		Type.Object({
			alternatives: Type.Optional(isStringArray),
			closer: Type.Union([Type.String(), isStringArray]),
			opener: Type.String(),
			platform: Type.Optional(Type.Literal("roblox")),
			requireAll: Type.Optional(isStringArray),
			requireSync: Type.Optional(Type.Boolean()),
			yieldingFunctions: Type.Optional(isStringArray),
		}),
	),
);

const isScope = Compile(Type.Union([Type.Literal("function"), Type.Literal("block"), Type.Literal("file")]));
export type Scope = Type.Static<typeof isScope>;

/**
 * Rule options schema
 */
export interface RequirePairedCallsOptions {
	/** Array of paired function configurations */
	readonly pairs: ReadonlyArray<PairConfiguration>;
	/** Scope for balance checking */
	readonly scope?: Scope;
	/** Allow conditional closers */
	readonly allowConditionalClosers?: boolean;
	/** Allow multiple consecutive openers */
	readonly allowMultipleOpeners?: boolean;
	/** Maximum nesting depth (0 = unlimited) */
	readonly maxNestingDepth?: number;
}

const isRuleOptions = Compile(
	Type.Partial(
		Type.Readonly(
			Type.Object({
				allowConditionalClosers: Type.Optional(Type.Boolean()),
				allowMultipleOpeners: Type.Optional(Type.Boolean()),
				maxNestingDepth: Type.Optional(Type.Number()),
				pairs: Type.Readonly(Type.Array(isPairConfiguration)),
				scope: Type.Optional(isScope),
			}),
		),
	),
);

/**
 * Entry in the opener stack
 */
interface OpenerStackEntry {
	/** Opener function name */
	readonly opener: string;
	/** Source location */
	readonly location: TSESTree.SourceLocation;
	/** AST node */
	readonly node: TSESTree.Node;
	/** Configuration for this pair */
	readonly config: PairConfiguration;
	/** Index in stack (for LIFO validation) */
	readonly index: number;
}

/**
 * Control flow context tracking
 */
interface ControlFlowContext {
	/** Inside a conditional branch (if/else/switch) */
	readonly inConditional: boolean;
	/** Inside a loop (for/while/do-while) */
	readonly inLoop: boolean;
	/** Inside try block */
	readonly inTry: boolean;
	/** Inside catch block */
	readonly inCatch: boolean;
	/** Inside finally block */
	readonly inFinally: boolean;
	/** Has early exit (return/throw/break/continue) */
	readonly hasEarlyExit: boolean;
	/** Inside async context */
	readonly asyncContext: boolean;
	/** Current function node */
	readonly currentFunction: TSESTree.Node | undefined;
}

export const DEFAULT_ROBLOX_YIELDING_FUNCTIONS = ["task.wait", "wait", "*.WaitForChild"] as const;

function getCallName(node: TSESTree.CallExpression): string | undefined {
	const { callee } = node;

	if (callee.type === AST_NODE_TYPES.Identifier) return callee.name;

	if (callee.type === AST_NODE_TYPES.MemberExpression) {
		const object = callee.object.type === AST_NODE_TYPES.Identifier ? callee.object.name : undefined;
		const property = callee.property.type === AST_NODE_TYPES.Identifier ? callee.property.name : undefined;

		if (object !== undefined && property !== undefined) return `${object}.${property}`;
	}

	return undefined;
}

function getValidClosers(configuration: PairConfiguration): ReadonlyArray<string> {
	const result = new Array<string>();

	if (isStringArray.Check(configuration.closer)) result.push(...configuration.closer);
	else if (typeof configuration.closer === "string") result.push(configuration.closer);

	if (configuration.alternatives) for (const alternative of configuration.alternatives) result.push(alternative);
	if (configuration.requireAll) for (const requirement of configuration.requireAll) result.push(requirement);

	return result;
}

function cloneEntry<T extends object>(value: T): T {
	return { ...value };
}

const rule: Rule.RuleModule = {
	create(context): Rule.RuleListener {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- ESLint context.options is typed as any[]
		const rawOptions = context.options[0];
		const baseOptions = isRuleOptions.Check(rawOptions) ? rawOptions : {};

		const options: Writable<RequirePairedCallsOptions> = {
			allowConditionalClosers: baseOptions.allowConditionalClosers ?? false,
			allowMultipleOpeners: baseOptions.allowMultipleOpeners ?? true,
			maxNestingDepth: baseOptions.maxNestingDepth ?? 0,
			pairs: baseOptions.pairs ?? [],
			scope: baseOptions.scope ?? "function",
		};

		if (options.pairs.length === 0) {
			options.pairs = [
				{
					closer: "debug.profileend",
					opener: "debug.profilebegin",
					platform: "roblox",
					requireSync: true,
					yieldingFunctions: [...DEFAULT_ROBLOX_YIELDING_FUNCTIONS],
				},
			];
		}

		const openerStack = new Array<OpenerStackEntry>();
		let stackIndexCounter = 0;
		const functionStacks = new Array<Array<OpenerStackEntry>>();

		let yieldingAutoClosed = false;
		let yieldingReportedFirst = false;

		const contextStack = new Array<ControlFlowContext>();
		const stackSnapshots = new Map<TSESTree.Node, Array<OpenerStackEntry>>();
		const branchStacks = new Map<TSESTree.Node, Array<Array<OpenerStackEntry>>>();

		function getCurrentContext(): ControlFlowContext {
			return contextStack.length > 0
				? contextStack.at(-1)!
				: {
						asyncContext: false,
						currentFunction: undefined,
						hasEarlyExit: false,
						inCatch: false,
						inConditional: false,
						inFinally: false,
						inLoop: false,
						inTry: false,
					};
		}

		function pushContext(newContext: Partial<ControlFlowContext>): void {
			const currentContext = getCurrentContext();
			contextStack.push({ ...currentContext, ...newContext });
		}

		function popContext(): void {
			contextStack.pop();
		}

		function updateContext(updates: Partial<ControlFlowContext>): void {
			const last = contextStack.at(-1);
			if (!last) return;
			contextStack[contextStack.length - 1] = { ...last, ...updates };
		}

		function cloneStack(): Array<OpenerStackEntry> {
			// oxlint-disable-next-line no-array-callback-reference -- this is fine. leave it alone.
			return openerStack.map(cloneEntry);
		}

		function saveSnapshot(node: TSESTree.Node): void {
			stackSnapshots.set(node, cloneStack());
		}

		function findPairConfig(functionName: string, isOpener: boolean): PairConfiguration | undefined {
			return options.pairs.find((pair) => {
				if (isOpener) return pair.opener === functionName;

				// Check if it matches closer or alternatives
				const validClosers = getValidClosers(pair);
				return validClosers.includes(functionName);
			});
		}

		function isRobloxYieldingFunction(functionName: string, configuration: PairConfiguration): boolean {
			if (configuration.platform !== "roblox") return false;

			const yieldingFunctions = configuration.yieldingFunctions ?? DEFAULT_ROBLOX_YIELDING_FUNCTIONS;
			return yieldingFunctions.some((pattern) => {
				if (pattern.startsWith("*.")) {
					// Match any method call with this name
					const methodName = pattern.slice(2);
					return functionName.endsWith(`.${methodName}`);
				}
				return functionName === pattern;
			});
		}

		function onFunctionEnter(node: unknown): void {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- ESLint visitor functions receive unknown, we know the type from selector
			const functionNode = node as
				| TSESTree.FunctionDeclaration
				| TSESTree.FunctionExpression
				| TSESTree.ArrowFunctionExpression;

			functionStacks.push([...openerStack]);
			openerStack.length = 0;

			yieldingAutoClosed = false;
			yieldingReportedFirst = false;

			pushContext({
				asyncContext: functionNode.async ?? false,
				currentFunction: functionNode,
				hasEarlyExit: false,
				inCatch: false,
				inConditional: false,
				inFinally: false,
				inLoop: false,
				inTry: false,
			});
		}

		function onFunctionExit(): void {
			if (options.scope === "function" && openerStack.length > 0) {
				for (const entry of openerStack) {
					const validClosers = getValidClosers(entry.config);
					const closer =
						validClosers.length === 1 ? (validClosers[0] ?? "closer") : validClosers.join("' or '");

					context.report({
						data: {
							closer,
							opener: entry.opener,
							paths: "function exit",
						},
						messageId: "unpairedOpener",
						node: entry.node,
					});
				}
			}

			const parentStack = functionStacks.pop();
			if (parentStack) {
				openerStack.length = 0;
				openerStack.push(...parentStack);
			} else openerStack.length = 0;

			popContext();
		}

		function onIfStatementEnter(node: unknown): void {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- ESLint visitor type from selector
			const ifNode = node as TSESTree.IfStatement;
			pushContext({ inConditional: true });
			saveSnapshot(ifNode);
		}

		function onIfStatementExit(node: unknown): void {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- ESLint visitor type from selector
			const ifNode = node as TSESTree.IfStatement;
			popContext();

			const originalStack = stackSnapshots.get(ifNode);
			const branches = branchStacks.get(ifNode);

			if (originalStack && branches && branches.length > 0) {
				const hasCompleteElse = ifNode.alternate !== undefined && ifNode.alternate !== null;

				if (hasCompleteElse) {
					for (const { index, config, opener, node } of originalStack) {
						const branchesWithOpener = branches.filter((branchStack) =>
							branchStack.some((branch) => branch.index === index),
						);

						if (branchesWithOpener.length <= 0 || branchesWithOpener.length >= branches.length) continue;
						if (options.allowConditionalClosers !== false) continue;

						const validClosers = getValidClosers(config);
						const closer =
							validClosers.length === 1 ? (validClosers[0] ?? "closer") : validClosers.join("' or '");

						context.report({
							data: {
								closer,
								opener,
								paths: "not all execution paths",
							},
							messageId: "unpairedOpener",
							node,
						});
					}

					const commonOpeners = originalStack.filter((opener) =>
						branches.every((branchStack) => branchStack.some(({ index }) => index === opener.index)),
					);

					openerStack.length = 0;
					openerStack.push(...commonOpeners);
				} else {
					openerStack.length = 0;
					for (const entry of originalStack) openerStack.push({ ...entry });
				}
			}

			stackSnapshots.delete(ifNode);
			branchStacks.delete(ifNode);
		}

		function onIfConsequentExit(node: unknown): void {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- ESLint visitor type from selector
			const consequentNode = node as TSESTree.Statement;
			const parent = consequentNode.parent;

			if (parent?.type === AST_NODE_TYPES.IfStatement) {
				const branches = branchStacks.get(parent) ?? [];
				branches.push(cloneStack());
				branchStacks.set(parent, branches);

				const originalStack = stackSnapshots.get(parent);
				if (!originalStack) return;

				openerStack.length = 0;
				for (const entry of originalStack) openerStack.push({ ...entry });
			}
		}

		function onIfAlternateExit(node: unknown): void {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- ESLint visitor type from selector
			const alternateNode = node as TSESTree.Statement;
			const parent = alternateNode.parent;

			if (parent?.type === AST_NODE_TYPES.IfStatement) {
				const branches = branchStacks.get(parent) ?? [];
				branches.push(cloneStack());
				branchStacks.set(parent, branches);
			}
		}

		function onTryStatementEnter(node: unknown): void {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- ESLint visitor type from selector
			const tryNode = node as TSESTree.TryStatement;
			saveSnapshot(tryNode);
		}

		function onTryStatementExit(node: unknown): void {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- ESLint visitor type from selector
			const tryNode = node as TSESTree.TryStatement;
			const originalStack = stackSnapshots.get(tryNode);
			const branches = branchStacks.get(tryNode);

			if (tryNode.finalizer) {
				stackSnapshots.delete(tryNode);
				branchStacks.delete(tryNode);
				return;
			}

			if (originalStack && branches && branches.length > 0) {
				for (const opener of originalStack) {
					const branchesWithOpener = branches.filter((branchStack) =>
						branchStack.some((entry) => entry.index === opener.index),
					);

					if (
						branchesWithOpener.length > 0 &&
						branchesWithOpener.length < branches.length &&
						options.allowConditionalClosers === false
					) {
						const validClosers = getValidClosers(opener.config);
						const closer =
							validClosers.length === 1 ? (validClosers[0] ?? "closer") : validClosers.join("' or '");

						context.report({
							data: {
								closer,
								opener: opener.opener,
								paths: "not all execution paths",
							},
							messageId: "unpairedOpener",
							node: opener.node,
						});
					}
				}

				const commonOpeners = originalStack.filter((opener) =>
					branches.every((branchStack) => branchStack.some((entry) => entry.index === opener.index)),
				);

				openerStack.length = 0;
				openerStack.push(...commonOpeners);
			}

			stackSnapshots.delete(tryNode);
			branchStacks.delete(tryNode);
		}

		function onTryBlockEnter(): void {
			pushContext({ inTry: true });
		}

		function onTryBlockExit(node: unknown): void {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- ESLint visitor type from selector
			const blockNode = node as TSESTree.BlockStatement;
			const { parent } = blockNode;

			if (parent?.type === AST_NODE_TYPES.TryStatement) {
				const branches = branchStacks.get(parent) ?? [];
				branches.push(cloneStack());
				branchStacks.set(parent, branches);

				const originalStack = stackSnapshots.get(parent);
				if (originalStack) {
					openerStack.length = 0;
					for (const entry of originalStack) openerStack.push({ ...entry });
				}
			}

			popContext();
		}

		function onCatchClauseEnter(): void {
			pushContext({ inCatch: true });
		}

		function onCatchClauseExit(node: unknown): void {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- ESLint visitor type from selector
			const catchNode = node as TSESTree.CatchClause;
			const { parent } = catchNode;

			if (parent?.type === AST_NODE_TYPES.TryStatement) {
				const branches = branchStacks.get(parent) ?? [];
				branches.push(cloneStack());
				branchStacks.set(parent, branches);

				const originalStack = stackSnapshots.get(parent);
				if (originalStack) {
					openerStack.length = 0;
					for (const entry of originalStack) openerStack.push({ ...entry });
				}
			}

			popContext();
		}

		function onFinallyBlockEnter(): void {
			pushContext({ inFinally: true });
		}

		function onFinallyBlockExit(): void {
			popContext();
		}

		function onSwitchStatementEnter(node: unknown): void {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- ESLint visitor type from selector
			const switchNode = node as TSESTree.SwitchStatement;
			pushContext({ inConditional: true });
			saveSnapshot(switchNode);
		}

		function onSwitchStatementExit(node: unknown): void {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- ESLint visitor type from selector
			const switchNode = node as TSESTree.SwitchStatement;
			popContext();

			const originalStack = stackSnapshots.get(switchNode);
			const branches = branchStacks.get(switchNode);

			if (originalStack && branches && branches.length > 0) {
				const hasDefault = switchNode.cases.some((caseNode) => caseNode.test === null);

				if (hasDefault && branches.length === switchNode.cases.length) {
					for (const opener of originalStack) {
						const branchesWithOpener = branches.filter((branchStack) =>
							branchStack.some((entry) => entry.index === opener.index),
						);

						if (
							branchesWithOpener.length > 0 &&
							branchesWithOpener.length < branches.length &&
							options.allowConditionalClosers === false
						) {
							const validClosers = getValidClosers(opener.config);
							const closer =
								validClosers.length === 1 ? (validClosers[0] ?? "closer") : validClosers.join("' or '");

							context.report({
								data: {
									closer,
									opener: opener.opener,
									paths: "not all execution paths",
								},
								messageId: "unpairedOpener",
								node: opener.node,
							});
						}
					}

					const commonOpeners = originalStack.filter((opener) =>
						branches.every((branchStack) => branchStack.some((entry) => entry.index === opener.index)),
					);

					openerStack.length = 0;
					openerStack.push(...commonOpeners);
				} else {
					openerStack.length = 0;
					for (const entry of originalStack) openerStack.push({ ...entry });
				}
			}

			stackSnapshots.delete(switchNode);
			branchStacks.delete(switchNode);
		}

		function onSwitchCaseExit(node: unknown): void {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- ESLint visitor type from selector
			const caseNode = node as TSESTree.SwitchCase;
			const { parent } = caseNode;

			if (parent?.type === AST_NODE_TYPES.SwitchStatement) {
				const branches = branchStacks.get(parent) ?? [];
				branches.push(cloneStack());
				branchStacks.set(parent, branches);

				const originalStack = stackSnapshots.get(parent);
				if (!originalStack) return;

				openerStack.length = 0;
				for (const entry of originalStack) openerStack.push({ ...entry });
			}
		}

		function onLoopEnter(): void {
			pushContext({ inLoop: true });
		}

		function onLoopExit(): void {
			popContext();
		}

		function onEarlyExit(node: unknown): void {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- ESLint visitor type from selector
			const statementNode = node as TSESTree.ReturnStatement | TSESTree.ThrowStatement;
			updateContext({ hasEarlyExit: true });

			const currentContext = getCurrentContext();
			if (currentContext.inFinally || openerStack.length === 0) return;

			for (const { opener, config, node } of openerStack) {
				const validClosers = getValidClosers(config);
				const closer = validClosers.length === 1 ? (validClosers[0] ?? "closer") : validClosers.join("' or '");

				const statementType = statementNode.type === AST_NODE_TYPES.ReturnStatement ? "return" : "throw";
				const lineNumber = statementNode.loc?.start.line ?? 0;

				context.report({
					data: {
						closer,
						opener,
						paths: `${statementType} at line ${lineNumber}`,
					},
					messageId: "unpairedOpener",
					node: node,
				});
			}
		}

		function onBreakContinue(node: unknown): void {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- ESLint visitor type from selector
			const statementNode = node as TSESTree.BreakStatement | TSESTree.ContinueStatement;
			const currentContext = getCurrentContext();

			if (!currentContext.inLoop || openerStack.length <= 0) return;

			for (const { node, config, opener } of openerStack) {
				const validClosers = getValidClosers(config);
				const closer = validClosers.length === 1 ? (validClosers[0] ?? "closer") : validClosers.join("' or '");

				const statementType = statementNode.type === AST_NODE_TYPES.BreakStatement ? "break" : "continue";
				const lineNumber = statementNode.loc?.start.line ?? 0;

				context.report({
					data: {
						closer,
						opener,
						paths: `${statementType} at line ${lineNumber}`,
					},
					messageId: "unpairedOpener",
					node,
				});
			}
		}

		function onCallExpression(node: unknown): void {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- ESLint visitor type from selector
			const callNode = node as TSESTree.CallExpression;
			const callName = getCallName(callNode);
			if (callName === undefined || callName === "") return;

			const openerConfig = findPairConfig(callName, true);
			if (openerConfig) {
				handleOpener(callNode, callName, openerConfig);
				return;
			}

			const closerConfiguration = findPairConfig(callName, false);
			if (closerConfiguration) {
				handleCloser(callNode, callName, closerConfiguration);
				return;
			}

			for (const entry of openerStack) {
				if (!isRobloxYieldingFunction(callName, entry.config)) continue;

				handleRobloxYield(callNode, callName, entry);
				// Roblox auto-closes ALL profiles
				openerStack.length = 0;
				yieldingAutoClosed = true;
				return;
			}
		}

		function handleOpener(node: TSESTree.CallExpression, opener: string, config: PairConfiguration): void {
			const maxDepth = options.maxNestingDepth ?? 0;
			if (maxDepth > 0 && openerStack.length >= maxDepth) {
				context.report({
					data: { max: String(maxDepth) },
					messageId: "maxNestingExceeded",
					node,
				});
			}

			if (
				options.allowMultipleOpeners === false &&
				openerStack.length > 0 &&
				openerStack.at(-1)?.opener === opener
			) {
				context.report({
					data: { opener },
					messageId: "multipleOpeners",
					node,
				});
			}

			const entry: OpenerStackEntry = {
				config,
				index: stackIndexCounter++,
				location: node.loc,
				node,
				opener,
			};

			openerStack.push(entry);
		}

		function handleCloser(node: TSESTree.CallExpression, closer: string, configuration: PairConfiguration): void {
			const matchingIndex = openerStack.findLastIndex(
				(entry) => getValidClosers(entry.config).includes(closer) && entry.config === configuration,
			);

			if (matchingIndex === -1) {
				if (yieldingAutoClosed && !yieldingReportedFirst) {
					yieldingReportedFirst = true;
					return;
				}

				context.report({
					data: {
						closer,
						opener: configuration.opener,
					},
					messageId: "unpairedCloser",
					node,
				});
				return;
			}

			const matchingEntry = openerStack[matchingIndex];
			if (!matchingEntry) return;

			if (matchingIndex !== openerStack.length - 1) {
				const topEntry = openerStack.at(-1);
				if (topEntry) {
					context.report({
						data: {
							actual: topEntry.opener,
							closer,
							expected: matchingEntry.opener,
						},
						messageId: "wrongOrder",
						node,
					});
				}
			}

			openerStack.splice(matchingIndex, 1);
		}

		function handleRobloxYield(
			node: TSESTree.CallExpression,
			yieldingFunction: string,
			openerEntry: OpenerStackEntry,
		): void {
			const validClosers = getValidClosers(openerEntry.config);
			const closer = validClosers.length === 1 ? (validClosers[0] ?? "closer") : validClosers.join("' or '");

			context.report({
				data: { closer, yieldingFunction },
				messageId: "robloxYieldViolation",
				node,
			});
		}

		function onAsyncYield(node: unknown): void {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- ESLint visitor type from selector
			const asyncNode = node as TSESTree.AwaitExpression | TSESTree.YieldExpression;
			for (const { opener, config } of openerStack) {
				if (config.requireSync !== true) continue;

				const validClosers = getValidClosers(config);
				const closer = validClosers.length === 1 ? (validClosers[0] ?? "closer") : validClosers.join("' or '");

				const asyncType = asyncNode.type === AST_NODE_TYPES.AwaitExpression ? "await" : "yield";

				context.report({
					data: { asyncType, closer, opener },
					messageId: "asyncViolation",
					node: asyncNode,
				});
			}
		}

		return {
			ArrowFunctionExpression: onFunctionEnter,
			"ArrowFunctionExpression:exit": onFunctionExit,

			AwaitExpression: onAsyncYield,
			BreakStatement: onBreakContinue,

			CallExpression: onCallExpression,
			CatchClause: onCatchClauseEnter,
			"CatchClause:exit": onCatchClauseExit,
			ContinueStatement: onBreakContinue,
			DoWhileStatement: onLoopEnter,
			"DoWhileStatement:exit": onLoopExit,
			ForInStatement: onLoopEnter,
			"ForInStatement:exit": onLoopExit,
			ForOfStatement: (node: unknown) => {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- ESLint visitor type from selector
				const forOfNode = node as TSESTree.ForOfStatement;
				if (forOfNode.await) onAsyncYield(node);
				onLoopEnter();
			},
			"ForOfStatement:exit": onLoopExit,

			ForStatement: onLoopEnter,
			"ForStatement:exit": onLoopExit,
			FunctionDeclaration: onFunctionEnter,
			"FunctionDeclaration:exit": onFunctionExit,
			FunctionExpression: onFunctionEnter,
			"FunctionExpression:exit": onFunctionExit,

			IfStatement: onIfStatementEnter,
			"IfStatement > .alternate:exit": onIfAlternateExit,
			"IfStatement > .consequent:exit": onIfConsequentExit,
			"IfStatement:exit": onIfStatementExit,

			ReturnStatement: onEarlyExit,
			"SwitchCase:exit": onSwitchCaseExit,

			SwitchStatement: onSwitchStatementEnter,
			"SwitchStatement:exit": onSwitchStatementExit,
			ThrowStatement: onEarlyExit,

			TryStatement: onTryStatementEnter,
			"TryStatement > .block": onTryBlockEnter,
			"TryStatement > .block:exit": onTryBlockExit,
			"TryStatement > .finalizer": onFinallyBlockEnter,
			"TryStatement > .finalizer:exit": onFinallyBlockExit,
			"TryStatement:exit": onTryStatementExit,
			WhileStatement: onLoopEnter,
			"WhileStatement:exit": onLoopExit,
			YieldExpression: onAsyncYield,
		};
	},
	meta: {
		docs: {
			description: "Enforces balanced opener/closer function calls across all execution paths",
			recommended: false,
			url: "https://github.com/howmanysmall/eslint-idiot-lint/tree/main/docs/rules/require-paired-calls.md",
		},
		fixable: "code",
		messages: {
			asyncViolation: "Cannot use {{asyncType}} between '{{opener}}' and '{{closer}}' (requireSync: true)",
			conditionalOpener:
				"Conditional opener '{{opener}}' at {{location}} may not have matching closer on all paths",
			maxNestingExceeded: "Maximum nesting depth of {{max}} exceeded for paired calls",
			multipleOpeners:
				"Multiple consecutive calls to '{{opener}}' without matching closers (allowMultipleOpeners: false)",
			robloxYieldViolation:
				"Yielding function '{{yieldingFunction}}' auto-closes all profiles - subsequent '{{closer}}' will error",
			unpairedCloser: "Unexpected call to '{{closer}}' - no matching '{{opener}}'",
			unpairedOpener: "Unpaired call to '{{opener}}' - missing '{{closer}}' on {{paths}}",
			wrongOrder:
				"Closer '{{closer}}' called out of order - expected to close '{{expected}}' but '{{actual}}' is still open",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					allowConditionalClosers: {
						default: false,
						type: "boolean",
					},
					allowMultipleOpeners: {
						default: true,
						type: "boolean",
					},
					maxNestingDepth: {
						default: 0,
						minimum: 0,
						type: "number",
					},
					pairs: {
						items: {
							additionalProperties: false,
							properties: {
								alternatives: {
									items: { minLength: 1, type: "string" },
									type: "array",
								},
								closer: {
									oneOf: [
										{ minLength: 1, type: "string" },
										{
											items: { minLength: 1, type: "string" },
											minItems: 1,
											type: "array",
										},
									],
								},
								opener: {
									minLength: 1,
									type: "string",
								},
								platform: {
									enum: ["roblox"],
									type: "string",
								},
								requireAll: {
									items: { minLength: 1, type: "string" },
									type: "array",
								},
								requireSync: {
									default: false,
									type: "boolean",
								},
								yieldingFunctions: {
									items: { minLength: 1, type: "string" },
									type: "array",
								},
							},
							required: ["opener", "closer"],
							type: "object",
						},
						minItems: 1,
						type: "array",
					},
					scope: {
						default: "function",
						enum: ["function", "block", "file"],
						type: "string",
					},
				},
				required: ["pairs"],
				type: "object",
			},
		],
		type: "problem",
	},
};

export default rule;
