import { TSESTree } from "@typescript-eslint/types";
import type { Rule, Scope } from "eslint";
import Type from "typebox";
import { Compile } from "typebox/compile";

const FUNCTION_DECLARATIONS = new Set<TSESTree.AST_NODE_TYPES>([
	TSESTree.AST_NODE_TYPES.FunctionExpression,
	TSESTree.AST_NODE_TYPES.ArrowFunctionExpression,
	TSESTree.AST_NODE_TYPES.FunctionDeclaration,
]);

const UNSTABLE_VALUES = new Set<TSESTree.AST_NODE_TYPES>([
	...FUNCTION_DECLARATIONS,
	TSESTree.AST_NODE_TYPES.ObjectExpression,
	TSESTree.AST_NODE_TYPES.ArrayExpression,
]);

interface HookEntry {
	readonly name: string;
	readonly closureIndex?: number;
	readonly dependenciesIndex?: number;
	readonly stableResult?: boolean | number | ReadonlyArray<number> | ReadonlyArray<string>;
}

interface UseExhaustiveDependenciesOptions {
	readonly hooks?: ReadonlyArray<HookEntry>;
	readonly reportMissingDependenciesArray?: boolean;
	readonly reportUnnecessaryDependencies?: boolean;
}

interface HookConfig {
	readonly closureIndex: number;
	readonly dependenciesIndex: number;
}

type StableResult = boolean | ReadonlySet<number> | ReadonlySet<string>;

const testingMetrics = {
	moduleLevelStableConst: 0,
	outerScopeSkip: 0,
};

function resetTestingMetrics(): void {
	testingMetrics.moduleLevelStableConst = 0;
	testingMetrics.outerScopeSkip = 0;
}

interface VariableDefinitionLike {
	readonly node: TSESTree.Node | Rule.Node;
	readonly type: string;
}

interface VariableLike {
	readonly defs: ReadonlyArray<VariableDefinitionLike>;
}

interface DependencyInfo {
	readonly name: string;
	readonly node: TSESTree.Node;
	readonly depth: number;
}

interface CaptureInfo {
	readonly name: string;
	readonly node: TSESTree.Node;
	readonly usagePath: string;
	readonly variable: VariableLike | undefined;
	readonly depth: number;
}

const DEFAULT_HOOKS = new Map<string, HookConfig>([
	["useEffect", { closureIndex: 0, dependenciesIndex: 1 }],
	["useLayoutEffect", { closureIndex: 0, dependenciesIndex: 1 }],
	["useInsertionEffect", { closureIndex: 0, dependenciesIndex: 1 }],
	["useCallback", { closureIndex: 0, dependenciesIndex: 1 }],
	["useMemo", { closureIndex: 0, dependenciesIndex: 1 }],
	["useImperativeHandle", { closureIndex: 1, dependenciesIndex: 2 }],
	["useSpring", { closureIndex: 0, dependenciesIndex: 1 }],
	["useSprings", { closureIndex: 1, dependenciesIndex: 2 }],
	["useTrail", { closureIndex: 1, dependenciesIndex: 2 }],
]);

const STABLE_HOOKS = new Map<string, StableResult>([
	["useState", new Set([1])],
	["useReducer", new Set([1])],
	["useTransition", new Set([1])],
	["useRef", true],
	["useBinding", true],
]);

const STABLE_VALUE_TYPES = new Set(["ImportBinding", "FunctionDeclaration", "ClassDeclaration", "FunctionName"]);

const GLOBAL_BUILTINS = new Set([
	"undefined",
	"null",
	"Infinity",
	"NaN",

	"Array",
	"Object",
	"String",
	"Number",
	"Boolean",
	"Symbol",
	"BigInt",
	"Function",

	"Map",
	"Set",
	"WeakMap",
	"WeakSet",

	"Promise",

	"Date",
	"RegExp",
	"Error",
	"Math",
	"JSON",

	"parseInt",
	"parseFloat",
	"isNaN",
	"isFinite",
	"encodeURI",
	"encodeURIComponent",
	"decodeURI",
	"decodeURIComponent",

	"ReadonlyArray",
	"ReadonlyMap",
	"ReadonlySet",
	"Partial",
	"Required",
	"Readonly",
	"Pick",
	"Omit",
	"Exclude",
	"Extract",
	"Record",
	"NonNullable",
	"ReturnType",
	"InstanceType",
	"Parameters",

	"console",
	"setTimeout",
	"setInterval",
	"clearTimeout",
	"clearInterval",

	"Element",
	"Node",
	"Document",
	"Window",
	"Event",
]);

