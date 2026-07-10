import { getCallExpressionName, getCalleeName, unwrapNode } from "$utilities/ast-utilities";
import { createRule } from "$utilities/create-rule";
import { getDefinedValue } from "$utilities/defined-utilities";
import { TSESTree } from "@typescript-eslint/types";

import type { TSESLint } from "@typescript-eslint/utils";

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

export interface HookEntry {
	readonly closureIndex?: number;
	readonly dependenciesIndex?: number;
	readonly name: string;
	readonly stableResult?: boolean | number | ReadonlyArray<number> | ReadonlyArray<string>;
}

export interface UseExhaustiveDependenciesOptions {
	readonly hooks?: ReadonlyArray<HookEntry>;
	readonly reportMissingDependenciesArray?: boolean;
	readonly reportUnnecessaryDependencies?: boolean;
}

interface HookConfig {
	readonly closureIndex: number;
	readonly dependenciesIndex: number;
}

type StableResult = boolean | ReadonlySet<number> | ReadonlySet<string>;

interface VariableDefinitionLike {
	readonly node: TSESTree.Node;
	readonly type: string;
}

interface VariableLike {
	readonly defs: ReadonlyArray<VariableDefinitionLike>;
}

interface DependencyInfo {
	readonly depth: number;
	readonly name: string;
	readonly node: TSESTree.Node;
}

interface CaptureInfo {
	readonly depth: number;
	readonly forceDependency: boolean;
	readonly name: string;
	readonly node: TSESTree.Node;
	readonly usagePath: string;
	readonly variable: VariableLike;
}

type ClosureFunction = TSESTree.ArrowFunctionExpression | TSESTree.FunctionDeclaration | TSESTree.FunctionExpression;

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

function getMemberExpressionDepth(node: TSESTree.Node): number {
	let depth = 0;
	let current: TSESTree.Node = node;

	if (current.type === TSESTree.AST_NODE_TYPES.ChainExpression) current = current.expression;

	while (current.type === TSESTree.AST_NODE_TYPES.MemberExpression) {
		depth += 1;
		current = current.object;
	}

	return depth;
}

function getRootIdentifier(node: TSESTree.Node): TSESTree.Identifier | undefined {
	let current: TSESTree.Node = node;

	if (current.type === TSESTree.AST_NODE_TYPES.ChainExpression) current = current.expression;

	while (
		current.type === TSESTree.AST_NODE_TYPES.MemberExpression ||
		current.type === TSESTree.AST_NODE_TYPES.TSNonNullExpression
	) {
		current = current.type === TSESTree.AST_NODE_TYPES.MemberExpression ? current.object : current.expression;
	}

	return current.type === TSESTree.AST_NODE_TYPES.Identifier ? current : undefined;
}

function nodeToDependencyString(node: TSESTree.Node, sourceCode: TSESLint.SourceCode): string {
	return sourceCode.getText(node);
}

function nodeToSafeDependencyPath(node: TSESTree.Node, sourceCode: TSESLint.SourceCode): string {
	let dependencyPath = sourceCode.getText(node);

	if (node.type === TSESTree.AST_NODE_TYPES.Identifier) {
		dependencyPath = node.name;
	}

	if (node.type === TSESTree.AST_NODE_TYPES.ChainExpression) {
		dependencyPath = nodeToSafeDependencyPath(node.expression, sourceCode);
	}

	if (node.type === TSESTree.AST_NODE_TYPES.MemberExpression) {
		const objectPath = nodeToSafeDependencyPath(node.object, sourceCode);
		if (node.computed) {
			const propertyText = sourceCode.getText(node.property);
			dependencyPath = `${objectPath}[${propertyText}]`;
		} else {
			const propertyName =
				node.property.type === TSESTree.AST_NODE_TYPES.Identifier
					? node.property.name
					: sourceCode.getText(node.property);
			const separator = node.optional ? "?." : ".";
			dependencyPath = `${objectPath}${separator}${propertyName}`;
		}
	}

	if (
		node.type === TSESTree.AST_NODE_TYPES.TSAsExpression ||
		node.type === TSESTree.AST_NODE_TYPES.TSInstantiationExpression ||
		node.type === TSESTree.AST_NODE_TYPES.TSNonNullExpression ||
		node.type === TSESTree.AST_NODE_TYPES.TSSatisfiesExpression ||
		node.type === TSESTree.AST_NODE_TYPES.TSTypeAssertion
	) {
		dependencyPath = nodeToSafeDependencyPath(node.expression, sourceCode);
	}

	return dependencyPath;
}

