import { createRule } from "$utilities/create-rule";
import { AST_NODE_TYPES } from "@typescript-eslint/types";
import Typebox from "typebox";
import { Compile } from "typebox/compile";

import type { TSESTree } from "@typescript-eslint/types";
import type { TSESLint } from "@typescript-eslint/utils";
import type { Writable } from "type-fest";

const isStringArray = Compile(Typebox.Readonly(Typebox.Array(Typebox.String())));

function isReadonlyStringArray(value: string | ReadonlyArray<string>): value is ReadonlyArray<string> {
	return isStringArray.Check(value);
}

/** Configuration for a single opener/closer pair */
export interface PairConfiguration {
	/** Alternative closers (any one satisfies) */
	readonly alternatives?: ReadonlyArray<string>;
	/** Closer function name(s) - single or alternatives */
	readonly closer: string | ReadonlyArray<string>;
	/** Opener function name (e.g., "debug.profilebegin") */
	readonly opener: string;
	/** Additional opener names that share this closer */
	readonly openerAlternatives?: ReadonlyArray<string>;
	/** Platform-specific behavior */
	readonly platform?: "roblox";
	/** Disallow await/yield between opener and closer */
	readonly requireSync?: boolean;
	/** Custom yielding function patterns (for Roblox) */
	readonly yieldingFunctions?: ReadonlyArray<string>;
}
/** Rule options schema */
export interface RequirePairedCallsOptions {
	/** Allow conditional closers */
	readonly allowConditionalClosers?: boolean;
	/** Allow multiple consecutive openers */
	readonly allowMultipleOpeners?: boolean;
	/** Maximum nesting depth (0 = unlimited) */
	readonly maxNestingDepth?: number;
	/** Array of paired function configurations */
	readonly pairs: ReadonlyArray<PairConfiguration>;
}

/** Entry in the opener stack */
interface OpenerStackEntry {
	/** Configuration for this pair */
	readonly config: PairConfiguration;
	/** Index in stack (for LIFO validation) */
	readonly index: number;
	/** Source location */
	readonly location: TSESTree.SourceLocation;
	/** Active loops when opener was called */
	readonly loopAncestors: ReadonlyArray<LoopLikeStatement>;
	/** AST node */
	readonly node: TSESTree.Node;
	/** Opener function name */
	readonly opener: string;
}

type LoopLikeStatement =
	| TSESTree.DoWhileStatement
	| TSESTree.ForInStatement
	| TSESTree.ForOfStatement
	| TSESTree.ForStatement
	| TSESTree.WhileStatement;

const LOOP_NODE_TYPES: ReadonlySet<TSESTree.Node["type"] | undefined> = new Set([
	AST_NODE_TYPES.DoWhileStatement,
	AST_NODE_TYPES.ForInStatement,
	AST_NODE_TYPES.ForOfStatement,
	AST_NODE_TYPES.ForStatement,
	AST_NODE_TYPES.WhileStatement,
]);

/** Control flow context tracking */
interface ControlFlowContext {
	/** Inside async context */
	readonly asyncContext: boolean;
	/** Current function node */
	readonly currentFunction: TSESTree.Node | undefined;
	/** Has early exit (return/throw/break/continue) */
	readonly hasEarlyExit: boolean;
	/** Inside catch block */
	readonly inCatch: boolean;
	/** Inside a conditional branch (if/else/switch) */
	readonly inConditional: boolean;
	/** Inside finally block */
	readonly inFinally: boolean;
	/** Inside a loop (for/while/do-while) */
	readonly inLoop: boolean;
	/** Inside try block */
	readonly inTry: boolean;
}

const DEFAULT_ROBLOX_YIELDING_FUNCTIONS = ["task.wait", "wait", "*.WaitForChild", "*.*Async"] as const;

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

	if (isReadonlyStringArray(configuration.closer)) result.push(...configuration.closer);
	else result.push(configuration.closer);

	if (configuration.alternatives) result.push(...configuration.alternatives);

	return result;
}

