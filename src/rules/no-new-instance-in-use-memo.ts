import { DefinitionType } from "@typescript-eslint/scope-manager";
import { TSESTree } from "@typescript-eslint/types";
import type { TSESLint } from "@typescript-eslint/utils";

import { getReactSources, isReactImport } from "../constants/react-sources";
import type { EnvironmentMode } from "../types/environment-mode";
import { createRule } from "../utilities/create-rule";

type MessageIds = "noNewInUseMemo";

export interface NoNewInstanceInUseMemoOptions {
	readonly constructors?: ReadonlyArray<string>;
	readonly environment?: EnvironmentMode;
	readonly maxHelperTraceDepth?: number;
}

type Options = [NoNewInstanceInUseMemoOptions?];

type FunctionLikeExpression = TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression;
type FunctionNode = FunctionLikeExpression | TSESTree.FunctionDeclaration;

interface NormalizedOptions {
	readonly constructors: ReadonlySet<string>;
	readonly environment: EnvironmentMode;
	readonly maxHelperTraceDepth: number;
}

interface FunctionInfo {
	readonly id: number;
	readonly callees: Set<number>;
	readonly callIdentifiers: Array<TSESTree.Identifier>;
}

interface TrackedNewExpression {
	readonly constructorName: string;
	readonly containingFunctionId: number | undefined;
	readonly isLexicallyInsideUseMemo: boolean;
	readonly node: TSESTree.NewExpression;
}

interface TraversalState {
	readonly depth: number;
	readonly functionId: number;
}

const DEFAULT_OPTIONS: Required<NoNewInstanceInUseMemoOptions> = {
	constructors: ["Instance"],
	environment: "roblox-ts",
	maxHelperTraceDepth: 4,
};

function normalizeOptions(raw?: NoNewInstanceInUseMemoOptions): NormalizedOptions {
	const candidateDepth = raw?.maxHelperTraceDepth;
	const maxHelperTraceDepth =
		typeof candidateDepth === "number" && Number.isInteger(candidateDepth) && candidateDepth >= 0
			? candidateDepth
			: DEFAULT_OPTIONS.maxHelperTraceDepth;

	return {
		constructors: new Set(raw?.constructors ?? DEFAULT_OPTIONS.constructors),
		environment: raw?.environment ?? DEFAULT_OPTIONS.environment,
		maxHelperTraceDepth,
	};
}

function getImportedName(specifier: TSESTree.ImportSpecifier): string | undefined {
	const { imported } = specifier;
	if (imported.type === TSESTree.AST_NODE_TYPES.Identifier) return imported.name;
	if (imported.type === TSESTree.AST_NODE_TYPES.Literal && typeof imported.value === "string") return imported.value;
	return undefined;
}

function isUseMemoCall(
	node: TSESTree.CallExpression,
	memoIdentifiers: ReadonlySet<string>,
	reactNamespaces: ReadonlySet<string>,
): boolean {
	const { callee } = node;

	if (callee.type === TSESTree.AST_NODE_TYPES.Identifier) return memoIdentifiers.has(callee.name);
	if (callee.type !== TSESTree.AST_NODE_TYPES.MemberExpression) return false;
	if (callee.computed) return false;
	if (callee.object.type !== TSESTree.AST_NODE_TYPES.Identifier) return false;
	if (callee.property.type !== TSESTree.AST_NODE_TYPES.Identifier) return false;

	return reactNamespaces.has(callee.object.name) && callee.property.name === "useMemo";
}

function isFunctionLikeExpression(node: TSESTree.Node): node is FunctionLikeExpression {
	return (
		node.type === TSESTree.AST_NODE_TYPES.ArrowFunctionExpression ||
		node.type === TSESTree.AST_NODE_TYPES.FunctionExpression
	);
}

function isCallExpression(node: TSESTree.Node | undefined): node is TSESTree.CallExpression {
	return node?.type === TSESTree.AST_NODE_TYPES.CallExpression;
}

function unwrapExpression(expression: TSESTree.Expression): TSESTree.Expression {
	let current = expression;

	while (true) {
		if (current.type === TSESTree.AST_NODE_TYPES.TSAsExpression) {
			current = current.expression;
			continue;
		}

		if (current.type === TSESTree.AST_NODE_TYPES.TSNonNullExpression) {
			current = current.expression;
			continue;
		}

		if (current.type === TSESTree.AST_NODE_TYPES.TSSatisfiesExpression) {
			current = current.expression;
			continue;
		}

		if (current.type === TSESTree.AST_NODE_TYPES.TSTypeAssertion) {
			current = current.expression;
			continue;
		}

		return current;
	}
}