function isStableArrayIndex(
	stableResult: StableResult | undefined,
	node: TSESLint.Scope.Definition["node"],
	identifierName: string,
): boolean {
	if (stableResult === undefined || stableResult === false || stableResult === true) return false;
	if (
		!(stableResult instanceof Set) ||
		node.type !== TSESTree.AST_NODE_TYPES.VariableDeclarator ||
		node.id.type !== TSESTree.AST_NODE_TYPES.ArrayPattern
	) {
		return false;
	}

	const { elements } = node.id;
	let index = 0;
	for (const element of elements) {
		const name = element?.type === TSESTree.AST_NODE_TYPES.Identifier ? element.name : undefined;
		if (name === identifierName) {
			return stableResult.has(index);
		}

		index += 1;
	}

	return false;
}

function getObjectPatternPropertyName(property: TSESTree.Property): string | undefined {
	if (property.computed) return undefined;
	if (property.key.type === TSESTree.AST_NODE_TYPES.Literal) return String(property.key.value);
	return property.key.name;
}

function isStableObjectProperty(
	stableResult: StableResult | undefined,
	node: TSESLint.Scope.Definition["node"],
	identifierName: string,
): boolean {
	if (stableResult === undefined || stableResult === false || stableResult === true) return false;
	if (
		!(stableResult instanceof Set) ||
		node.type !== TSESTree.AST_NODE_TYPES.VariableDeclarator ||
		node.id.type !== TSESTree.AST_NODE_TYPES.ObjectPattern
	) {
		return false;
	}

	for (const property of node.id.properties) {
		if (
			property.type !== TSESTree.AST_NODE_TYPES.Property ||
			property.value.type !== TSESTree.AST_NODE_TYPES.Identifier ||
			property.value.name !== identifierName
		) {
			continue;
		}

		const propertyName = getObjectPatternPropertyName(property);
		return propertyName !== undefined && stableResult.has(propertyName);
	}

	return false;
}

function isStableHookValue(
	init: TSESTree.Expression,
	node: TSESLint.Scope.Definition["node"],
	identifierName: string,
	stableHooks: Map<string, StableResult>,
): boolean {
	if (init.type !== TSESTree.AST_NODE_TYPES.CallExpression) return false;

	const hookName = getCallExpressionName(init);
	if (hookName === undefined || hookName === "") return false;

	const stableResult = stableHooks.get(hookName);
	if (stableResult === true) return true;

	return (
		isStableArrayIndex(stableResult, node, identifierName) ||
		isStableObjectProperty(stableResult, node, identifierName)
	);
}

function isReactJoinBindingsCall(callee: TSESTree.CallExpression["callee"]): boolean {
	return (
		callee.type === TSESTree.AST_NODE_TYPES.MemberExpression &&
		callee.object.type === TSESTree.AST_NODE_TYPES.Identifier &&
		callee.object.name === "React" &&
		getCalleeName(callee) === "joinBindings"
	);
}

function isMapCall(callee: TSESTree.CallExpression["callee"]): boolean {
	return callee.type === TSESTree.AST_NODE_TYPES.MemberExpression && getCalleeName(callee) === "map";
}

function isKnownStableCall(init: TSESTree.Expression | null): boolean {
	if (init === null || init.type !== TSESTree.AST_NODE_TYPES.CallExpression) return false;
	return isReactJoinBindingsCall(init.callee) || isMapCall(init.callee);
}

function isStableLiteralExpression(init: TSESTree.Expression | null): boolean {
	if (init === null) return false;
	if (init.type === TSESTree.AST_NODE_TYPES.Literal) return true;
	if (init.type === TSESTree.AST_NODE_TYPES.TemplateLiteral) return true;
	return (
		init.type === TSESTree.AST_NODE_TYPES.UnaryExpression && init.argument.type === TSESTree.AST_NODE_TYPES.Literal
	);
}