function getAllOpeners(configuration: PairConfiguration): ReadonlyArray<string> {
	const openers = [configuration.opener];
	if (configuration.openerAlternatives) openers.push(...configuration.openerAlternatives);
	return openers;
}

function formatOpenerList(openers: ReadonlyArray<string>): string {
	return openers.join("' or '");
}

function isLoopLikeStatement(node: TSESTree.Node | undefined): node is LoopLikeStatement {
	return LOOP_NODE_TYPES.has(node?.type);
}

function isSwitchStatement(node: TSESTree.Node): node is TSESTree.SwitchStatement {
	return node.type === AST_NODE_TYPES.SwitchStatement;
}

function findLabeledStatementBody(
	label: TSESTree.Identifier,
	startingNode?: TSESTree.Node,
): TSESTree.Statement | undefined {
	let current: TSESTree.Node | undefined = startingNode;
	let body: TSESTree.Statement | undefined;

	while (current && body === undefined) {
		if (current.type === AST_NODE_TYPES.LabeledStatement) {
			const { body: currentBody, label: currentLabel } = current;
			if (currentLabel.name === label.name) body = currentBody;
		}
		current = current.parent;
	}

	return body;
}

function findLabeledLoopBody(label: TSESTree.Identifier, startingNode?: TSESTree.Node): LoopLikeStatement | undefined {
	return [findLabeledStatementBody(label, startingNode)].find(isLoopLikeStatement);
}

function resolveBreakTargetLoop(statement: TSESTree.BreakStatement): LoopLikeStatement | undefined {
	if (statement.label) return findLabeledLoopBody(statement.label, statement.parent);

	let current: TSESTree.Node | undefined = statement.parent;
	let targetLoop: LoopLikeStatement | undefined;
	while (current && targetLoop === undefined && !isSwitchStatement(current)) {
		if (isLoopLikeStatement(current)) targetLoop = current;
		current = current.parent;
	}

	return targetLoop;
}

function resolveContinueTargetLoop(statement: TSESTree.ContinueStatement): LoopLikeStatement | undefined {
	if (statement.label) return findLabeledLoopBody(statement.label, statement.parent);

	let current: TSESTree.Node | undefined = statement.parent;
	let targetLoop: LoopLikeStatement | undefined;
	while (current && targetLoop === undefined) {
		if (isLoopLikeStatement(current)) targetLoop = current;
		current = current.parent;
	}

	return targetLoop;
}

function cloneEntry(value: OpenerStackEntry): OpenerStackEntry {
	return { ...value, loopAncestors: [...value.loopAncestors] };
}

const messages = {
	asyncViolation: "Cannot use {{asyncType}} between '{{opener}}' and '{{closer}}' (requireSync: true)",
	conditionalOpener: "Conditional opener '{{opener}}' at {{location}} may not have matching closer on all paths",
	maxNestingExceeded: "Maximum nesting depth of {{max}} exceeded for paired calls",
	multipleOpeners:
		"Multiple consecutive calls to '{{opener}}' without matching closers (allowMultipleOpeners: false)",
	robloxYieldViolation:
		"Yielding function '{{yieldingFunction}}' auto-closes all profiles - subsequent '{{closer}}' will error",
	unexpectedCloser: "Unexpected call to '{{closer}}' - expected one of: {{expected}}",
	unpairedCloser: "Unexpected call to '{{closer}}' - no matching opener on stack",
	unpairedOpener: "Unpaired call to '{{opener}}' - missing '{{closer}}' on {{paths}}",
	wrongOrder:
		"Closer '{{closer}}' called out of order - expected to close '{{expected}}' but '{{actual}}' is still open",
} as const;

