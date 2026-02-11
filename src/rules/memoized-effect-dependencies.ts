import { DefinitionType, ScopeType } from "@typescript-eslint/scope-manager";
import { TSESTree } from "@typescript-eslint/types";
import type { TSESLint } from "@typescript-eslint/utils";
import { getReactSources, isReactImport } from "../constants/react-sources";
import type { EnvironmentMode } from "../types/environment-mode";
import { createRule } from "../utilities/create-rule";

type Mode = "definite" | "moderate" | "aggressive";

interface HookEntry {
	readonly name: string;
	readonly dependenciesIndex?: number;
}

export interface MemoizedEffectDependenciesOptions {
	readonly environment?: EnvironmentMode;
	readonly hooks?: ReadonlyArray<HookEntry>;
	readonly mode?: Mode;
}

type Options = [MemoizedEffectDependenciesOptions?];

type MessageIds = "unmemoizedDependency";

type Stability = "memoized" | "unmemoized" | "unknown";

const DEFAULT_EFFECT_HOOKS = new Map<string, number>([
	["useEffect", 1],
	["useLayoutEffect", 1],
	["useInsertionEffect", 1],
]);

const MEMO_HOOKS = new Set(["useMemo", "useCallback"]);
const STABLE_HOOKS_WHOLE = new Set(["useRef", "useBinding"]);
const STABLE_HOOKS_INDEX1 = new Set(["useState", "useReducer", "useTransition"]);
const STABLE_HOOKS = new Set([...STABLE_HOOKS_WHOLE, ...STABLE_HOOKS_INDEX1]);

const UNMEMOIZED_INLINE_TYPES = new Set<TSESTree.AST_NODE_TYPES>([
	TSESTree.AST_NODE_TYPES.ObjectExpression,
	TSESTree.AST_NODE_TYPES.ArrayExpression,
	TSESTree.AST_NODE_TYPES.FunctionExpression,
	TSESTree.AST_NODE_TYPES.ArrowFunctionExpression,
	TSESTree.AST_NODE_TYPES.ClassExpression,
	TSESTree.AST_NODE_TYPES.NewExpression,
]);

const TS_RUNTIME_EXPRESSIONS = new Set<TSESTree.AST_NODE_TYPES>([
	TSESTree.AST_NODE_TYPES.TSNonNullExpression,
	TSESTree.AST_NODE_TYPES.TSAsExpression,
	TSESTree.AST_NODE_TYPES.TSSatisfiesExpression,
	TSESTree.AST_NODE_TYPES.TSTypeAssertion,
	TSESTree.AST_NODE_TYPES.TSInstantiationExpression,
]);

const DEFAULT_OPTIONS: Required<MemoizedEffectDependenciesOptions> = {
	environment: "roblox-ts",
	hooks: [],
	mode: "definite",
};

function unwrapExpression(node: TSESTree.Node): TSESTree.Node {
	let current: TSESTree.Node = node;

	while (true) {
		if (current.type === TSESTree.AST_NODE_TYPES.ChainExpression) {
			current = current.expression;
			continue;
		}
		if (TS_RUNTIME_EXPRESSIONS.has(current.type)) {
			current = (
				current as
					| TSESTree.TSAsExpression
					| TSESTree.TSNonNullExpression
					| TSESTree.TSSatisfiesExpression
					| TSESTree.TSTypeAssertion
					| TSESTree.TSInstantiationExpression
			).expression;
			continue;
		}
		break;
	}

	return current;
}

function getMemberHookName(callee: TSESTree.MemberExpression, reactNamespaces: Set<string>): string | undefined {
	if (callee.computed) return undefined;
	if (callee.object.type !== TSESTree.AST_NODE_TYPES.Identifier) return undefined;
	if (!reactNamespaces.has(callee.object.name)) return undefined;
	if (callee.property.type !== TSESTree.AST_NODE_TYPES.Identifier) return undefined;
	return callee.property.name;
}

function getRootIdentifier(node: TSESTree.Node): TSESTree.Identifier | undefined {
	let current = unwrapExpression(node);

	while (current.type === TSESTree.AST_NODE_TYPES.MemberExpression) {
		current = unwrapExpression(current.object);
	}

	return current.type === TSESTree.AST_NODE_TYPES.Identifier ? current : undefined;
}

function isUnmemoizedInline(node: TSESTree.Node): boolean {
	return UNMEMOIZED_INLINE_TYPES.has(node.type);
}

function getImportedName(specifier: TSESTree.ImportSpecifier): string | undefined {
	if (specifier.imported.type === TSESTree.AST_NODE_TYPES.Identifier) return specifier.imported.name;
	if (specifier.imported.type === TSESTree.AST_NODE_TYPES.Literal && typeof specifier.imported.value === "string") {
		return specifier.imported.value;
	}
	return undefined;
}