function isConstVariableDeclarator(node: TSESTree.VariableDeclarator): boolean {
	const { parent } = node;
	return (
		parent !== undefined && parent.type === TSESTree.AST_NODE_TYPES.VariableDeclaration && parent.kind === "const"
	);
}

function isStableVariableDeclarator(
	node: TSESTree.VariableDeclarator,
	identifierName: string,
	stableHooks: Map<string, StableResult>,
): boolean {
	const { init } = node;
	if (init !== null && isStableHookValue(init, node, identifierName, stableHooks)) return true;
	if (isKnownStableCall(init)) return true;
	if (isStableLiteralExpression(init)) return true;
	return false;
}

function isStableValue(
	variable: VariableLike,
	identifierName: string,
	stableHooks: Map<string, StableResult>,
): boolean {
	const definitions = variable.defs;

	for (const definition of definitions) {
		const { node, type } = definition;

		if (STABLE_VALUE_TYPES.has(type)) return true;

		if (
			type === "Variable" &&
			node.type === TSESTree.AST_NODE_TYPES.VariableDeclarator &&
			isConstVariableDeclarator(node)
		) {
			return isStableVariableDeclarator(node, identifierName, stableHooks);
		}
	}

	return false;
}

function findTopmostMemberExpression(node: TSESTree.Node): TSESTree.Node {
	let current: TSESTree.Node = node;
	let { parent } = node;

	while (parent) {
		// Stop if this member expression is being called as a method
		// E.g., items.map(fn) - we want "items", not "items.map"
		if (parent.type === TSESTree.AST_NODE_TYPES.CallExpression && parent.callee === current) {
			if (current.type === TSESTree.AST_NODE_TYPES.MemberExpression) return current.object;
			break;
		}

		const isMemberParent = parent.type === TSESTree.AST_NODE_TYPES.MemberExpression && parent.object === current;
		const isChainParent = parent.type === TSESTree.AST_NODE_TYPES.ChainExpression;
		const isNonNullParent = parent.type === TSESTree.AST_NODE_TYPES.TSNonNullExpression;

		if (!(isMemberParent || isChainParent || isNonNullParent)) break;

		current = parent;
		({ parent } = parent);
	}

	return current;
}

const IS_CEASE_BOUNDARY = new Set<TSESTree.AST_NODE_TYPES>([
	TSESTree.AST_NODE_TYPES.FunctionDeclaration,
	TSESTree.AST_NODE_TYPES.FunctionExpression,
	TSESTree.AST_NODE_TYPES.ArrowFunctionExpression,
	TSESTree.AST_NODE_TYPES.VariableDeclarator,
]);

const TS_RUNTIME_EXPRESSIONS = new Set<TSESTree.AST_NODE_TYPES>([
	TSESTree.AST_NODE_TYPES.TSNonNullExpression,
	TSESTree.AST_NODE_TYPES.TSAsExpression,
	TSESTree.AST_NODE_TYPES.TSSatisfiesExpression,
	TSESTree.AST_NODE_TYPES.TSTypeAssertion,
	TSESTree.AST_NODE_TYPES.TSInstantiationExpression,
]);

function isComputedPropertyIdentifier(identifier: TSESTree.Identifier): boolean {
	const { parent } = identifier;
	return parent?.type === TSESTree.AST_NODE_TYPES.Property && parent.computed && parent.key === identifier;
}

function isInTypePosition(identifier: TSESTree.Identifier): boolean {
	let { parent }: { parent: TSESTree.Node | undefined } = identifier;

	while (parent !== undefined && !IS_CEASE_BOUNDARY.has(parent.type)) {
		if (TS_RUNTIME_EXPRESSIONS.has(parent.type)) {
			({ parent } = parent);
			continue;
		}
		if (parent.type.startsWith("TS")) return true;
		({ parent } = parent);
	}

	return parent?.type.startsWith("TS") === true;
}