function getHookName(node: TSESTree.CallExpression): string | undefined {
	const { callee } = node;

	if (callee.type === "Identifier") {
		return callee.name;
	}

	if (callee.type === "MemberExpression" && callee.property.type === "Identifier") {
		return callee.property.name;
	}

	return undefined;
}

function getMemberExpressionDepth(node: TSESTree.Node): number {
	let depth = 0;
	let current: TSESTree.Node = node;

	while (current.type === TSESTree.AST_NODE_TYPES.MemberExpression) {
		depth += 1;
		current = current.object;
	}

	return depth;
}

function getRootIdentifier(node: TSESTree.Node): TSESTree.Identifier | undefined {
	let current: TSESTree.Node = node;
	while (current.type === TSESTree.AST_NODE_TYPES.MemberExpression) current = current.object;
	return current.type === TSESTree.AST_NODE_TYPES.Identifier ? current : undefined;
}

function nodeToDependencyString(node: TSESTree.Node, sourceCode: Rule.RuleContext["sourceCode"]): string {
	return sourceCode.getText(node as unknown as Rule.Node);
}

function isStableArrayIndex(
	stableResult: StableResult | undefined,
	node: Scope.Definition["node"],
	identifierName: string,
): boolean {
	if (!stableResult) return false;
	if (
		!(stableResult instanceof Set) ||
		node.type !== TSESTree.AST_NODE_TYPES.VariableDeclarator ||
		node.id.type !== TSESTree.AST_NODE_TYPES.ArrayPattern
	)
		return false;

	const elements = node.id.elements;
	for (let index = 0; index < elements.length; index += 1) {
		const element = elements[index];
		if (element?.type === TSESTree.AST_NODE_TYPES.Identifier && element.name === identifierName)
			return (stableResult as Set<number>).has(index);
	}

	return false;
}

function isStableHookValue(
	init: TSESTree.Expression | Rule.Node,
	node: Scope.Definition["node"],
	identifierName: string,
	stableHooks: Map<string, StableResult>,
): boolean {
	const castInit = init as TSESTree.Expression;
	if (castInit.type !== TSESTree.AST_NODE_TYPES.CallExpression) return false;

	const hookName = getHookName(castInit);
	if (!hookName) return false;

	const stableResult = stableHooks.get(hookName);
	if (stableResult === true) return true;

	return isStableArrayIndex(stableResult, node, identifierName);
}

/* eslint-disable jsdoc/require-param, jsdoc/require-returns */
function isStableValue(
	variable: VariableLike | undefined,
	identifierName: string,
	stableHooks: Map<string, StableResult>,
): boolean {
	if (!variable) return false;

	const definitions = variable.defs;
	if (definitions.length === 0) return false;

	for (const definition of definitions) {
		const { node, type } = definition;

		if (STABLE_VALUE_TYPES.has(type)) return true;

		if (type === "Variable" && node.type === "VariableDeclarator") {
			const parent = (node as TSESTree.VariableDeclarator).parent;
			if (!parent || parent.type !== TSESTree.AST_NODE_TYPES.VariableDeclaration || parent.kind !== "const")
				continue;

			const { init } = node;

			// @ts-expect-error - Type mismatch between ESLint and TypeScript AST types
			if (init && isStableHookValue(init, node, identifierName, stableHooks)) return true;

			if (init?.type === TSESTree.AST_NODE_TYPES.CallExpression) {
				const { callee } = init;

				if (
					callee.type === TSESTree.AST_NODE_TYPES.MemberExpression &&
					callee.object.type === TSESTree.AST_NODE_TYPES.Identifier &&
					callee.object.name === "React" &&
					callee.property.type === TSESTree.AST_NODE_TYPES.Identifier &&
					callee.property.name === "joinBindings"
				)
					return true;

				if (
					callee.type === TSESTree.AST_NODE_TYPES.MemberExpression &&
					callee.property.type === TSESTree.AST_NODE_TYPES.Identifier &&
					callee.property.name === "map"
				)
					return true;
			}

			if (init) {
				if (
					init.type === TSESTree.AST_NODE_TYPES.Literal ||
					init.type === TSESTree.AST_NODE_TYPES.TemplateLiteral
				)
					return true;
				if (
					init.type === TSESTree.AST_NODE_TYPES.UnaryExpression &&
					init.argument.type === TSESTree.AST_NODE_TYPES.Literal
				)
					return true;
			}

			const variableDefinition = variable.defs.find((definition) => definition.node === node);
			if (variableDefinition && variableDefinition.node.type === TSESTree.AST_NODE_TYPES.VariableDeclarator) {
				const declarationParent = (variableDefinition.node as TSESTree.VariableDeclarator).parent?.parent;
				if (
					declarationParent &&
					(declarationParent.type === TSESTree.AST_NODE_TYPES.Program ||
						declarationParent.type === TSESTree.AST_NODE_TYPES.ExportNamedDeclaration)
				) {
					testingMetrics.moduleLevelStableConst += 1;
					return true;
				}
			}
		}
	}

	return false;
}

