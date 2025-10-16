import { TSESTree } from "@typescript-eslint/types";
import type { Rule, Scope } from "eslint";
import * as S from "sury";

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

/**
 * Hook configuration entry.
 */
interface HookEntry {
	readonly name: string;
	readonly closureIndex?: number;
	readonly dependenciesIndex?: number;
	readonly stableResult?: boolean | number | ReadonlyArray<number> | ReadonlyArray<string>;
}

/**
 * Configuration options for the use-exhaustive-dependencies rule.
 */
interface UseExhaustiveDependenciesOptions {
	readonly hooks?: ReadonlyArray<HookEntry>;
	readonly reportMissingDependenciesArray?: boolean;
	readonly reportUnnecessaryDependencies?: boolean;
}

/**
 * Internal hook configuration.
 */
interface HookConfig {
	readonly closureIndex: number;
	readonly dependenciesIndex: number;
}

/**
 * Stable result configuration.
 */
type StableResult = boolean | ReadonlySet<number> | ReadonlySet<string>;

/**
 * Internal metrics used for testing to ensure specific branches execute.
 */
const testingMetrics = {
	moduleLevelStableConst: 0,
	outerScopeSkip: 0,
};

function resetTestingMetrics(): void {
	testingMetrics.moduleLevelStableConst = 0;
	testingMetrics.outerScopeSkip = 0;
}

/**
 * Minimal definition information used for stability analysis.
 */
interface VariableDefinitionLike {
	readonly node: TSESTree.Node | Rule.Node;
	readonly type: string;
}

/**
 * Minimal variable interface compatible with ESLint scope variables.
 */
interface VariableLike {
	readonly defs: ReadonlyArray<VariableDefinitionLike>;
}

/**
 * Dependency information.
 */
interface DependencyInfo {
	readonly name: string;
	readonly node: TSESTree.Node;
	readonly depth: number;
}

/**
 * Capture information from closure analysis.
 */
interface CaptureInfo {
	readonly name: string;
	readonly node: TSESTree.Node;
	readonly usagePath: string;
	readonly variable: VariableLike | undefined;
	readonly depth: number;
}

/**
 * Default hooks to check for exhaustive dependencies.
 */
const DEFAULT_HOOKS = new Map<string, HookConfig>([
	["useEffect", { closureIndex: 0, dependenciesIndex: 1 }],
	["useLayoutEffect", { closureIndex: 0, dependenciesIndex: 1 }],
	["useInsertionEffect", { closureIndex: 0, dependenciesIndex: 1 }],
	["useCallback", { closureIndex: 0, dependenciesIndex: 1 }],
	["useMemo", { closureIndex: 0, dependenciesIndex: 1 }],
	["useImperativeHandle", { closureIndex: 1, dependenciesIndex: 2 }],
	// React Spring hooks (function factory pattern)
	// Note: These hooks support both function and object patterns.
	// Only the function pattern is analyzed for dependencies.
	["useSpring", { closureIndex: 0, dependenciesIndex: 1 }],
	["useSprings", { closureIndex: 1, dependenciesIndex: 2 }],
	["useTrail", { closureIndex: 1, dependenciesIndex: 2 }],
]);

/**
 * Hooks with stable results that don't need to be in dependencies.
 */
const STABLE_HOOKS = new Map<string, StableResult>([
	["useState", new Set([1])], // setter at index 1
	["useReducer", new Set([1])], // dispatch at index 1
	["useTransition", new Set([1])], // startTransition at index 1
	["useRef", true], // entire result is stable
	["useBinding", true], // React Lua: both binding and setter are stable
]);

/**
 * Values that don't need to be in dependencies (imported, constants, etc.).
 */
const STABLE_VALUE_TYPES = new Set(["ImportBinding", "FunctionDeclaration", "ClassDeclaration", "FunctionName"]);

/**
 * Global built-in identifiers that are always stable and should never be dependencies.
 * Includes JavaScript/TypeScript globals, constructors, and type-only names.
 */