type MessageIds = keyof typeof messages;
type Options = [Partial<RequirePairedCallsOptions>?];
type RuleContext = TSESLint.RuleContext<MessageIds, Options>;
type NormalizedOptions = Required<RequirePairedCallsOptions>;
type IfStatementChild = TSESTree.Statement & { readonly parent: TSESTree.IfStatement };
type SwitchCaseChild = TSESTree.SwitchCase & { readonly parent: TSESTree.SwitchStatement };
type TryBlockChild = TSESTree.BlockStatement & { readonly parent: TSESTree.TryStatement };
type TryCatchChild = TSESTree.CatchClause & { readonly parent: TSESTree.TryStatement };

interface BranchState {
	readonly branches: Array<Array<OpenerStackEntry>>;
	readonly originalStack: Array<OpenerStackEntry>;
}

function formatValidClosers(configuration: PairConfiguration): string {
	const validClosers = getValidClosers(configuration);
	return validClosers.join("' or '");
}

function reportUnpairedOpener(context: RuleContext, entry: OpenerStackEntry, paths: string): void {
	context.report({
		data: {
			closer: formatValidClosers(entry.config),
			opener: entry.opener,
			paths,
		},
		messageId: "unpairedOpener",
		node: entry.node,
	});
}

function hasEntryWithIndex(stack: ReadonlyArray<OpenerStackEntry>, entry: OpenerStackEntry): boolean {
	return stack.some(({ index }) => index === entry.index);
}

function getBranchesWithOpener(
	branches: ReadonlyArray<ReadonlyArray<OpenerStackEntry>>,
	opener: OpenerStackEntry,
): ReadonlyArray<ReadonlyArray<OpenerStackEntry>> {
	return branches.filter((branchStack) => hasEntryWithIndex(branchStack, opener));
}

function getCommonOpeners(
	originalStack: ReadonlyArray<OpenerStackEntry>,
	branches: ReadonlyArray<ReadonlyArray<OpenerStackEntry>>,
): ReadonlyArray<OpenerStackEntry> {
	return originalStack.filter((opener) => branches.every((branchStack) => hasEntryWithIndex(branchStack, opener)));
}

function replaceStack(
	targetStack: Array<OpenerStackEntry>,
	entries: ReadonlyArray<OpenerStackEntry>,
	cloneEntries: boolean,
): void {
	targetStack.length = 0;
	for (const entry of entries) targetStack.push(cloneEntries ? cloneEntry(entry) : entry);
}

function reportBranchOnlyOpeners(
	context: RuleContext,
	originalStack: ReadonlyArray<OpenerStackEntry>,
	branches: ReadonlyArray<ReadonlyArray<OpenerStackEntry>>,
): void {
	for (const branchStack of branches) {
		for (const entry of branchStack) {
			if (hasEntryWithIndex(originalStack, entry)) continue;
			reportUnpairedOpener(context, entry, "conditional branch");
		}
	}
}

function reportOpenersMissingOnSomePaths(
	context: RuleContext,
	originalStack: ReadonlyArray<OpenerStackEntry>,
	branches: ReadonlyArray<ReadonlyArray<OpenerStackEntry>>,
	options: RequirePairedCallsOptions,
): void {
	if (options.allowConditionalClosers !== false) return;

	for (const opener of originalStack) {
		const branchesWithOpener = getBranchesWithOpener(branches, opener);
		if (branchesWithOpener.length <= 0 || branchesWithOpener.length >= branches.length) continue;
		reportUnpairedOpener(context, opener, "not all execution paths");
	}
}

function recordBranchSnapshot(
	branchStates: Array<BranchState>,
	openerStack: Array<OpenerStackEntry>,
	resetToSnapshot: boolean,
): void {
	for (const state of branchStates.slice(-1)) {
		state.branches.push(openerStack.map(cloneEntry));
		if (resetToSnapshot) replaceStack(openerStack, state.originalStack, true);
	}
}