function getPatternElementName(element: TSESTree.ArrayPattern["elements"][number] | undefined): string | undefined {
	if (!element) return undefined;
	if (element.type === TSESTree.AST_NODE_TYPES.Identifier) return element.name;
	if (
		element.type === TSESTree.AST_NODE_TYPES.AssignmentPattern &&
		element.left.type === TSESTree.AST_NODE_TYPES.Identifier
	) {
		return element.left.name;
	}
	if (
		element.type === TSESTree.AST_NODE_TYPES.RestElement &&
		element.argument.type === TSESTree.AST_NODE_TYPES.Identifier
	) {
		return element.argument.name;
	}
	return undefined;
}

function isIdentifierAtArrayIndex(pattern: TSESTree.ArrayPattern, identifierName: string, index: number): boolean {
	const element = pattern.elements[index];
	return getPatternElementName(element) === identifierName;
}

function isModuleScope(variable: TSESLint.Scope.Variable): boolean {
	const scopeType = variable.scope?.type;
	return scopeType === ScopeType.module || scopeType === ScopeType.global;
}

const memoizedEffectDependencies = createRule<Options, MessageIds>({
	create(context) {
		const options: Required<MemoizedEffectDependenciesOptions> = {
			...DEFAULT_OPTIONS,
			...context.options[0],
		};

		const effectHookNameToIndex = new Map(DEFAULT_EFFECT_HOOKS);
		for (const hook of options.hooks) {
			if (!hook?.name) continue;
			effectHookNameToIndex.set(hook.name, hook.dependenciesIndex ?? 1);
		}

		const reactSources = getReactSources(options.environment);
		const reactNamespaces = new Set<string>();
		const effectHookIdentifiers = new Map<string, number>();
		const memoHookIdentifiers = new Set<string>();
		const stableHookIdentifiers = new Map<string, string>();

		const scopeCache = new WeakMap<TSESTree.Node, TSESLint.Scope.Scope>();
		const variableStabilityCache = new WeakMap<TSESLint.Scope.Variable, Stability>();

		const { sourceCode } = context;

		function getScope(node: TSESTree.Node): TSESLint.Scope.Scope {
			const cached = scopeCache.get(node);
			if (cached) return cached;
			const scope = sourceCode.getScope(node);
			scopeCache.set(node, scope);
			return scope;
		}

		function resolveVariable(identifier: TSESTree.Identifier): TSESLint.Scope.Variable | undefined {
			let scope: TSESLint.Scope.Scope | null = getScope(identifier);
			while (scope) {
				const found = scope.set.get(identifier.name);
				if (found) return found;
				scope = scope.upper;
			}
			return undefined;
		}

		function isMemoHookCall(node: TSESTree.CallExpression): boolean {
			const { callee } = node;
			if (callee.type === TSESTree.AST_NODE_TYPES.Identifier) {
				return memoHookIdentifiers.has(callee.name);
			}
			if (callee.type === TSESTree.AST_NODE_TYPES.MemberExpression) {
				const hookName = getMemberHookName(callee, reactNamespaces);
				return hookName ? MEMO_HOOKS.has(hookName) : false;
			}
			return false;
		}

		function getStableHookKind(node: TSESTree.CallExpression): "whole" | "index1" | undefined {
			const { callee } = node;
			if (callee.type === TSESTree.AST_NODE_TYPES.Identifier) {
				const importedName = stableHookIdentifiers.get(callee.name);
				if (!importedName) return undefined;
				if (STABLE_HOOKS_WHOLE.has(importedName)) return "whole";
				if (STABLE_HOOKS_INDEX1.has(importedName)) return "index1";
				return undefined;
			}
			if (callee.type === TSESTree.AST_NODE_TYPES.MemberExpression) {
				const hookName = getMemberHookName(callee, reactNamespaces);
				if (!hookName) return undefined;
				if (STABLE_HOOKS_WHOLE.has(hookName)) return "whole";
				if (STABLE_HOOKS_INDEX1.has(hookName)) return "index1";
			}
			return undefined;
		}

		function getDefinitionStability(definition: TSESLint.Scope.Definition, variableName: string): Stability {
			if (definition.type === DefinitionType.Parameter) return "unknown";
			if (definition.type === DefinitionType.ImportBinding) return "memoized";

			const defNode = definition.node;
			if (!defNode) return "unknown";
			if (
				defNode.type === TSESTree.AST_NODE_TYPES.FunctionDeclaration ||
				defNode.type === TSESTree.AST_NODE_TYPES.ClassDeclaration
			) {
				return "unmemoized";
			}
			if (defNode.type !== TSESTree.AST_NODE_TYPES.VariableDeclarator) return "unknown";

			const declarationParent = defNode.parent;
			if (
				declarationParent?.type === TSESTree.AST_NODE_TYPES.VariableDeclaration &&
				declarationParent.kind !== "const"
			) {
				return options.mode === "definite" ? "unknown" : "unmemoized";
			}

			const init = defNode.init ? unwrapExpression(defNode.init) : undefined;
			if (!init) return "unknown";
			if (isUnmemoizedInline(init)) return "unmemoized";

			if (init.type === TSESTree.AST_NODE_TYPES.CallExpression) {
				if (isMemoHookCall(init)) return "memoized";
				const stableKind = getStableHookKind(init);
				if (stableKind === "whole") return "memoized";
				if (
					stableKind === "index1" &&
					defNode.id.type === TSESTree.AST_NODE_TYPES.ArrayPattern &&
					isIdentifierAtArrayIndex(defNode.id, variableName, 1)
				) {
					return "memoized";
				}
				return options.mode === "definite" ? "unknown" : "unmemoized";
			}

			return "unknown";
		}

		function getVariableStability(variable: TSESLint.Scope.Variable): Stability {
			const cached = variableStabilityCache.get(variable);
			if (cached) return cached;

			if (isModuleScope(variable)) {
				variableStabilityCache.set(variable, "memoized");
				return "memoized";
			}

			let sawMemoized = false;
			for (const definition of variable.defs) {
				const stability = getDefinitionStability(definition, variable.name);
				if (stability === "unmemoized") {
					variableStabilityCache.set(variable, "unmemoized");
					return "unmemoized";
				}
				if (stability === "memoized") sawMemoized = true;
			}

			let result: Stability = sawMemoized ? "memoized" : "unknown";
			if (options.mode === "aggressive" && result !== "memoized") result = "unmemoized";

			variableStabilityCache.set(variable, result);
			return result;
		}

		function classifyDependency(node: TSESTree.Node): Stability {
			const unwrapped = unwrapExpression(node);
			if (isUnmemoizedInline(unwrapped)) return "unmemoized";
			if (unwrapped.type === TSESTree.AST_NODE_TYPES.CallExpression) {
				return options.mode === "definite" ? "unknown" : "unmemoized";
			}

			const rootIdentifier = getRootIdentifier(unwrapped);
			if (!rootIdentifier) return "unknown";
			const variable = resolveVariable(rootIdentifier);
			return variable ? getVariableStability(variable) : "unknown";
		}

		function getDependenciesIndex(node: TSESTree.CallExpression): number | undefined {
			const { callee } = node;
			if (callee.type === TSESTree.AST_NODE_TYPES.Identifier) {
				return effectHookIdentifiers.get(callee.name);
			}
			if (callee.type === TSESTree.AST_NODE_TYPES.MemberExpression) {
				const hookName = getMemberHookName(callee, reactNamespaces);
				return hookName ? effectHookNameToIndex.get(hookName) : undefined;
			}
			return undefined;
		}

		return {
			CallExpression(node): void {
				const dependenciesIndex = getDependenciesIndex(node);
				if (dependenciesIndex === undefined) return;

				const depsArgument = node.arguments[dependenciesIndex];
				if (!depsArgument || depsArgument.type !== TSESTree.AST_NODE_TYPES.ArrayExpression) return;

				for (const element of depsArgument.elements) {
					if (!element) continue;
					if (element.type === TSESTree.AST_NODE_TYPES.SpreadElement) {
						if (options.mode === "definite") continue;
						const spreadTarget = element.argument;
						const spreadName = sourceCode.getText(spreadTarget);
						context.report({
							data: { name: spreadName },
							messageId: "unmemoizedDependency",
							node: spreadTarget,
						});
						continue;
					}

					const stability = classifyDependency(element);
					if (stability !== "unmemoized") continue;
					const name = sourceCode.getText(element);
					context.report({
						data: { name },
						messageId: "unmemoizedDependency",
						node: element,
					});
				}
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

					const importedName = getImportedName(specifier);
					if (!importedName) continue;

					if (effectHookNameToIndex.has(importedName)) {
						effectHookIdentifiers.set(specifier.local.name, effectHookNameToIndex.get(importedName) ?? 1);
					}
					if (MEMO_HOOKS.has(importedName)) memoHookIdentifiers.add(specifier.local.name);
					if (STABLE_HOOKS.has(importedName)) stableHookIdentifiers.set(specifier.local.name, importedName);
				}
			},
		};
	},
	defaultOptions: [DEFAULT_OPTIONS],
	meta: {
		docs: {
			description:
				"Experimental: Flags effect dependencies that are not memoized. Unmemoized dependencies can cause unnecessary re-renders or infinite loops.",
		},
		messages: {
			unmemoizedDependency:
				"{{name}} is not memoized. Wrap it in useMemo/useCallback or move it to module scope.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					environment: {
						default: "roblox-ts",
						description: "The React environment: 'roblox-ts' uses @rbxts/react, 'standard' uses react.",
						enum: ["roblox-ts", "standard"],
						type: "string",
					},
					hooks: {
						description: "Array of effect hook entries to check for memoized dependencies",
						items: {
							additionalProperties: false,
							properties: {
								dependenciesIndex: {
									description: "Index of the dependencies array for validation",
									type: "number",
								},
								name: {
									description: "The name of the hook",
									type: "string",
								},
							},
							required: ["name"],
							type: "object",
						},
						type: "array",
					},
					mode: {
						default: "definite",
						description:
							"Strictness for memoization detection: definite (only obvious), moderate (unknown calls and non-const), aggressive (any non-module).",
						enum: ["definite", "moderate", "aggressive"],
						type: "string",
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
	name: "memoized-effect-dependencies",
});

export default memoizedEffectDependencies;