function isDeclaredInComponentBody(variable: VariableLike, closureNode: TSESTree.Node): boolean {
	let { parent } = closureNode;

	while (parent) {
		const isFunction = FUNCTION_DECLARATIONS.has(parent.type);

		if (isFunction) {
			const functionParent = parent;

			const isParameter = variable.defs.some((definition) => {
				if (definition.type !== "Parameter") return false;
				return definition.node === functionParent;
			});

			if (isParameter) return true;

			return variable.defs.some((definition) => {
				let node: TSESTree.Node | undefined = definition.node.parent;
				while (node && node !== functionParent) node = node.parent;
				return node === functionParent;
			});
		}

		({ parent } = parent);
	}

	return false;
}

function resolveFunctionReference(
	identifier: TSESTree.Identifier,
	scope: TSESLint.Scope.Scope,
): ClosureFunction | undefined {
	let variable: TSESLint.Scope.Variable | undefined;
	let currentScope: TSESLint.Scope.Scope | null = scope;

	while (currentScope) {
		variable = currentScope.set.get(identifier.name);
		if (variable) break;
		currentScope = currentScope.upper;
	}

	if (!variable || variable.defs.length === 0) return undefined;

	for (const definition of variable.defs) {
		const { node } = definition;

		if (node.type === TSESTree.AST_NODE_TYPES.FunctionDeclaration) {
			return node;
		}

		if (
			node.type === TSESTree.AST_NODE_TYPES.VariableDeclarator &&
			node.init !== null &&
			(node.init.type === TSESTree.AST_NODE_TYPES.ArrowFunctionExpression ||
				node.init.type === TSESTree.AST_NODE_TYPES.FunctionExpression)
		) {
			return node.init;
		}
	}

	return undefined;
}

function getVisitorKeys(sourceCode: TSESLint.SourceCode, nodeType: string): ReadonlyArray<string> {
	return getDefinedValue(sourceCode.visitorKeys[nodeType], "Expected visitor keys for AST node.");
}

function getPropertyValue(target: object, key: string): unknown {
	return Reflect.get(target, key);
}

function isNode(value: unknown): value is TSESTree.Node {
	return value !== null && typeof value === "object" && "type" in value;
}

function findVariableInScope(name: string, scope: TSESLint.Scope.Scope): TSESLint.Scope.Variable | undefined {
	let currentScope: TSESLint.Scope.Scope | null = scope;

	while (currentScope !== null) {
		const variable = currentScope.set.get(name);
		if (variable !== undefined) return variable;
		currentScope = currentScope.upper;
	}

	return undefined;
}

function isDefinitionInsideNode(definition: VariableDefinitionLike, node: TSESTree.Node): boolean {
	let definitionNode: TSESTree.Node | undefined = definition.node;

	while (definitionNode !== undefined) {
		if (definitionNode === node) return true;
		definitionNode = definitionNode.parent ?? undefined;
	}

	return false;
}

function addCapture(
	captures: Array<CaptureInfo>,
	captureSet: Set<string>,
	current: TSESTree.Identifier,
	node: TSESTree.Node,
	sourceCode: TSESLint.SourceCode,
	variable: VariableLike,
): void {
	const { name } = current;

	if (!isDeclaredInComponentBody(variable, node)) {
		return;
	}

	captureSet.add(name);
	const depthNode = findTopmostMemberExpression(current);
	captures.push({
		depth: getMemberExpressionDepth(depthNode),
		forceDependency: isComputedPropertyIdentifier(current),
		name,
		node: depthNode,
		usagePath: nodeToSafeDependencyPath(depthNode, sourceCode),
		variable,
	});
}

function collectIdentifierCapture(
	captures: Array<CaptureInfo>,
	captureSet: Set<string>,
	current: TSESTree.Identifier,
	node: TSESTree.Node,
	sourceCode: TSESLint.SourceCode,
): void {
	const { name } = current;
	if (captureSet.has(name) || GLOBAL_BUILTINS.has(name) || isInTypePosition(current)) return;

	const variable = findVariableInScope(name, sourceCode.getScope(current));
	if (variable === undefined) return;
	if (variable.defs.some((definition) => isDefinitionInsideNode(definition, node))) return;

	addCapture(captures, captureSet, current, node, sourceCode, variable);
}