/**
 * Finds the topmost member expression in a chain when an identifier is the object.
 *
 * @param node - The identifier node.
 * @returns The topmost member expression or the node itself.
 */
function findTopmostMemberExpression(node: TSESTree.Node): TSESTree.Node {
	let current: TSESTree.Node = node;
	let { parent } = node;

	// Walk up the tree while we're the object of a member expression
	while (parent?.type === TSESTree.AST_NODE_TYPES.MemberExpression && parent.object === current) {
		current = parent;
		parent = parent.parent;
	}

	return current;
}

const IS_CEASE_BOUNDARY = new Set<TSESTree.AST_NODE_TYPES>([
	TSESTree.AST_NODE_TYPES.FunctionDeclaration,
	TSESTree.AST_NODE_TYPES.FunctionExpression,
	TSESTree.AST_NODE_TYPES.ArrowFunctionExpression,
	TSESTree.AST_NODE_TYPES.VariableDeclarator,
]);

/**
 * Checks if an identifier is in a TypeScript type-only position.
 * Type parameters and type annotations are compile-time only and should not be dependencies.
 *
 * @param identifier - The identifier node to check.
 * @returns True if the identifier is in a type-only position.
 */
function isInTypePosition(identifier: TSESTree.Identifier): boolean {
	let parent: TSESTree.Node | undefined = identifier.parent;

	while (parent) {
		// Any TypeScript-specific node indicates a type-only position
		if (parent.type.startsWith("TS")) return true;

		// Stop searching at certain boundaries
		if (IS_CEASE_BOUNDARY.has(parent.type)) return false;

		parent = parent.parent;
	}

	return false;
}

/**
 * Checks if a variable is declared directly in the component/hook body OR is a prop (parameter).
 * Per React rules, only variables "declared directly inside the component body" are reactive.
 * This includes props (function parameters).
 * Variables from outer scopes (module-level, parent functions) are non-reactive.
 *
 * @param variable - The variable to check.
 * @param closureNode - The closure node (useEffect callback, etc.).
 * @returns True if the variable is declared in the component body or is a prop.
 */
function isDeclaredInComponentBody(variable: VariableLike, closureNode: TSESTree.Node): boolean {
	// Find the parent component/hook function
	let parent: TSESTree.Node | undefined = closureNode.parent;

	while (parent) {
		const isFunction = FUNCTION_DECLARATIONS.has(parent.type);

		if (isFunction) {
			// Capture parent in a const so TypeScript understands it's stable in closures
			const functionParent = parent;

			// Check if variable is a parameter of this function (props)
			const isParameter = variable.defs.some((definition) => {
				if (definition.type !== "Parameter") return false;

				// For parameters, the def.node is the function itself
				// Just check if the definition's node is the current function parent
				return definition.node === functionParent;
			});

			if (isParameter) return true; // Props are reactive

			// Check if variable is defined inside this function
			return variable.defs.some((definition) => {
				let node: TSESTree.Node | undefined = definition.node.parent as TSESTree.Node | undefined;
				while (node && node !== functionParent) node = node.parent;
				return node === functionParent;
			});
		}

		parent = parent.parent;
	}

	return false;
}

/**
 * Resolves an identifier to its function definition if it references a function.
 *
 * @param identifier - The identifier node.
 * @param scope - The scope to search in.
 * @returns The function node if found, undefined otherwise.
 */
