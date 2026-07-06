import { getReactSources, isReactImport } from "$constants/react-sources";
import { getImportSpecifierName, unwrapExpression } from "$utilities/ast-utilities";
import { createRule } from "$utilities/create-rule";
import { isNamedReactHookCall } from "$utilities/react-hook-utilities";
import { DefinitionType } from "@typescript-eslint/scope-manager";
import { TSESTree } from "@typescript-eslint/types";

import type { EnvironmentMode } from "$types/environment-mode";
import type { TSESLint } from "@typescript-eslint/utils";

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
	readonly callees: Set<FunctionInfo>;
	readonly callIdentifiers: Array<TSESTree.Identifier>;
}

interface TrackedNewExpression {
	readonly constructorName: string;
	readonly containingFunctionInfo: FunctionInfo | undefined;
	readonly isLexicallyInsideUseMemo: boolean;
	readonly node: TSESTree.NewExpression;
}

interface TraversalState {
	readonly depth: number;
	readonly functionInfo: FunctionInfo;
}

const DEFAULT_OPTIONS: Required<NoNewInstanceInUseMemoOptions> = {
	constructors: ["Instance"],
	environment: "roblox-ts",
	maxHelperTraceDepth: 4,
};

function normalizeOptions({
	constructors = DEFAULT_OPTIONS.constructors,
	environment = DEFAULT_OPTIONS.environment,
	maxHelperTraceDepth = DEFAULT_OPTIONS.maxHelperTraceDepth,
}: NoNewInstanceInUseMemoOptions = DEFAULT_OPTIONS): NormalizedOptions {
	return {
		constructors: new Set(constructors),
		environment,
		maxHelperTraceDepth,
	};
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

function resolveVariableToFunctionInfos(
	context: TSESLint.RuleContext<MessageIds, Options>,
	variable: TSESLint.Scope.Variable,
	directFunctionInfosByDefinition: ReadonlyMap<TSESTree.Node, FunctionInfo>,
	cache: Map<TSESLint.Scope.Variable, ReadonlySet<FunctionInfo>>,
	visited: Set<TSESLint.Scope.Variable>,
): ReadonlySet<FunctionInfo> {
	const cached = cache.get(variable);
	if (cached !== undefined) return cached;

	if (visited.has(variable)) return new Set<FunctionInfo>();
	visited.add(variable);

	const functionInfos = new Set<FunctionInfo>();

	for (const definition of variable.defs) {
		const directFunctionInfo = directFunctionInfosByDefinition.get(definition.name);
		if (directFunctionInfo !== undefined) functionInfos.add(directFunctionInfo);

		if (definition.type !== DefinitionType.Variable || definition.node.init === null) continue;

		const initializer = unwrapExpression(definition.node.init);
		if (initializer.type !== TSESTree.AST_NODE_TYPES.Identifier) continue;
		const aliasVariable = findVariable(context, initializer);
		if (aliasVariable === undefined) continue;

		const resolved = resolveVariableToFunctionInfos(
			context,
			aliasVariable,
			directFunctionInfosByDefinition,
			cache,
			visited,
		);
		for (const functionInfo of resolved) functionInfos.add(functionInfo);
	}

	visited.delete(variable);
	cache.set(variable, functionInfos);
	return functionInfos;
}

function resolveIdentifierToFunctionInfos(
	context: TSESLint.RuleContext<MessageIds, Options>,
	identifier: TSESTree.Identifier,
	directFunctionInfosByDefinition: ReadonlyMap<TSESTree.Node, FunctionInfo>,
	cache: Map<TSESLint.Scope.Variable, ReadonlySet<FunctionInfo>>,
): ReadonlySet<FunctionInfo> {
	const variable = findVariable(context, identifier);
	if (variable === undefined) return new Set<FunctionInfo>();

	return resolveVariableToFunctionInfos(
		context,
		variable,
		directFunctionInfosByDefinition,
		cache,
		new Set<TSESLint.Scope.Variable>(),
	);
}

function collectReachableFunctions(
	rootFunctionInfos: ReadonlySet<FunctionInfo>,
	maxHelperTraceDepth: number,
): ReadonlySet<FunctionInfo> {
	const visited = new Set<FunctionInfo>(rootFunctionInfos);
	const queue = new Array<TraversalState>();
	for (const functionInfo of rootFunctionInfos) queue.push({ depth: 0, functionInfo });
	let current = queue.shift();
	while (current !== undefined) {
		if (current.depth >= maxHelperTraceDepth) {
			current = queue.shift();
			continue;
		}

		for (const functionInfo of current.functionInfo.callees) {
			if (visited.has(functionInfo)) continue;
			visited.add(functionInfo);
			queue.push({
				depth: current.depth + 1,
				functionInfo,
			});
		}
		current = queue.shift();
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
				if (!isNamedReactHookCall(callExpression, "useMemo", memoIdentifiers, reactNamespaces)) {
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
	functionInfos: ReadonlyArray<FunctionInfo>,
	directFunctionInfosByDefinition: ReadonlyMap<TSESTree.Node, FunctionInfo>,
	variableResolutionCache: Map<TSESLint.Scope.Variable, ReadonlySet<FunctionInfo>>,
): void {
	for (const functionInfo of functionInfos) {
		for (const identifier of functionInfo.callIdentifiers) {
			const resolvedFunctionInfos = resolveIdentifierToFunctionInfos(
				context,
				identifier,
				directFunctionInfosByDefinition,
				variableResolutionCache,
			);

			for (const resolvedFunctionInfo of resolvedFunctionInfos) {
				functionInfo.callees.add(resolvedFunctionInfo);
			}
		}
	}
}

function collectRootFunctionInfos(
	context: TSESLint.RuleContext<MessageIds, Options>,
	useMemoInlineCallbackInfos: ReadonlyArray<FunctionInfo>,
	useMemoCallbackIdentifiers: ReadonlyArray<TSESTree.Identifier>,
	directFunctionInfosByDefinition: ReadonlyMap<TSESTree.Node, FunctionInfo>,
	variableResolutionCache: Map<TSESLint.Scope.Variable, ReadonlySet<FunctionInfo>>,
): ReadonlySet<FunctionInfo> {
	const rootFunctionInfos = new Set<FunctionInfo>(useMemoInlineCallbackInfos);

	for (const callbackIdentifier of useMemoCallbackIdentifiers) {
		const resolvedFunctionInfos = resolveIdentifierToFunctionInfos(
			context,
			callbackIdentifier,
			directFunctionInfosByDefinition,
			variableResolutionCache,
		);
		for (const resolvedFunctionInfo of resolvedFunctionInfos) rootFunctionInfos.add(resolvedFunctionInfo);
	}

	return rootFunctionInfos;
}

const noNewInstanceInUseMemo = createRule<Options, MessageIds>({
	create(context) {
		const options = normalizeOptions(context.options[0]);
		if (options.constructors.size === 0) return {};

		const reactSources = getReactSources(options.environment);
		const memoIdentifiers = new Set<string>();
		const reactNamespaces = new Set<string>();
		const directFunctionInfosByDefinition = new Map<TSESTree.Node, FunctionInfo>();
		const functionStack: Array<FunctionInfo> = [];
		const functionInfos: Array<FunctionInfo> = [];
		const trackedNewExpressions: Array<TrackedNewExpression> = [];
		const useMemoCallbackIdentifiers: Array<TSESTree.Identifier> = [];
		const useMemoInlineCallbackInfos: Array<FunctionInfo> = [];
		const variableResolutionCache = new Map<TSESLint.Scope.Variable, ReadonlySet<FunctionInfo>>();

		function createFunctionInfo(): FunctionInfo {
			const created: FunctionInfo = {
				callIdentifiers: [],
				callees: new Set<FunctionInfo>(),
			};

			functionInfos.push(created);
			return created;
		}

		function registerDirectFunctionInfo(node: FunctionNode, functionInfo: FunctionInfo): void {
			if (node.type === TSESTree.AST_NODE_TYPES.FunctionDeclaration) {
				if (node.id === null) return;

				directFunctionInfosByDefinition.set(node.id, functionInfo);
				return;
			}

			const { parent } = node;
			if (
				parent?.type !== TSESTree.AST_NODE_TYPES.VariableDeclarator ||
				parent.init !== node ||
				parent.id.type !== TSESTree.AST_NODE_TYPES.Identifier
			) {
				return;
			}

			directFunctionInfosByDefinition.set(parent.id, functionInfo);
		}

		function isDirectUseMemoCallback(node: FunctionNode): node is FunctionLikeExpression {
			if (!isFunctionLikeExpression(node)) return false;

			const callExpression = node.parent;
			return (
				isCallExpression(callExpression) &&
				callExpression.arguments[0] === node &&
				isNamedReactHookCall(callExpression, "useMemo", memoIdentifiers, reactNamespaces)
			);
		}

		function recordFunctionCall(identifier: TSESTree.Identifier): void {
			const functionInfo = functionStack.at(-1);
			if (functionInfo === undefined) return;

			functionInfo.callIdentifiers.push(identifier);
		}

		function enterFunction(node: FunctionNode): void {
			const functionInfo = createFunctionInfo();
			functionStack.push(functionInfo);
			registerDirectFunctionInfo(node, functionInfo);
			if (isDirectUseMemoCallback(node)) useMemoInlineCallbackInfos.push(functionInfo);
		}

		function exitFunction(): void {
			functionStack.pop();
		}

		return {
			ArrowFunctionExpression: enterFunction,
			"ArrowFunctionExpression:exit": exitFunction,

			CallExpression(node): void {
				if (node.callee.type === TSESTree.AST_NODE_TYPES.Identifier) recordFunctionCall(node.callee);

				if (!isNamedReactHookCall(node, "useMemo", memoIdentifiers, reactNamespaces)) return;
				const [callback] = node.arguments;
				if (callback === undefined) return;

				if (callback.type === TSESTree.AST_NODE_TYPES.Identifier) {
					useMemoCallbackIdentifiers.push(callback);
				}
			},
			FunctionDeclaration: enterFunction,
			"FunctionDeclaration:exit": exitFunction,
			FunctionExpression: enterFunction,
			"FunctionExpression:exit": exitFunction,
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

					if (getImportSpecifierName(specifier) === "useMemo") memoIdentifiers.add(specifier.local.name);
				}
			},

			NewExpression(node): void {
				if (node.callee.type !== TSESTree.AST_NODE_TYPES.Identifier) return;

				const constructorName = node.callee.name;
				if (!options.constructors.has(constructorName)) return;

				trackedNewExpressions.push({
					constructorName,
					containingFunctionInfo: functionStack.at(-1),
					isLexicallyInsideUseMemo: isInsideUseMemoCallback(node, memoIdentifiers, reactNamespaces),
					node,
				});
			},

			"Program:exit"(): void {
				populateCallGraph(context, functionInfos, directFunctionInfosByDefinition, variableResolutionCache);
				const rootFunctionInfos = collectRootFunctionInfos(
					context,
					useMemoInlineCallbackInfos,
					useMemoCallbackIdentifiers,
					directFunctionInfosByDefinition,
					variableResolutionCache,
				);
				const reachableFunctionInfos = collectReachableFunctions(
					rootFunctionInfos,
					options.maxHelperTraceDepth,
				);

				for (const trackedNewExpression of trackedNewExpressions) {
					const matchesHelperTrace =
						trackedNewExpression.containingFunctionInfo !== undefined &&
						reachableFunctionInfos.has(trackedNewExpression.containingFunctionInfo);

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
	meta: {
		defaultOptions: [{}],
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