function collectCaptures(node: ClosureFunction, sourceCode: TSESLint.SourceCode): ReadonlyArray<CaptureInfo> {
	const captures = new Array<CaptureInfo>();
	const captureSet = new Set<string>();

	function visitChildren(current: TSESTree.Node): void {
		const keys = getVisitorKeys(sourceCode, current.type);

		for (const key of keys) {
			const value = getPropertyValue(current, key);
			if (Array.isArray(value)) {
				for (const item of value) {
					if (isNode(item)) visit(item);
				}
				continue;
			}

			if (isNode(value)) visit(value);
		}
	}

	function visit(current: TSESTree.Node): void {
		if (current.type === TSESTree.AST_NODE_TYPES.Identifier) {
			collectIdentifierCapture(captures, captureSet, current, node, sourceCode);
			return;
		}

		if (current.type === TSESTree.AST_NODE_TYPES.MemberExpression) {
			visit(current.object);
			if (current.computed) visit(current.property);
			return;
		}

		const unwrapped = unwrapNode(current);
		if (unwrapped !== current) {
			visit(unwrapped);
			return;
		}

		if (current.type === TSESTree.AST_NODE_TYPES.Property) {
			if (current.computed) visit(current.key);
			visit(current.value);
			return;
		}

		visitChildren(current);
	}

	visit(node);
	return captures;
}

function parseDependencies(
	node: TSESTree.ArrayExpression,
	sourceCode: TSESLint.SourceCode,
): ReadonlyArray<DependencyInfo> {
	const dependencies = new Array<DependencyInfo>();

	for (const element of node.elements) {
		if (!element) continue;

		const actualNode = element.type === TSESTree.AST_NODE_TYPES.SpreadElement ? element.argument : element;

		const name = nodeToDependencyString(actualNode, sourceCode);
		const depth = getMemberExpressionDepth(actualNode);

		dependencies.push({
			depth,
			name,
			node: actualNode,
		});
	}

	return dependencies;
}

function returnName({ name }: { readonly name: string }): string {
	return name;
}

function isUnstableValue(node: TSESTree.Node | undefined): boolean {
	return node !== undefined && UNSTABLE_VALUES.has(node.type);
}

function isSelfReferenceCapture(capture: CaptureInfo, callNode: TSESTree.CallExpression): boolean {
	const { parent } = callNode;
	if (parent === undefined || parent.type !== TSESTree.AST_NODE_TYPES.VariableDeclarator) return false;
	return capture.variable.defs.some((definition) => definition.node === parent);
}

function isNumberStableResult(
	stableResult: ReadonlyArray<number> | ReadonlyArray<string>,
): stableResult is ReadonlyArray<number> {
	return stableResult.every((value) => typeof value === "number");
}

function convertStableResult(
	stableResult: boolean | number | ReadonlyArray<number> | ReadonlyArray<string>,
): StableResult {
	if (typeof stableResult === "boolean") return stableResult;
	if (typeof stableResult === "number") return new Set([stableResult]);
	if (isNumberStableResult(stableResult)) return new Set(stableResult);
	return new Set(stableResult);
}

type MessageIds =
	| "missingDependencies"
	| "missingDependenciesArray"
	| "missingDependency"
	| "unnecessaryDependency"
	| "unstableDependency"
	| "addDependenciesArraySuggestion"
	| "removeDependencySuggestion"
	| "addDependencySuggestion"
	| "addMissingDependenciesSuggestion";

type Options = [UseExhaustiveDependenciesOptions?];
type RuleContext = TSESLint.RuleContext<MessageIds, Options>;

function getClosureFunction(
	closureArgument: TSESTree.CallExpressionArgument,
	callNode: TSESTree.CallExpression,
	getScope: (node: TSESTree.Node) => TSESLint.Scope.Scope,
): ClosureFunction | undefined {
	if (
		closureArgument.type === TSESTree.AST_NODE_TYPES.ArrowFunctionExpression ||
		closureArgument.type === TSESTree.AST_NODE_TYPES.FunctionExpression
	) {
		return closureArgument;
	}

	if (closureArgument.type !== TSESTree.AST_NODE_TYPES.Identifier) return undefined;
	return resolveFunctionReference(closureArgument, getScope(callNode));
}