function resolveFunctionReference(
	identifier: TSESTree.Identifier,
	scope: Scope.Scope,
): TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression | undefined {
	// Look up the variable in the scope chain
	let variable: Scope.Variable | undefined;
	let currentScope: Scope.Scope | null = scope;

	while (currentScope) {
		variable = currentScope.set.get(identifier.name);
		if (variable) break;
		currentScope = currentScope.upper;
	}

	if (!variable || variable.defs.length === 0) return undefined;

	// Check all definitions for a function
	for (const definition of variable.defs) {
		const { node } = definition;

		// Direct function declaration
		if (node.type === TSESTree.AST_NODE_TYPES.FunctionDeclaration)
			return node as unknown as TSESTree.FunctionExpression;

		// Variable declarator with function initializer
		if (
			node.type === TSESTree.AST_NODE_TYPES.VariableDeclarator &&
			node.init &&
			(node.init.type === TSESTree.AST_NODE_TYPES.ArrowFunctionExpression ||
				node.init.type === TSESTree.AST_NODE_TYPES.FunctionExpression)
		)
			return node.init as TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression;
	}

	return undefined;
}

function collectCaptures(
	node: TSESTree.Node,
	scope: Scope.Scope,
	sourceCode: Rule.RuleContext["sourceCode"],
): ReadonlyArray<CaptureInfo> {
	const captures = new Array<CaptureInfo>();
	const captureSet = new Set<string>();

	function visit(current: TSESTree.Node): void {
		if (current.type === TSESTree.AST_NODE_TYPES.Identifier) {
			const { name } = current;

			if (captureSet.has(name) || GLOBAL_BUILTINS.has(name) || isInTypePosition(current)) return;

			let variable: Scope.Variable | undefined;
			let currentScope: Scope.Scope | null = scope;

			while (currentScope) {
				variable = currentScope.set.get(name);
				if (variable) break;
				currentScope = currentScope.upper;
			}

			if (variable) {
				const isDefinedInClosure = variable.defs.some((definition) => {
					let definitionNode: TSESTree.Node | undefined = definition.node;
					while (definitionNode) {
						if (definitionNode === node) return true;
						definitionNode = definitionNode.parent;
					}
					return false;
				});

				if (!isDefinedInClosure) {
					if (!isDeclaredInComponentBody(variable as VariableLike, node)) {
						testingMetrics.outerScopeSkip += 1;
						return;
					}

					captureSet.add(name);
					const depthNode = findTopmostMemberExpression(current);
					const usagePath = sourceCode.getText(depthNode as unknown as Rule.Node);
					captures.push({
						depth: getMemberExpressionDepth(depthNode),
						name,
						node: depthNode,
						usagePath,
						variable: variable as VariableLike,
					});
				}
			}
		}

		if (
			current.type === TSESTree.AST_NODE_TYPES.TSSatisfiesExpression ||
			current.type === TSESTree.AST_NODE_TYPES.TSAsExpression ||
			current.type === TSESTree.AST_NODE_TYPES.TSTypeAssertion ||
			current.type === TSESTree.AST_NODE_TYPES.TSNonNullExpression
		) {
			visit(current.expression);
			return;
		}

		if (current.type === TSESTree.AST_NODE_TYPES.MemberExpression) {
			visit(current.object);
			if (current.computed) visit(current.property);
			return;
		}

		const keys = sourceCode.visitorKeys?.[current.type] ?? [];
		for (const key of keys) {
			const value = (current as unknown as Record<string, unknown>)[key];
			if (Array.isArray(value)) {
				for (const item of value)
					if (item && typeof item === "object" && "type" in item) visit(item as TSESTree.Node);
			} else if (value && typeof value === "object" && "type" in value) visit(value as TSESTree.Node);
		}
	}

	visit(node);
	return captures;
}

function parseDependencies(
	node: TSESTree.ArrayExpression,
	sourceCode: Rule.RuleContext["sourceCode"],
): ReadonlyArray<DependencyInfo> {
	const dependencies = new Array<DependencyInfo>();

	for (const element of node.elements) {
		if (!element || element.type === TSESTree.AST_NODE_TYPES.SpreadElement) continue;

		const name = nodeToDependencyString(element, sourceCode);
		const depth = getMemberExpressionDepth(element);

		dependencies.push({
			depth,
			name,
			node: element,
		});
	}

	return dependencies;
}

function isUnstableValue(node: TSESTree.Node | undefined): boolean {
	return node ? UNSTABLE_VALUES.has(node.type) : false;
}

const isNumberArray = Compile(Type.Array(Type.Number(), { minItems: 1, readOnly: true }));
const isStringArray = Compile(Type.Array(Type.String(), { minItems: 1, readOnly: true }));