const GLOBAL_BUILTINS = new Set([
	// Primitive values
	"undefined",
	"null",
	"Infinity",
	"NaN",

	// Constructors
	"Array",
	"Object",
	"String",
	"Number",
	"Boolean",
	"Symbol",
	"BigInt",
	"Function",

	// Collections
	"Map",
	"Set",
	"WeakMap",
	"WeakSet",

	// Promises and async
	"Promise",

	// Utility
	"Date",
	"RegExp",
	"Error",
	"Math",
	"JSON",

	// Global functions
	"parseInt",
	"parseFloat",
	"isNaN",
	"isFinite",
	"encodeURI",
	"encodeURIComponent",
	"decodeURI",
	"decodeURIComponent",

	// TypeScript utility types (appear in type annotations but shouldn't be dependencies)
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

	// Web/Node globals commonly seen
	"console",
	"setTimeout",
	"setInterval",
	"clearTimeout",
	"clearInterval",

	// Common DOM/Web types
	"Element",
	"Node",
	"Document",
	"Window",
	"Event",
]);

/**
 * Gets the hook name from a call expression.
 *
 * @param node - The call expression node.
 * @returns The hook name or undefined.
 */
function getHookName(node: TSESTree.CallExpression): string | undefined {
	const { callee } = node;

	// Direct call: useEffect(...)
	if (callee.type === "Identifier") {
		return callee.name;
	}

	// Member expression: React.useEffect(...)
	if (callee.type === "MemberExpression" && callee.property.type === "Identifier") {
		return callee.property.name;
	}

	return undefined;
}

/**
 * Gets the member expression depth (number of property accesses).
 *
 * @param node - The node to analyze.
 * @returns The depth count.
 */
function getMemberExpressionDepth(node: TSESTree.Node): number {
	let depth = 0;
	let current: TSESTree.Node = node;

	while (current.type === "MemberExpression") {
		depth += 1;
		current = current.object;
	}

	return depth;
}

/**
 * Gets the root identifier from a member expression.
 *
 * @param node - The node to analyze.
 * @returns The root identifier or undefined.
 */
function getRootIdentifier(node: TSESTree.Node): TSESTree.Identifier | undefined {
	let current: TSESTree.Node = node;

	while (current.type === "MemberExpression") current = current.object;

	return current.type === "Identifier" ? current : undefined;
}

/**
 * Converts a node to a dependency string representation.
 *
 * @param node - The node to convert.
 * @param sourceCode - The source code instance.
 * @returns The dependency string.
 */
function nodeToDependencyString(node: TSESTree.Node, sourceCode: Rule.RuleContext["sourceCode"]): string {
	return sourceCode.getText(node as unknown as Rule.Node);
}

/**
 * Checks if a stable array index is being accessed.
 *
 * @param stableResult - The stable result set.
 * @param node - The variable declarator node.
 * @param identifierName - The identifier name being accessed.
 * @returns True if accessing a stable array index.
 */
function isStableArrayIndex(
	stableResult: StableResult | undefined,
	node: Scope.Definition["node"],
	identifierName: string,
): boolean {
	if (!stableResult) return false;
	if (!(stableResult instanceof Set) || node.type !== "VariableDeclarator" || node.id.type !== "ArrayPattern")
		return false;

	const elements = node.id.elements;
	for (let index = 0; index < elements.length; index += 1) {
		const element = elements[index];
		if (element?.type === "Identifier" && element.name === identifierName)
			return (stableResult as Set<number>).has(index);
	}

	return false;
}

/**
 * Checks if a value is from a stable hook.
 *
 * @param init - The initializer expression.
 * @param node - The variable declarator node.
 * @param identifierName - The identifier name being accessed.
 * @param stableHooks - Map of stable hooks.
 * @returns True if the value is from a stable hook.
 */
function isStableHookValue(
	init: TSESTree.Expression | Rule.Node,
	node: Scope.Definition["node"],
	identifierName: string,
	stableHooks: Map<string, StableResult>,
): boolean {
	const initNode = init as TSESTree.Expression;
	if (initNode.type !== "CallExpression") return false;

	const hookName = getHookName(initNode);
	if (!hookName) return false;

	const stableResult = stableHooks.get(hookName);
	if (stableResult === true) return true;

	return isStableArrayIndex(stableResult, node, identifierName);
}