function getCallCaptures(
	closureFunction: ClosureFunction,
	callNode: TSESTree.CallExpression,
	sourceCode: TSESLint.SourceCode,
): ReadonlyArray<CaptureInfo> {
	return collectCaptures(closureFunction, sourceCode).filter((capture) => !isSelfReferenceCapture(capture, callNode));
}

function getRequiredCaptures(
	captures: ReadonlyArray<CaptureInfo>,
	stableHooks: Map<string, StableResult>,
): ReadonlyArray<CaptureInfo> {
	return captures.filter(
		(capture) => capture.forceDependency || !isStableValue(capture.variable, capture.name, stableHooks),
	);
}

function reportMissingDependenciesArray(
	context: RuleContext,
	callNode: TSESTree.CallExpression,
	closureArgument: TSESTree.CallExpressionArgument,
	requiredCaptures: ReadonlyArray<CaptureInfo>,
): void {
	if (requiredCaptures.length === 0) return;

	const missingNames = [...new Set(requiredCaptures.map(returnName))].join(", ");
	const usagePaths = requiredCaptures.map(({ usagePath }) => usagePath);
	const uniqueDependencies = [...new Set(usagePaths)].toSorted();
	const dependenciesString = `[${uniqueDependencies.join(", ")}]`;

	context.report({
		data: { deps: missingNames },
		messageId: "missingDependenciesArray",
		node: callNode,
		suggest: [
			{
				data: { dependencies: dependenciesString },
				fix(fixer): TSESLint.RuleFix {
					return fixer.insertTextAfter(closureArgument, `, ${dependenciesString}`);
				},
				messageId: "addDependenciesArraySuggestion",
			},
		],
	});
}

function captureMatchesDependency(capture: CaptureInfo, dependency: DependencyInfo): boolean {
	const captureRootIdentifier = getRootIdentifier(capture.node);
	const dependencyRootIdentifier = getRootIdentifier(dependency.node);

	return (
		captureRootIdentifier !== undefined &&
		dependencyRootIdentifier !== undefined &&
		captureRootIdentifier.name === dependencyRootIdentifier.name
	);
}

function reportUnnecessaryDependency(
	context: RuleContext,
	dependenciesArray: TSESTree.ArrayExpression,
	dependencies: ReadonlyArray<DependencyInfo>,
	dependency: DependencyInfo,
): void {
	const newDependencies = dependencies.filter((value) => value.name !== dependency.name).map(returnName);
	const dependenciesString = `[${newDependencies.join(", ")}]`;

	context.report({
		data: { name: dependency.name },
		messageId: "unnecessaryDependency",
		node: dependency.node,
		suggest: [
			{
				data: { name: dependency.name },
				fix(fixer): TSESLint.RuleFix | null {
					return fixer.replaceText(dependenciesArray, dependenciesString);
				},
				messageId: "removeDependencySuggestion",
			},
		],
	});
}

function checkUnnecessaryDependencies(
	context: RuleContext,
	dependenciesArray: TSESTree.ArrayExpression,
	dependencies: ReadonlyArray<DependencyInfo>,
	captures: ReadonlyArray<CaptureInfo>,
	reportUnnecessaryDependencies: boolean,
): void {
	if (!reportUnnecessaryDependencies) return;

	for (const dependency of dependencies) {
		const matchingCaptures = captures.filter((capture) => captureMatchesDependency(capture, dependency));
		if (matchingCaptures.length === 0) {
			reportUnnecessaryDependency(context, dependenciesArray, dependencies, dependency);
			continue;
		}

		const maxCaptureDepth = Math.max(...matchingCaptures.map(({ depth }) => depth));
		if (dependency.depth > maxCaptureDepth) {
			reportUnnecessaryDependency(context, dependenciesArray, dependencies, dependency);
		}
	}
}

function hasDependencyForCapture(capture: CaptureInfo, dependencies: ReadonlyArray<DependencyInfo>): boolean {
	const rootName = getRootIdentifier(capture.node)?.name;

	for (const dependency of dependencies) {
		const dependencyRootIdentifier = getRootIdentifier(dependency.node);
		if (
			rootName !== undefined &&
			dependencyRootIdentifier?.name === rootName &&
			dependency.depth <= capture.depth
		) {
			return true;
		}
	}

	return false;
}