function convertStableResult(
	stableResult: boolean | number | ReadonlyArray<number> | ReadonlyArray<string>,
): StableResult {
	if (typeof stableResult === "boolean") return stableResult;
	if (typeof stableResult === "number") return new Set([stableResult]);

	if (isNumberArray.Check(stableResult)) return new Set(stableResult);
	if (isStringArray.Check(stableResult)) return new Set(stableResult);

	return false;
}

const useExhaustiveDependencies: Rule.RuleModule = {
	create(context) {
		const options: Required<UseExhaustiveDependenciesOptions> = {
			hooks: [],
			reportMissingDependenciesArray: true,
			reportUnnecessaryDependencies: true,
			...context.options[0],
		};

		// Build hook configuration map
		const hookConfigs = new Map<string, HookConfig>(DEFAULT_HOOKS);
		for (const customHook of options.hooks) {
			if (customHook.closureIndex === undefined || customHook.dependenciesIndex === undefined) continue;
			hookConfigs.set(customHook.name, {
				closureIndex: customHook.closureIndex,
				dependenciesIndex: customHook.dependenciesIndex,
			});
		}

		// Build stable hooks map
		const stableHooks = new Map<string, StableResult>(STABLE_HOOKS);
		for (const customHook of options.hooks) {
			if (customHook.stableResult === undefined) continue;
			stableHooks.set(customHook.name, convertStableResult(customHook.stableResult));
		}

		// Performance: cache scope lookups
		const scopeCache = new WeakMap<TSESTree.Node, Scope.Scope>();

		/**
		 * Gets the scope for a node with caching.
		 *
		 * @param node - The node to get scope for.
		 * @returns The scope.
		 */
		function getScope(node: TSESTree.Node): Scope.Scope {
			const cached = scopeCache.get(node);
			if (cached) return cached;

			const scope = context.sourceCode.getScope(node as unknown as Rule.Node);
			scopeCache.set(node, scope);
			return scope;
		}

		return {
			CallExpression(node) {
				const callNode = node as unknown as TSESTree.CallExpression;

				// Early exit: get hook name
				const hookName = getHookName(callNode);
				if (hookName === undefined || hookName === "") return;

				// Early exit: check if this hook needs dependency checking
				const hookConfig = hookConfigs.get(hookName);
				if (!hookConfig) return;

				const { closureIndex, dependenciesIndex } = hookConfig;
				const parameters = callNode.arguments;

				// Early exit: check if closure argument exists
				const closureArgument = parameters[closureIndex];
				if (closureArgument === undefined) return;

				// Resolve the actual closure function (handles both inline and reference cases)
				let closureFunction: TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression | undefined;

				if (
					closureArgument.type === TSESTree.AST_NODE_TYPES.ArrowFunctionExpression ||
					closureArgument.type === TSESTree.AST_NODE_TYPES.FunctionExpression
				)
					closureFunction = closureArgument;
				else if (closureArgument.type === TSESTree.AST_NODE_TYPES.Identifier) {
					// Function reference - try to resolve it
					const scope = getScope(callNode);
					closureFunction = resolveFunctionReference(closureArgument, scope);
				}

				// Early exit: check if we have a valid closure function
				if (!closureFunction) return;

				// Get dependencies argument
				const dependenciesArgument = parameters[dependenciesIndex];

				// Report missing dependencies array if configured
				if (!dependenciesArgument && options.reportMissingDependenciesArray) {
					// Collect captures to see if any are needed
					const scope = getScope(closureFunction);
					const captures = collectCaptures(closureFunction, scope, context.sourceCode);

					// Filter out stable values
					const requiredCaptures = captures.filter(
						(capture) => !isStableValue(capture.variable, capture.name, stableHooks),
					);

					if (requiredCaptures.length > 0) {
						const missingNames = Array.from(new Set(requiredCaptures.map(({ name }) => name))).join(", ");

						// Generate fix suggestion - add dependencies array
						const usagePaths = requiredCaptures.map(({ usagePath }) => usagePath);
						const uniqueDeps = Array.from(new Set(usagePaths)).toSorted();
						const depsArrayString = `[${uniqueDeps.join(", ")}]`;

						context.report({
							data: { deps: missingNames },
							messageId: "missingDependenciesArray",
							node: callNode,
							suggest: [
								{
									desc: `Add dependencies array: ${depsArrayString}`,
									fix(fixer): Rule.Fix | null {
										// Insert the dependencies array after the closure argument
										const closureArgumentNode = parameters[closureIndex] as unknown as Rule.Node;
										return fixer.insertTextAfter(closureArgumentNode, `, ${depsArrayString}`);
									},
								},
							],
						});
					}
					return;
				}

				// Early exit: no dependencies array
				if (!dependenciesArgument) return;

				// Dependencies must be an array
				if (dependenciesArgument.type !== TSESTree.AST_NODE_TYPES.ArrayExpression) return;

				const dependenciesArray = dependenciesArgument;

				// Collect captures from closure
				const scope = getScope(closureFunction);
				const captures = collectCaptures(closureFunction, scope, context.sourceCode);

				// Parse dependencies array
				const dependencies = parseDependencies(dependenciesArray, context.sourceCode);

				// Check for unnecessary dependencies first (for consistent error ordering)
				for (const dependency of dependencies) {
					const dependencyRootIdentifier = getRootIdentifier(dependency.node);
					if (!dependencyRootIdentifier) continue;

					const dependencyName = dependencyRootIdentifier.name;

					// Find all captures with the same root identifier
					const matchingCaptures = captures.filter(
						({ node }) => getRootIdentifier(node)?.name === dependencyName,
					);

					// If no captures use this identifier at all, it's unnecessary
					if (matchingCaptures.length === 0) {
						if (options.reportUnnecessaryDependencies) {
							// Generate fix suggestion
							const newDependencies = dependencies
								.filter((value) => value.name !== dependency.name)
								.map(({ name }) => name);
							const dependenciesString = `[${newDependencies.join(", ")}]`;

							context.report({
								data: { name: dependency.name },
								messageId: "unnecessaryDependency",
								node: dependency.node,
								suggest: [
									{
										desc: `Remove '${dependency.name}' from dependencies array`,
										fix(fixer): Rule.Fix | null {
											return fixer.replaceText(
												dependenciesArray as unknown as Rule.Node,
												dependenciesString,
											);
										},
									},
								],
							});
						}
						continue;
					}

					// Check if dependency is more specific than any usage
					// dep.depth > all capture depths means the dep is too specific
					const maxCaptureDepth = Math.max(...matchingCaptures.map(({ depth }) => depth));
					if (dependency.depth > maxCaptureDepth && options.reportUnnecessaryDependencies) {
						// Generate fix suggestion
						const newDependencies = dependencies
							.filter(({ name }) => name !== dependency.name)
							.map(({ name }) => name);
						const newDependenciesString = `[${newDependencies.join(", ")}]`;

						context.report({
							data: { name: dependency.name },
							messageId: "unnecessaryDependency",
							node: dependency.node,
							suggest: [
								{
									desc: `Remove '${dependency.name}' from dependencies array`,
									fix(fixer): Rule.Fix | null {
										return fixer.replaceText(
											dependenciesArray as unknown as Rule.Node,
											newDependenciesString,
										);
									},
								},
							],
						});
					}
				}

				// Check for missing dependencies
				const missingCaptures = new Array<CaptureInfo>();

				for (const capture of captures) {
					// Skip stable values
					if (isStableValue(capture.variable, capture.name, stableHooks)) continue;

					// Check if the capture is in the dependencies
					const rootIdentifier = getRootIdentifier(capture.node);
					if (!rootIdentifier) continue;

					const captureName = rootIdentifier.name;
					let isInDependencies = false;

					// Check if capture is covered by dependencies
					for (const dependency of dependencies) {
						const dependencyRootIdentifier = getRootIdentifier(dependency.node);
						// Check name match and depth: dependency should not be more specific than capture
						if (dependencyRootIdentifier?.name === captureName && dependency.depth <= capture.depth) {
							isInDependencies = true;
							break;
						}
					}

					if (!isInDependencies) missingCaptures.push(capture);
				}

				// Report all missing dependencies at once
				if (missingCaptures.length > 0) {
					const dependencyNames = dependencies.map(({ name }) => name);
					const missingPaths = missingCaptures.map(({ usagePath }) => usagePath);
					const newDependencies = [...dependencyNames, ...missingPaths].toSorted();
					const newDependenciesString = `[${newDependencies.join(", ")}]`;
					const lastDependency = dependencies.at(-1);
					const firstMissing = missingCaptures.at(0);

					// For single missing dependency, use singular message for backward compat
					if (missingCaptures.length === 1 && firstMissing) {
						context.report({
							data: { name: firstMissing.usagePath },
							messageId: "missingDependency",
							node: lastDependency?.node || dependenciesArray,
							suggest: [
								{
									desc: `Add '${firstMissing.usagePath}' to dependencies array`,
									fix(fixer): Rule.Fix | null {
										return fixer.replaceText(
											dependenciesArray as unknown as Rule.Node,
											newDependenciesString,
										);
									},
								},
							],
						});
					} else {
						// For multiple missing dependencies, use plural message
						const missingNames = missingPaths.join(", ");
						context.report({
							data: { names: missingNames },
							messageId: "missingDependencies",
							node: lastDependency?.node || dependenciesArray,
							suggest: [
								{
									desc: "Add missing dependencies to array",
									fix(fixer): Rule.Fix | null {
										return fixer.replaceText(
											dependenciesArray as unknown as Rule.Node,
											newDependenciesString,
										);
									},
								},
							],
						});
					}
				}

				// Check for unstable dependencies in the array
				for (const capture of captures) {
					// Skip stable values
					if (isStableValue(capture.variable, capture.name, stableHooks)) continue;

					// Check if this capture has a corresponding dependency
					const rootIdentifier = getRootIdentifier(capture.node);
					if (!rootIdentifier) continue;

					const captureName = rootIdentifier.name;

					// Find if there's a matching dependency
					for (const dependency of dependencies) {
						const dependencyRootIdentifier = getRootIdentifier(dependency.node);
						const isMatch =
							dependencyRootIdentifier?.name === captureName && dependency.depth === capture.depth;
						const isDirectIdentifier = dependency.depth === 0;

						if (isMatch && isDirectIdentifier) {
							const variableDefinition = capture.variable?.defs[0];
							const initialNode: TSESTree.Node | undefined =
								variableDefinition?.node.type === "VariableDeclarator"
									? ((variableDefinition.node.init ?? undefined) as TSESTree.Expression | undefined)
									: undefined;

							if (isUnstableValue(initialNode)) {
								context.report({
									data: { name: capture.usagePath },
									messageId: "unstableDependency",
									node: dependency.node,
								});
							}
							break;
						}
						if (isMatch) break;
					}
				}
			},
		};
	},
	meta: {
		docs: {
			description:
				"Enforce exhaustive and correct dependency specification in React hooks to prevent stale closures and unnecessary re-renders",
			recommended: true,
			url: "https://biomejs.dev/linter/rules/use-exhaustive-dependencies/",
		},
		fixable: "code",
		hasSuggestions: true,
		messages: {
			missingDependencies: "This hook does not specify all its dependencies. Missing: {{names}}",
			missingDependenciesArray: "This hook does not specify its dependencies array. Missing: {{deps}}",
			missingDependency: "This hook does not specify its dependency on {{name}}.",
			unnecessaryDependency: "This dependency {{name}} can be removed from the list.",
			unstableDependency:
				"{{name}} changes on every re-render. Wrap the definition in useCallback() or useMemo() to stabilize it.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					hooks: {
						description: "Array of custom hook entries to check for exhaustive dependencies",
						items: {
							additionalProperties: false,
							properties: {
								closureIndex: {
									description: "Index of the closure argument for dependency validation",
									type: "number",
								},
								dependenciesIndex: {
									description: "Index of the dependencies array for validation",
									type: "number",
								},
								name: {
									description: "The name of the hook",
									type: "string",
								},
								stableResult: {
									description:
										"Specify stable results: true (whole result), number (array index), number[] (multiple indices), or string[] (object properties)",
									oneOf: [
										{ type: "boolean" },
										{ type: "number" },
										{ items: { type: "number" }, type: "array" },
										{ items: { type: "string" }, type: "array" },
									],
								},
							},
							required: ["name"],
							type: "object",
						},
						type: "array",
					},
					reportMissingDependenciesArray: {
						default: true,
						description: "Report when the dependencies array is completely missing",
						type: "boolean",
					},
					reportUnnecessaryDependencies: {
						default: true,
						description: "Report when unnecessary dependencies are specified",
						type: "boolean",
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
};

export const __testing = {
	collectCaptures,
	convertStableResult,
	isDeclaredInComponentBody,
	isInTypePosition,
	isStableArrayIndex,
	isStableValue,
	metrics: testingMetrics,
	resetMetrics: resetTestingMetrics,
};

export default useExhaustiveDependencies;