/**
 * Checks if a value is stable (doesn't need to be in dependencies).
 *
 * @param variable - The variable to check.
 * @param identifierName - The identifier name being accessed.
 * @param stableHooks - Map of stable hooks.
 * @returns True if the value is stable.
 */
/* eslint-disable jsdoc/require-param, jsdoc/require-returns */
function isStableValue(
	variable: VariableLike | undefined,
	identifierName: string,
	stableHooks: Map<string, StableResult>,
): boolean {
	if (!variable) return false;

	const { defs } = variable;
	if (defs.length === 0) return false;

	for (const def of defs) {
		const { node, type } = def;

		// Imports, functions, classes are stable
		if (STABLE_VALUE_TYPES.has(type)) return true;

		// Check for const declarations with constant initializers
		if (type === "Variable" && node.type === "VariableDeclarator") {
			const parent = (node as TSESTree.VariableDeclarator).parent;
			if (!parent || parent.type !== "VariableDeclaration" || parent.kind !== "const") continue;

			const { init } = node;

			// Check if it's from a stable hook first
			// @ts-expect-error - Type mismatch between ESLint and TypeScript AST types
			if (init && isStableHookValue(init, node, identifierName, stableHooks)) return true;

			// Check for React Lua bindings - bindings are always stable
			if (init?.type === "CallExpression") {
				const { callee } = init;

				// React.joinBindings() returns a stable binding
				if (
					callee.type === "MemberExpression" &&
					callee.object.type === "Identifier" &&
					callee.object.name === "React" &&
					callee.property.type === "Identifier" &&
					callee.property.name === "joinBindings"
				)
					return true;

				// .map() on bindings returns a stable binding
				// This covers: binding.map(...), React.joinBindings(...).map(...), etc.
				if (
					callee.type === "MemberExpression" &&
					callee.property.type === "Identifier" &&
					callee.property.name === "map"
				)
					return true;
			}

			// Check for literal values FIRST (stable regardless of scope)
			if (init) {
				if (init.type === "Literal" || init.type === "TemplateLiteral") return true;
				if (init.type === "UnaryExpression" && init.argument.type === "Literal") return true;
			}

			// For non-literal constants, only module-level is stable
			// Component-scoped non-literal constants are recreated on every render
			const varDef = variable.defs.find((d) => d.node === node);
			if (varDef && varDef.node.type === "VariableDeclarator") {
				const declParent = (varDef.node as TSESTree.VariableDeclarator).parent?.parent;
				// Module-level (Program or ExportNamedDeclaration)
				if (declParent && (declParent.type === "Program" || declParent.type === "ExportNamedDeclaration")) {
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
	let parent = node.parent;

	// Walk up the tree while we're the object of a member expression
	while (parent?.type === "MemberExpression" && parent.object === current) {
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
			const isParameter = variable.defs.some((def) => {
				if (def.type !== "Parameter") return false;

				// For parameters, the def.node is the function itself
				// Just check if the definition's node is the current function parent
				return def.node === functionParent;
			});

			if (isParameter) return true; // Props are reactive

			// Check if variable is defined inside this function
			return variable.defs.some((def) => {
				let node: TSESTree.Node | undefined = def.node.parent as TSESTree.Node | undefined;
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
	for (const def of variable.defs) {
		const { node } = def;

		// Direct function declaration
		if (node.type === "FunctionDeclaration") return node as unknown as TSESTree.FunctionExpression;

		// Variable declarator with function initializer
		if (
			node.type === "VariableDeclarator" &&
			node.init &&
			(node.init.type === "ArrowFunctionExpression" || node.init.type === "FunctionExpression")
		)
			return node.init as TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression;
	}

	return undefined;
}

/**
 * Collects all captured identifiers from a closure.
 *
 * @param node - The closure node (function/arrow function).
 * @param scope - The scope of the closure.
 * @param sourceCode - The source code instance.
 * @returns Array of captured identifiers.
 */
function collectCaptures(
	node: TSESTree.Node,
	scope: Scope.Scope,
	sourceCode: Rule.RuleContext["sourceCode"],
): ReadonlyArray<CaptureInfo> {
	const captures = new Array<CaptureInfo>();
	const captureSet = new Set<string>();

	/**
	 * Recursively visits nodes to find identifier references.
	 *
	 * @param current - The current node.
	 */
	function visit(current: TSESTree.Node): void {
		if (current.type === "Identifier") {
			const { name } = current;

			// Skip if already captured
			if (captureSet.has(name)) return;

			// Skip global built-ins (always stable, never need to be in dependencies)
			if (GLOBAL_BUILTINS.has(name)) return;

			// Skip TypeScript type-only positions (type parameters, annotations, etc.)
			if (isInTypePosition(current)) return;

			// Look up the variable in the scope chain
			let variable: Scope.Variable | undefined;
			let currentScope: Scope.Scope | null = scope;

			while (currentScope) {
				variable = currentScope.set.get(name);
				if (variable) break;
				currentScope = currentScope.upper;
			}

			// Only capture if variable is defined outside the closure
			if (variable) {
				const isDefinedInClosure = variable.defs.some((def) => {
					let defNode: TSESTree.Node | undefined = def.node;
					while (defNode) {
						if (defNode === node) return true;
						defNode = defNode.parent;
					}
					return false;
				});

				if (!isDefinedInClosure) {
					// Only capture variables declared in the component body
					// Per React rules, only "variables declared directly inside the component body" are reactive
					// Variables from outer scopes (module-level, parent functions) are non-reactive and stable
					if (!isDeclaredInComponentBody(variable as VariableLike, node)) {
						testingMetrics.outerScopeSkip += 1;
						return; // From outer scope - skip
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

		// Unwrap TypeScript type expressions to visit the actual expression
		if (
			current.type === "TSSatisfiesExpression" ||
			current.type === "TSAsExpression" ||
			current.type === "TSTypeAssertion" ||
			current.type === "TSNonNullExpression"
		) {
			visit(current.expression);
			return;
		}

		// Traverse member expressions
		if (current.type === "MemberExpression") {
			visit(current.object);
			if (current.computed) visit(current.property);
			return;
		}

		// Visit children
		const keys = sourceCode.visitorKeys?.[current.type] || [];
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

/**
 * Parses dependencies from a dependency array expression.
 *
 * @param node - The dependency array node.
 * @param sourceCode - The source code instance.
 * @returns Array of dependency information.
 */
function parseDependencies(
	node: TSESTree.ArrayExpression,
	sourceCode: Rule.RuleContext["sourceCode"],
): ReadonlyArray<DependencyInfo> {
	const dependencies = new Array<DependencyInfo>();

	for (const element of node.elements) {
		if (!element || element.type === "SpreadElement") continue;

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

/**
 * Checks if a dependency or capture is an inline function or object (unstable).
 *
 * @param node - The node to check.
 * @returns True if the node is an unstable value.
 */
function isUnstableValue(node: TSESTree.Node | undefined): boolean {
	return node ? UNSTABLE_VALUES.has(node.type) : false;
}

const isNumberArray = S.array(S.number);
const isStringArray = S.array(S.string);

function validate<T>(validator: S.Schema<T>, value: unknown): value is T {
	return S.safe(() => S.parseOrThrow(value, validator)).success;
}

/**
 * Converts stableResult configuration to internal format.
 *
 * @param stableResult - The stable result configuration.
 * @returns The internal stable result format.
 */
function convertStableResult(
	stableResult: boolean | number | ReadonlyArray<number> | ReadonlyArray<string>,
): StableResult {
	if (typeof stableResult === "boolean") return stableResult;
	if (typeof stableResult === "number") return new Set([stableResult]);

	if (validate(isNumberArray, stableResult) && stableResult.length > 0) return new Set(stableResult);
	if (validate(isStringArray, stableResult) && stableResult.length > 0) return new Set(stableResult);

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
			if (customHook.closureIndex !== undefined && customHook.dependenciesIndex !== undefined) {
				hookConfigs.set(customHook.name, {
					closureIndex: customHook.closureIndex,
					dependenciesIndex: customHook.dependenciesIndex,
				});
			}
		}

		// Build stable hooks map
		const stableHooks = new Map<string, StableResult>(STABLE_HOOKS);
		for (const customHook of options.hooks) {
			if (customHook.stableResult !== undefined) {
				stableHooks.set(customHook.name, convertStableResult(customHook.stableResult));
			}
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
				if (!hookName) return;

				// Early exit: check if this hook needs dependency checking
				const hookConfig = hookConfigs.get(hookName);
				if (!hookConfig) return;

				const { closureIndex, dependenciesIndex } = hookConfig;
				const { arguments: args } = callNode;

				// Early exit: check if closure argument exists
				const closureArg = args[closureIndex];
				if (!closureArg) return;

				// Resolve the actual closure function (handles both inline and reference cases)
				let closureFunction: TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression | undefined;

				if (closureArg.type === "ArrowFunctionExpression" || closureArg.type === "FunctionExpression") {
					closureFunction = closureArg;
				} else if (closureArg.type === "Identifier") {
					// Function reference - try to resolve it
					const scope = getScope(callNode);
					closureFunction = resolveFunctionReference(closureArg, scope);
				}

				// Early exit: check if we have a valid closure function
				if (!closureFunction) return;

				// Get dependencies argument
				const dependenciesArgument = args[dependenciesIndex];

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
										const closureArgNode = args[closureIndex] as unknown as Rule.Node;
										return fixer.insertTextAfter(closureArgNode, `, ${depsArrayString}`);
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
				if (dependenciesArgument.type !== "ArrayExpression") return;

				const depsArray = dependenciesArgument;

				// Collect captures from closure
				const scope = getScope(closureFunction);
				const captures = collectCaptures(closureFunction, scope, context.sourceCode);

				// Parse dependencies array
				const dependencies = parseDependencies(depsArray, context.sourceCode);

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
							const newDeps = dependencies.filter((d) => d.name !== dependency.name).map((d) => d.name);
							const newDepsString = `[${newDeps.join(", ")}]`;

							context.report({
								data: { name: dependency.name },
								messageId: "unnecessaryDependency",
								node: dependency.node,
								suggest: [
									{
										desc: `Remove '${dependency.name}' from dependencies array`,
										fix(fixer): Rule.Fix | null {
											return fixer.replaceText(depsArray as unknown as Rule.Node, newDepsString);
										},
									},
								],
							});
						}
						continue;
					}

					// Check if dependency is more specific than any usage
					// dep.depth > all capture depths means the dep is too specific
					const maxCaptureDepth = Math.max(...matchingCaptures.map((c) => c.depth));
					if (dependency.depth > maxCaptureDepth && options.reportUnnecessaryDependencies) {
						// Generate fix suggestion
						const newDeps = dependencies.filter((d) => d.name !== dependency.name).map((d) => d.name);
						const newDepsString = `[${newDeps.join(", ")}]`;

						context.report({
							data: { name: dependency.name },
							messageId: "unnecessaryDependency",
							node: dependency.node,
							suggest: [
								{
									desc: `Remove '${dependency.name}' from dependencies array`,
									fix(fixer): Rule.Fix | null {
										return fixer.replaceText(depsArray as unknown as Rule.Node, newDepsString);
									},
								},
							],
						});
					}
				}

				// Check for missing dependencies
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

					if (!isInDependencies) {
						// Report on the last dependency in the array for better error positioning
						const lastDependency = dependencies.at(-1);

						// Generate fix suggestion
						const dependencyNames = dependencies.map(({ name }) => name);
						const newDependencies = [...dependencyNames, capture.usagePath].toSorted();
						const newDependenciesString = `[${newDependencies.join(", ")}]`;

						context.report({
							data: { name: capture.usagePath },
							messageId: "missingDependency",
							node: lastDependency?.node || depsArray,
							suggest: [
								{
									desc: `Add '${capture.usagePath}' to dependencies array`,
									fix(fixer): Rule.Fix | null {
										return fixer.replaceText(
											depsArray as unknown as Rule.Node,
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