function findVariable(
	context: TSESLint.RuleContext<MessageIds, Options>,
	identifier: TSESTree.Identifier,
): TSESLint.Scope.Variable | undefined {
	let scope: TSESLint.Scope.Scope | null = context.sourceCode.getScope(identifier);

	while (scope !== null) {
		const variable = scope.set.get(identifier.name);
		if (variable !== undefined) return variable;
		scope = scope.upper;
	}

	return undefined;
}

function resolveVariableToFunctionIds(
	context: TSESLint.RuleContext<MessageIds, Options>,
	variable: TSESLint.Scope.Variable,
	functionInfosByNode: ReadonlyMap<FunctionNode, FunctionInfo>,
	cache: Map<TSESLint.Scope.Variable, ReadonlySet<number>>,
	visited: Set<TSESLint.Scope.Variable>,
): ReadonlySet<number> {
	const cached = cache.get(variable);
	if (cached !== undefined) return cached;

	if (visited.has(variable)) return new Set<number>();
	visited.add(variable);

	const functionIds = new Set<number>();

	for (const definition of variable.defs) {
		if (definition.type === DefinitionType.FunctionName) {
			if (definition.node.type !== TSESTree.AST_NODE_TYPES.FunctionDeclaration) continue;

			const functionId = functionInfosByNode.get(definition.node)?.id;
			if (functionId !== undefined) functionIds.add(functionId);
			continue;
		}

		if (definition.type !== DefinitionType.Variable) continue;
		if (definition.node.init === null) continue;

		const initializer = unwrapExpression(definition.node.init);
		if (isFunctionLikeExpression(initializer)) {
			const functionId = functionInfosByNode.get(initializer)?.id;
			if (functionId !== undefined) functionIds.add(functionId);
			continue;
		}

		if (initializer.type !== TSESTree.AST_NODE_TYPES.Identifier) continue;
		const aliasVariable = findVariable(context, initializer);
		if (aliasVariable === undefined) continue;

		const resolved = resolveVariableToFunctionIds(context, aliasVariable, functionInfosByNode, cache, visited);
		for (const functionId of resolved) functionIds.add(functionId);
	}

	visited.delete(variable);
	cache.set(variable, functionIds);
	return functionIds;
}

function resolveIdentifierToFunctionIds(
	context: TSESLint.RuleContext<MessageIds, Options>,
	identifier: TSESTree.Identifier,
	functionInfosByNode: ReadonlyMap<FunctionNode, FunctionInfo>,
	cache: Map<TSESLint.Scope.Variable, ReadonlySet<number>>,
): ReadonlySet<number> {
	const variable = findVariable(context, identifier);
	if (variable === undefined) return new Set<number>();

	return resolveVariableToFunctionIds(context, variable, functionInfosByNode, cache, new Set<TSESLint.Scope.Variable>());
}

function collectReachableFunctions(
	rootFunctionIds: ReadonlySet<number>,
	functionInfosById: ReadonlyMap<number, FunctionInfo>,
	maxHelperTraceDepth: number,
): ReadonlySet<number> {
	const visited = new Set<number>(rootFunctionIds);
	const queue: Array<TraversalState> = [...rootFunctionIds].map((functionId) => ({
		depth: 0,
		functionId,
	}));
	let queueIndex = 0;

	while (queueIndex < queue.length) {
		const current = queue[queueIndex];
		queueIndex += 1;
		if (current === undefined) continue;

		if (current.depth >= maxHelperTraceDepth) continue;

		const functionInfo = functionInfosById.get(current.functionId);
		if (functionInfo === undefined) continue;

		for (const calleeId of functionInfo.callees) {
			if (visited.has(calleeId)) continue;
			visited.add(calleeId);
			queue.push({
				depth: current.depth + 1,
				functionId: calleeId,
			});
		}
	}

	return visited;
}