function getMissingCaptures(
	captures: ReadonlyArray<CaptureInfo>,
	dependencies: ReadonlyArray<DependencyInfo>,
	stableHooks: Map<string, StableResult>,
): ReadonlyArray<CaptureInfo> {
	const missingCaptures = new Array<CaptureInfo>();

	for (const capture of captures) {
		if (!capture.forceDependency && isStableValue(capture.variable, capture.name, stableHooks)) continue;
		if (!hasDependencyForCapture(capture, dependencies)) missingCaptures.push(capture);
	}

	return missingCaptures;
}

function reportMissingCaptures(
	context: RuleContext,
	dependenciesArray: TSESTree.ArrayExpression,
	dependencies: ReadonlyArray<DependencyInfo>,
	missingCaptures: ReadonlyArray<CaptureInfo>,
): void {
	if (missingCaptures.length === 0) return;

	const dependencyNames = dependencies.map(({ name }) => name);
	const missingPaths = missingCaptures.map(({ usagePath }) => usagePath);
	const newDependencies = [...dependencyNames, ...missingPaths].toSorted();
	const newDependenciesString = `[${newDependencies.join(", ")}]`;
	const reportNode = dependencies.at(-1)?.node ?? dependenciesArray;
	const firstMissing = missingCaptures.at(0);

	if (missingCaptures.length === 1 && firstMissing !== undefined) {
		context.report({
			data: { name: firstMissing.usagePath },
			messageId: "missingDependency",
			node: reportNode,
			suggest: [
				{
					data: { name: firstMissing.usagePath },
					fix(fixer): TSESLint.RuleFix | null {
						return fixer.replaceText(dependenciesArray, newDependenciesString);
					},
					messageId: "addDependencySuggestion",
				},
			],
		});
		return;
	}

	context.report({
		data: { names: missingPaths.join(", ") },
		messageId: "missingDependencies",
		node: reportNode,
		suggest: [
			{
				fix(fixer): TSESLint.RuleFix | null {
					return fixer.replaceText(dependenciesArray, newDependenciesString);
				},
				messageId: "addMissingDependenciesSuggestion",
			},
		],
	});
}

function dependencyMatchesCaptureDepth(dependency: DependencyInfo, capture: CaptureInfo): boolean {
	const captureRootIdentifier = getRootIdentifier(capture.node);
	const dependencyRootIdentifier = getRootIdentifier(dependency.node);

	return (
		captureRootIdentifier !== undefined &&
		dependencyRootIdentifier?.name === captureRootIdentifier.name &&
		dependency.depth === capture.depth
	);
}

function getCaptureInitialNode(capture: CaptureInfo): TSESTree.Node | undefined {
	const [variableDefinition] = capture.variable.defs;
	return variableDefinition?.node.type === TSESTree.AST_NODE_TYPES.VariableDeclarator
		? (variableDefinition.node.init ?? undefined)
		: undefined;
}

function reportUnstableDependency(context: RuleContext, dependency: DependencyInfo, capture: CaptureInfo): void {
	context.report({
		data: { name: capture.usagePath },
		messageId: "unstableDependency",
		node: dependency.node,
	});
}

function checkUnstableCapture(
	context: RuleContext,
	dependencies: ReadonlyArray<DependencyInfo>,
	capture: CaptureInfo,
): void {
	for (const dependency of dependencies) {
		if (!dependencyMatchesCaptureDepth(dependency, capture)) continue;
		if (dependency.depth !== 0) break;

		if (isUnstableValue(getCaptureInitialNode(capture))) {
			reportUnstableDependency(context, dependency, capture);
		}
		break;
	}
}

function reportUnstableDependencies(
	context: RuleContext,
	dependencies: ReadonlyArray<DependencyInfo>,
	captures: ReadonlyArray<CaptureInfo>,
	stableHooks: Map<string, StableResult>,
): void {
	for (const capture of captures) {
		if (!capture.forceDependency && isStableValue(capture.variable, capture.name, stableHooks)) continue;
		checkUnstableCapture(context, dependencies, capture);
	}
}