const requirePairedCalls = createRule<Options, MessageIds>({
	create(context, [rawOptions]) {
		const options: Writable<NormalizedOptions> = {
			allowConditionalClosers: false,
			allowMultipleOpeners: true,
			maxNestingDepth: 0,
			pairs: [],
			...rawOptions,
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
		const loopStack = new Array<LoopLikeStatement>();
		let stackIndexCounter = 0;
		const functionStacks = new Array<Array<OpenerStackEntry>>();

		let yieldingAutoClosed = false;
		let yieldingReportedFirst = false;

		const contextStack = new Array<ControlFlowContext>();
		const branchStates = new Array<BranchState>();
		const openerToClosersCache = new Map<string, ReadonlyArray<string>>();

		function getExpectedClosersForOpener(opener: string): ReadonlyArray<string> {
			const cachedClosers = openerToClosersCache.get(opener);
			if (cachedClosers !== undefined) return cachedClosers;

			const closers = new Array<string>();
			let size = 0;
			for (const pair of options.pairs) {
				const allOpeners = getAllOpeners(pair);
				if (!allOpeners.includes(opener)) continue;

				const validClosers = getValidClosers(pair);
				for (const closer of validClosers) if (!closers.includes(closer)) closers[size++] = closer;
			}

			openerToClosersCache.set(opener, closers);
			return closers;
		}

		function getCurrentContext(): ControlFlowContext {
			return contextStack.length > 0
				? // oxlint-disable-next-line no-non-null-assertion -- this is fine! we checked already!
					contextStack.at(-1)!
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
			if (last) contextStack[contextStack.length - 1] = { ...last, ...updates };
		}

		function startBranchTracking(): void {
			branchStates.push({
				branches: [],
				originalStack: openerStack.map(cloneEntry),
			});
		}

		function findPairConfiguration(functionName: string, isOpener: boolean): PairConfiguration | undefined {
			return options.pairs.find((pair) =>
				(isOpener ? getAllOpeners(pair) : getValidClosers(pair)).includes(functionName),
			);
		}

		function isRobloxYieldingFunction(functionName: string, configuration: PairConfiguration): boolean {
			if (configuration.platform !== "roblox") return false;

			const yieldingFunctions = configuration.yieldingFunctions ?? DEFAULT_ROBLOX_YIELDING_FUNCTIONS;
			return yieldingFunctions.some((pattern) =>
				pattern.startsWith("*.") ? functionName.endsWith(`.${pattern.slice(2)}`) : functionName === pattern,
			);
		}

		function onFunctionEnter(
			node: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression,
		): void {
			functionStacks.push([...openerStack]);
			openerStack.length = 0;

			yieldingAutoClosed = false;
			yieldingReportedFirst = false;

			pushContext({
				asyncContext: node.async,
				currentFunction: node,
				hasEarlyExit: false,
				inCatch: false,
				inConditional: false,
				inFinally: false,
				inLoop: false,
				inTry: false,
			});
		}

		function onFunctionExit(): void {
			if (openerStack.length > 0) {
				for (const entry of openerStack) reportUnpairedOpener(context, entry, "function exit");
			}

			for (const parentStack of functionStacks.splice(-1, 1)) {
				replaceStack(openerStack, parentStack, false);
			}

			popContext();
		}

		function onIfStatementEnter(_ifNode: TSESTree.IfStatement): void {
			pushContext({ inConditional: true });
			startBranchTracking();
		}

		function onIfStatementExit(ifNode: TSESTree.IfStatement): void {
			popContext();

			for (const { branches, originalStack } of branchStates.splice(-1, 1)) {
				reportBranchOnlyOpeners(context, originalStack, branches);

				if (ifNode.alternate !== undefined && ifNode.alternate !== null) {
					reportOpenersMissingOnSomePaths(context, originalStack, branches, options);
					replaceStack(openerStack, getCommonOpeners(originalStack, branches), false);
				} else replaceStack(openerStack, originalStack, true);
			}
		}

		function onIfConsequentExit(_node: IfStatementChild): void {
			recordBranchSnapshot(branchStates, openerStack, true);
		}

		function onIfAlternateExit(_node: IfStatementChild): void {
			recordBranchSnapshot(branchStates, openerStack, false);
		}

		function onTryStatementExit(node: TSESTree.TryStatement): void {
			const states = branchStates.splice(-1, 1);

			if (node.finalizer) {
				return;
			}

			for (const { branches, originalStack } of states) {
				reportOpenersMissingOnSomePaths(context, originalStack, branches, options);
				replaceStack(openerStack, getCommonOpeners(originalStack, branches), false);
			}
		}

		function onTryBlockEnter(): void {
			pushContext({ inTry: true });
		}

		function onTryBlockExit(_node: TryBlockChild): void {
			recordBranchSnapshot(branchStates, openerStack, true);
			popContext();
		}

		function onCatchClauseEnter(): void {
			pushContext({ inCatch: true });
		}

		function onCatchClauseExit(_node: TryCatchChild): void {
			recordBranchSnapshot(branchStates, openerStack, true);
			popContext();
		}

		function onFinallyBlockEnter(): void {
			pushContext({ inFinally: true });
		}

		function onSwitchStatementEnter(_node: TSESTree.SwitchStatement): void {
			pushContext({ inConditional: true });
			startBranchTracking();
		}

		function onSwitchStatementExit(node: TSESTree.SwitchStatement): void {
			popContext();

			for (const { branches, originalStack } of branchStates.splice(-1, 1)) {
				const hasDefault = node.cases.some((caseNode) => caseNode.test === null);

				if (hasDefault && branches.length === node.cases.length) {
					reportOpenersMissingOnSomePaths(context, originalStack, branches, options);
					replaceStack(openerStack, getCommonOpeners(originalStack, branches), false);
				} else replaceStack(openerStack, originalStack, true);
			}
		}

		function onSwitchCaseExit(_node: SwitchCaseChild): void {
			recordBranchSnapshot(branchStates, openerStack, true);
		}

		function onLoopEnter(node: LoopLikeStatement): void {
			loopStack.push(node);
			pushContext({ inLoop: true });
		}

		function onLoopExit(): void {
			loopStack.pop();
			popContext();
		}

		function onEarlyExit(statementNode: TSESTree.ReturnStatement | TSESTree.ThrowStatement): void {
			updateContext({ hasEarlyExit: true });

			const currentContext = getCurrentContext();
			if (currentContext.inFinally || openerStack.length === 0) return;

			for (const { opener, config, node } of openerStack) {
				const statementType = statementNode.type === AST_NODE_TYPES.ReturnStatement ? "return" : "throw";

				context.report({
					data: {
						closer: formatValidClosers(config),
						opener,
						paths: `${statementType} at line ${statementNode.loc.start.line}`,
					},
					messageId: "unpairedOpener",
					node,
				});
			}
		}

		function onBreakContinue(node: TSESTree.BreakStatement | TSESTree.ContinueStatement): void {
			if (openerStack.length === 0) return;

			const targetLoop =
				node.type === AST_NODE_TYPES.ContinueStatement
					? resolveContinueTargetLoop(node)
					: resolveBreakTargetLoop(node);

			if (!targetLoop) return;

			for (const { node: openerNode, config, opener, loopAncestors } of openerStack) {
				if (!loopAncestors.includes(targetLoop)) continue;

				const statementType = node.type === AST_NODE_TYPES.BreakStatement ? "break" : "continue";

				context.report({
					data: {
						closer: formatValidClosers(config),
						opener,
						paths: `${statementType} at line ${node.loc.start.line}`,
					},
					messageId: "unpairedOpener",
					node: openerNode,
				});
			}
		}

		function onCallExpression(node: TSESTree.CallExpression): void {
			const callName = getCallName(node);
			if (callName === undefined || callName.length === 0) return;

			const openerConfig = findPairConfiguration(callName, true);
			if (openerConfig) {
				handleOpener(node, callName, openerConfig);
				return;
			}

			if (findPairConfiguration(callName, false)) {
				handleCloser(node, callName);
				return;
			}

			for (const entry of openerStack) {
				if (!isRobloxYieldingFunction(callName, entry.config)) continue;

				handleRobloxYield(node, callName, entry);
				openerStack.length = 0;
				yieldingAutoClosed = true;
				return;
			}
		}

		function handleOpener(node: TSESTree.CallExpression, opener: string, config: PairConfiguration): void {
			const maxDepth = options.maxNestingDepth;
			if (maxDepth > 0 && openerStack.length >= maxDepth) {
				context.report({
					data: { max: String(maxDepth) },
					messageId: "maxNestingExceeded",
					node,
				});
			}

			if (!options.allowMultipleOpeners && openerStack.length > 0 && openerStack.at(-1)?.opener === opener) {
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
				loopAncestors: [...loopStack],
				node,
				opener,
			};

			openerStack.push(entry);
		}

		function handleCloser(node: TSESTree.CallExpression, closer: string): void {
			const matchingIndex = openerStack.findLastIndex((entry) => getValidClosers(entry.config).includes(closer));

			if (matchingIndex === -1) {
				if (yieldingAutoClosed && !yieldingReportedFirst) {
					yieldingReportedFirst = true;
					return;
				}

				if (openerStack.length === 0) {
					context.report({
						data: { closer },
						messageId: "unpairedCloser",
						node,
					});
					return;
				}

				const expectedClosers = openerStack
					.slice(-1)
					.flatMap((topEntry) => getExpectedClosersForOpener(topEntry.opener));
				const expected = formatOpenerList(expectedClosers);

				context.report({
					data: { closer, expected },
					messageId: "unexpectedCloser",
					node,
				});

				return;
			}

			const matchingEntries = openerStack.filter((_, index) => index === matchingIndex);

			for (const matchingEntry of matchingEntries) {
				if (matchingIndex === openerStack.length - 1) continue;

				context.report({
					data: {
						actual: formatOpenerList(openerStack.slice(-1).map((topEntry) => topEntry.opener)),
						closer,
						expected: matchingEntry.opener,
					},
					messageId: "wrongOrder",
					node,
				});
			}

			openerStack.splice(matchingIndex, 1);
		}

		function handleRobloxYield(
			node: TSESTree.CallExpression,
			yieldingFunction: string,
			openerEntry: OpenerStackEntry,
		): void {
			context.report({
				data: { closer: formatValidClosers(openerEntry.config), yieldingFunction },
				messageId: "robloxYieldViolation",
				node,
			});
		}

		function onAsyncYield(
			asyncNode: TSESTree.AwaitExpression | TSESTree.ForOfStatement | TSESTree.YieldExpression,
		): void {
			for (const { opener, config } of openerStack) {
				if (config.requireSync !== true) continue;

				const asyncType = asyncNode.type === AST_NODE_TYPES.AwaitExpression ? "await" : "yield";

				context.report({
					data: { asyncType, closer: formatValidClosers(config), opener },
					messageId: "asyncViolation",
					node: asyncNode,
				});
			}
		}

		function onForOfStatementEnter(node: TSESTree.ForOfStatement): void {
			if (node.await) onAsyncYield(node);
			onLoopEnter(node);
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
			ForOfStatement: onForOfStatementEnter,
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

			TryStatement: startBranchTracking,
			"TryStatement > .block": onTryBlockEnter,
			"TryStatement > .block:exit": onTryBlockExit,
			"TryStatement > .finalizer": onFinallyBlockEnter,
			"TryStatement > .finalizer:exit": popContext,
			"TryStatement:exit": onTryStatementExit,
			WhileStatement: onLoopEnter,
			"WhileStatement:exit": onLoopExit,
			YieldExpression: onAsyncYield,
		};
	},
	meta: {
		defaultOptions: [{}],
		docs: {
			description: "Enforces balanced opener/closer function calls across all execution paths",
		},
		fixable: "code",
		messages,
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
						default: [],
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
								openerAlternatives: {
									items: { minLength: 1, type: "string" },
									type: "array",
								},
								platform: {
									enum: ["roblox"],
									type: "string",
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
						type: "array",
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
	name: "require-paired-calls",
});

export default requirePairedCalls;