function isInsideUseMemoCallback(
	node: TSESTree.Node,
	memoIdentifiers: ReadonlySet<string>,
	reactNamespaces: ReadonlySet<string>,
): boolean {
	let current: TSESTree.Node | undefined = node.parent;

	while (current) {
		if (isFunctionLikeExpression(current)) {
			const callExpression: TSESTree.Node | undefined = current.parent;
			if (isCallExpression(callExpression) && callExpression.arguments[0] === current) {
				if (!isUseMemoCall(callExpression, memoIdentifiers, reactNamespaces)) {
					current = callExpression;
					continue;
				}

				return true;
			}
		}

		current = current.parent;
	}

	return false;
}

function populateCallGraph(
	context: TSESLint.RuleContext<MessageIds, Options>,
	functionInfosById: ReadonlyMap<number, FunctionInfo>,
	functionInfosByNode: ReadonlyMap<FunctionNode, FunctionInfo>,
	variableResolutionCache: Map<TSESLint.Scope.Variable, ReadonlySet<number>>,
): void {
	for (const functionInfo of functionInfosById.values()) {
		for (const identifier of functionInfo.callIdentifiers) {
			const resolvedFunctionIds = resolveIdentifierToFunctionIds(
				context,
				identifier,
				functionInfosByNode,
				variableResolutionCache,
			);

			for (const resolvedFunctionId of resolvedFunctionIds) {
				functionInfo.callees.add(resolvedFunctionId);
			}
		}
	}
}

function collectRootFunctionIds(
	context: TSESLint.RuleContext<MessageIds, Options>,
	useMemoInlineCallbacks: ReadonlyArray<FunctionLikeExpression>,
	useMemoCallbackIdentifiers: ReadonlyArray<TSESTree.Identifier>,
	functionInfosByNode: ReadonlyMap<FunctionNode, FunctionInfo>,
	variableResolutionCache: Map<TSESLint.Scope.Variable, ReadonlySet<number>>,
): ReadonlySet<number> {
	const rootFunctionIds = new Set<number>();

	for (const callback of useMemoInlineCallbacks) {
		const functionId = functionInfosByNode.get(callback)?.id;
		if (functionId !== undefined) rootFunctionIds.add(functionId);
	}

	for (const callbackIdentifier of useMemoCallbackIdentifiers) {
		const resolvedFunctionIds = resolveIdentifierToFunctionIds(
			context,
			callbackIdentifier,
			functionInfosByNode,
			variableResolutionCache,
		);
		for (const resolvedFunctionId of resolvedFunctionIds) rootFunctionIds.add(resolvedFunctionId);
	}

	return rootFunctionIds;
}