function checkHookCall(
	context: RuleContext,
	callNode: TSESTree.CallExpression,
	hookConfig: HookConfig,
	stableHooks: Map<string, StableResult>,
	options: Required<UseExhaustiveDependenciesOptions>,
	getScope: (node: TSESTree.Node) => TSESLint.Scope.Scope,
): void {
	const parameters = callNode.arguments;
	const closureArgument = parameters[hookConfig.closureIndex];
	if (closureArgument === undefined) return;

	const closureFunction = getClosureFunction(closureArgument, callNode, getScope);
	if (closureFunction === undefined) return;

	const dependenciesArgument = parameters[hookConfig.dependenciesIndex];
	if (dependenciesArgument === undefined) {
		if (!options.reportMissingDependenciesArray) return;

		const captures = getCallCaptures(closureFunction, callNode, context.sourceCode);
		const requiredCaptures = getRequiredCaptures(captures, stableHooks);
		reportMissingDependenciesArray(context, callNode, closureArgument, requiredCaptures);
		return;
	}

	if (dependenciesArgument.type !== TSESTree.AST_NODE_TYPES.ArrayExpression) return;

	const captures = getCallCaptures(closureFunction, callNode, context.sourceCode);
	const dependencies = parseDependencies(dependenciesArgument, context.sourceCode);
	checkUnnecessaryDependencies(
		context,
		dependenciesArgument,
		dependencies,
		captures,
		options.reportUnnecessaryDependencies,
	);
	reportMissingCaptures(
		context,
		dependenciesArgument,
		dependencies,
		getMissingCaptures(captures, dependencies, stableHooks),
	);
	reportUnstableDependencies(context, dependencies, captures, stableHooks);
}

const useExhaustiveDependencies = createRule<Options, MessageIds>({
	create(context): TSESLint.RuleListener {
		const options: Required<UseExhaustiveDependenciesOptions> = {
			hooks: [],
			reportMissingDependenciesArray: true,
			reportUnnecessaryDependencies: true,
			...context.options[0],
		};

		const hookConfigs = new Map<string, HookConfig>(DEFAULT_HOOKS);
		for (const customHook of options.hooks) {
			if (customHook.closureIndex === undefined || customHook.dependenciesIndex === undefined) continue;
			hookConfigs.set(customHook.name, {
				closureIndex: customHook.closureIndex,
				dependenciesIndex: customHook.dependenciesIndex,
			});
		}

		const stableHooks = new Map<string, StableResult>(STABLE_HOOKS);
		for (const customHook of options.hooks) {
			if (customHook.stableResult === undefined) continue;
			stableHooks.set(customHook.name, convertStableResult(customHook.stableResult));
		}

		function getScope(node: TSESTree.Node): TSESLint.Scope.Scope {
			return context.sourceCode.getScope(node);
		}

		return {
			CallExpression(node) {
				const callNode = node;

				const hookName = getCallExpressionName(callNode);
				if (hookName === undefined || hookName === "") return;

				const hookConfig = hookConfigs.get(hookName);
				if (hookConfig === undefined) return;

				checkHookCall(context, callNode, hookConfig, stableHooks, options, getScope);
			},
		};
	},
	meta: {
		defaultOptions: [
			{
				hooks: [],
				reportMissingDependenciesArray: true,
				reportUnnecessaryDependencies: true,
			},
		],
		docs: {
			description:
				"Enforce exhaustive and correct dependency specification in React hooks to prevent stale closures and unnecessary re-renders",
		},
		fixable: "code",
		hasSuggestions: true,
		messages: {
			addDependenciesArraySuggestion: "Add dependencies array: {{dependencies}}",
			addDependencySuggestion: "Add '{{name}}' to dependencies array",
			addMissingDependenciesSuggestion: "Add missing dependencies to array",
			missingDependencies: "This hook does not specify all its dependencies. Missing: {{names}}",
			missingDependenciesArray: "This hook does not specify its dependencies array. Missing: {{deps}}",
			missingDependency: "This hook does not specify its dependency on {{name}}.",
			removeDependencySuggestion: "Remove '{{name}}' from dependencies array",
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
	name: "use-exhaustive-dependencies",
});

export default useExhaustiveDependencies;