const noNewInstanceInUseMemo = createRule<Options, MessageIds>({
	create(context) {
		const options = normalizeOptions(context.options[0]);
		if (options.constructors.size === 0) return {};

		const reactSources = getReactSources(options.environment);
		const memoIdentifiers = new Set<string>();
		const reactNamespaces = new Set<string>();
		const functionInfosByNode = new Map<FunctionNode, FunctionInfo>();
		const functionInfosById = new Map<number, FunctionInfo>();
		const functionStack: Array<number> = [];
		const trackedNewExpressions: Array<TrackedNewExpression> = [];
		const useMemoCallbackIdentifiers: Array<TSESTree.Identifier> = [];
		const useMemoInlineCallbacks: Array<FunctionLikeExpression> = [];
		const variableResolutionCache = new Map<TSESLint.Scope.Variable, ReadonlySet<number>>();
		let functionCounter = 0;

		function getOrCreateFunctionInfo(node: FunctionNode): FunctionInfo {
			const existing = functionInfosByNode.get(node);
			if (existing !== undefined) return existing;

			const created: FunctionInfo = {
				callees: new Set<number>(),
				callIdentifiers: [],
				id: functionCounter,
			};

			functionCounter += 1;
			functionInfosByNode.set(node, created);
			functionInfosById.set(created.id, created);
			return created;
		}

		function recordFunctionCall(identifier: TSESTree.Identifier): void {
			const currentFunctionId = functionStack.at(-1);
			if (currentFunctionId === undefined) return;

			const functionInfo = functionInfosById.get(currentFunctionId);
			if (functionInfo === undefined) return;

			functionInfo.callIdentifiers.push(identifier);
		}

		function enterFunction(node: FunctionNode): void {
			const functionInfo = getOrCreateFunctionInfo(node);
			functionStack.push(functionInfo.id);
		}

		function exitFunction(): void {
			functionStack.pop();
		}

		return {
			ArrowFunctionExpression(node): void {
				enterFunction(node);
			},

			"ArrowFunctionExpression:exit"(): void {
				exitFunction();
			},

				CallExpression(node): void {
					if (node.callee.type === TSESTree.AST_NODE_TYPES.Identifier) recordFunctionCall(node.callee);

					if (!isUseMemoCall(node, memoIdentifiers, reactNamespaces)) return;
					const [callback] = node.arguments;
					if (callback === undefined) return;

				if (callback.type === TSESTree.AST_NODE_TYPES.Identifier) {
					useMemoCallbackIdentifiers.push(callback);
					return;
				}

				if (isFunctionLikeExpression(callback)) useMemoInlineCallbacks.push(callback);
			},

			FunctionDeclaration(node): void {
				enterFunction(node);
			},

			"FunctionDeclaration:exit"(): void {
				exitFunction();
			},

			FunctionExpression(node): void {
				enterFunction(node);
			},

			"FunctionExpression:exit"(): void {
				exitFunction();
			},

			ImportDeclaration(node): void {
				if (!isReactImport(node, reactSources)) return;

				for (const specifier of node.specifiers) {
					if (
						specifier.type === TSESTree.AST_NODE_TYPES.ImportDefaultSpecifier ||
						specifier.type === TSESTree.AST_NODE_TYPES.ImportNamespaceSpecifier
					) {
						reactNamespaces.add(specifier.local.name);
						continue;
					}

					if (specifier.type !== TSESTree.AST_NODE_TYPES.ImportSpecifier) continue;
					if (getImportedName(specifier) === "useMemo") memoIdentifiers.add(specifier.local.name);
				}
			},

			NewExpression(node): void {
				if (node.callee.type !== TSESTree.AST_NODE_TYPES.Identifier) return;

				const constructorName = node.callee.name;
				if (!options.constructors.has(constructorName)) return;

				trackedNewExpressions.push({
					constructorName,
					containingFunctionId: functionStack.at(-1),
					isLexicallyInsideUseMemo: isInsideUseMemoCallback(node, memoIdentifiers, reactNamespaces),
					node,
				});
			},

			"Program:exit"(): void {
				populateCallGraph(context, functionInfosById, functionInfosByNode, variableResolutionCache);
				const rootFunctionIds = collectRootFunctionIds(
					context,
					useMemoInlineCallbacks,
					useMemoCallbackIdentifiers,
					functionInfosByNode,
					variableResolutionCache,
				);
				const reachableFunctionIds = collectReachableFunctions(
					rootFunctionIds,
					functionInfosById,
					options.maxHelperTraceDepth,
				);

				for (const trackedNewExpression of trackedNewExpressions) {
					const matchesHelperTrace =
						trackedNewExpression.containingFunctionId !== undefined &&
						reachableFunctionIds.has(trackedNewExpression.containingFunctionId);

					if (!(trackedNewExpression.isLexicallyInsideUseMemo || matchesHelperTrace)) continue;

					context.report({
						data: { constructorName: trackedNewExpression.constructorName },
						messageId: "noNewInUseMemo",
						node: trackedNewExpression.node,
					});
				}
			},
		};
	},
	defaultOptions: [{}],
	meta: {
		docs: {
			description:
				"Disallow configured constructor calls (default: new Instance) inside React useMemo callbacks.",
		},
		messages: {
			noNewInUseMemo:
				"Avoid creating '{{constructorName}}' with `new` inside useMemo. Create it outside the memo callback or use an effect/ref pattern.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					constructors: {
						description: "Constructor identifiers that should be disallowed inside useMemo callbacks.",
						items: { type: "string" },
						type: "array",
					},
					environment: {
						default: "roblox-ts",
						description: "The React environment: 'roblox-ts' uses @rbxts/react, 'standard' uses react.",
						enum: ["roblox-ts", "standard"],
						type: "string",
					},
					maxHelperTraceDepth: {
						default: 4,
						description:
							"Maximum depth for tracing local helper function calls from useMemo callbacks. 0 disables helper traversal.",
						minimum: 0,
						type: "integer",
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
	name: "no-new-instance-in-use-memo",
});

export default noNewInstanceInUseMemo;
