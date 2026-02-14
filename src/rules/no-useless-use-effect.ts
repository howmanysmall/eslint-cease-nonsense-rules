import { TSESTree } from "@typescript-eslint/types";
import { getReactSources, isReactImport } from "../constants/react-sources";
import type { EnvironmentMode } from "../types/environment-mode";
import { createRule } from "../utilities/create-rule";

type MessageIds =
	| "adjustState"
	| "derivedState"
	| "duplicateDeps"
	| "effectChain"
	| "emptyEffect"
	| "eventFlag"
	| "eventSpecificLogic"
	| "externalStore"
	| "initializeState"
	| "logOnly"
	| "mixedDerivedState"
	| "notifyParent"
	| "passRefToParent"
	| "resetState";

export interface NoUselessUseEffectOptions {
	/**
	 * The React environment: "roblox-ts" uses the rbxts/react package, "standard" uses react.
	 * @default "roblox-ts"
	 */
	readonly environment?: EnvironmentMode;

	/**
	 * Effect hook names to check.
	 * @default ["useEffect", "useLayoutEffect", "useInsertionEffect"]
	 */
	readonly hooks?: ReadonlyArray<string>;

	/**
	 * Prefixes for property callback names.
	 * @default ["on"]
	 */
	readonly propertyCallbackPrefixes?: ReadonlyArray<string>;

	/**
	 * State hook names that return [value, setter] pairs.
	 * @default ["useState", "useReducer"]
	 */
	readonly stateHooks?: ReadonlyArray<string>;

	/**
	 * Ref hook names that return mutable ref objects.
	 * @default ["useRef"]
	 */
	readonly refHooks?: ReadonlyArray<string>;

	/**
	 * Report effects that conditionally set state based on prop values.
	 * @default true
	 */
	readonly reportAdjustState?: boolean;

	/**
	 * Report effects that only derive state from properties or state.
	 * @default true
	 */
	readonly reportDerivedState?: boolean;

	/**
	 * Report multiple effects with identical dependency arrays.
	 * @default true
	 */
	readonly reportDuplicateDeps?: boolean;

	/**
	 * Report chains of effects that set state triggering other effects.
	 * @default true
	 */
	readonly reportEffectChain?: boolean;

	/**
	 * Report effects with empty callback bodies.
	 * @default true
	 */
	readonly reportEmptyEffect?: boolean;

	/**
	 * Report effects that route event side effects through a state flag.
	 * @default true
	 */
	readonly reportEventFlag?: boolean;

	/**
	 * Report effects that run event-specific logic based on state.
	 * @default true
	 */
	readonly reportEventSpecificLogic?: boolean;

	/**
	 * Report effects that subscribe to external stores and sync to state.
	 * @default true
	 */
	readonly reportExternalStore?: boolean;

	/**
	 * Report effects that initialize state with constant values.
	 * @default true
	 */
	readonly reportInitializeState?: boolean;

	/**
	 * Report effects that only contain console.log calls.
	 * @default true
	 */
	readonly reportLogOnly?: boolean;

	/**
	 * Report effects that contain state setters mixed with non-setter calls.
	 * @default true
	 */
	readonly reportMixedDerivedState?: boolean;

	/**
	 * Report effects that only notify a parent via a property callback.
	 * @default true
	 */
	readonly reportNotifyParent?: boolean;

	/**
	 * Report effects that pass refs to parent callbacks.
	 * @default true
	 */
	readonly reportPassRefToParent?: boolean;

	/**
	 * Report effects that reset state to constant values when props change.
	 * @default true
	 */
	readonly reportResetState?: boolean;
}

type Options = [NoUselessUseEffectOptions?];

interface NormalizedOptions {
	readonly environment: EnvironmentMode;
	readonly hooks: ReadonlySet<string>;
	readonly propertyCallbackPrefixes: ReadonlySet<string>;
	readonly stateHooks: ReadonlySet<string>;
	readonly refHooks: ReadonlySet<string>;
	readonly reportAdjustState: boolean;
	readonly reportDerivedState: boolean;
	readonly reportDuplicateDeps: boolean;
	readonly reportEffectChain: boolean;
	readonly reportEmptyEffect: boolean;
	readonly reportEventFlag: boolean;
	readonly reportEventSpecificLogic: boolean;
	readonly reportExternalStore: boolean;
	readonly reportInitializeState: boolean;
	readonly reportLogOnly: boolean;
	readonly reportMixedDerivedState: boolean;
	readonly reportNotifyParent: boolean;
	readonly reportPassRefToParent: boolean;
	readonly reportResetState: boolean;
}

const DEFAULT_OPTIONS: Required<NoUselessUseEffectOptions> = {
	environment: "roblox-ts",
	hooks: ["useEffect", "useLayoutEffect", "useInsertionEffect"],
	propertyCallbackPrefixes: ["on"],
	refHooks: ["useRef"],
	reportAdjustState: true,
	reportDerivedState: true,
	reportDuplicateDeps: true,
	reportEffectChain: true,
	reportEmptyEffect: true,
	reportEventFlag: true,
	reportEventSpecificLogic: true,
	reportExternalStore: true,
	reportInitializeState: true,
	reportLogOnly: true,
	reportMixedDerivedState: true,
	reportNotifyParent: true,
	reportPassRefToParent: true,
	reportResetState: true,
	stateHooks: ["useState", "useReducer"],
};

type FunctionNode = TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression;

interface FunctionContext {
	readonly functionId: number;
	readonly isCustomHook: boolean;
	propertyObjectName?: string;
	readonly propertyCallbackIdentifiers: Set<string>;
}

interface EffectInfo {
	readonly ownerFunctionId: number;
	readonly node: TSESTree.CallExpression;
	readonly setterCalls: Set<string>;
	readonly depIdentifiers: Set<string>;
	readonly statements: ReadonlyArray<TSESTree.Statement>;
	readonly hasNonSetterSideEffect: boolean;
	readonly hasReturnWithCleanup: boolean;
}

function normalizeOptions(raw: NoUselessUseEffectOptions | undefined): NormalizedOptions {
	return {
		environment: raw?.environment ?? DEFAULT_OPTIONS.environment,
		hooks: new Set(raw?.hooks ?? DEFAULT_OPTIONS.hooks),
		propertyCallbackPrefixes: new Set(raw?.propertyCallbackPrefixes ?? DEFAULT_OPTIONS.propertyCallbackPrefixes),
		refHooks: new Set(raw?.refHooks ?? DEFAULT_OPTIONS.refHooks),
		reportAdjustState: raw?.reportAdjustState ?? DEFAULT_OPTIONS.reportAdjustState,
		reportDerivedState: raw?.reportDerivedState ?? DEFAULT_OPTIONS.reportDerivedState,
		reportDuplicateDeps: raw?.reportDuplicateDeps ?? DEFAULT_OPTIONS.reportDuplicateDeps,
		reportEffectChain: raw?.reportEffectChain ?? DEFAULT_OPTIONS.reportEffectChain,
		reportEmptyEffect: raw?.reportEmptyEffect ?? DEFAULT_OPTIONS.reportEmptyEffect,
		reportEventFlag: raw?.reportEventFlag ?? DEFAULT_OPTIONS.reportEventFlag,
		reportEventSpecificLogic: raw?.reportEventSpecificLogic ?? DEFAULT_OPTIONS.reportEventSpecificLogic,
		reportExternalStore: raw?.reportExternalStore ?? DEFAULT_OPTIONS.reportExternalStore,
		reportInitializeState: raw?.reportInitializeState ?? DEFAULT_OPTIONS.reportInitializeState,
		reportLogOnly: raw?.reportLogOnly ?? DEFAULT_OPTIONS.reportLogOnly,
		reportMixedDerivedState: raw?.reportMixedDerivedState ?? DEFAULT_OPTIONS.reportMixedDerivedState,
		reportNotifyParent: raw?.reportNotifyParent ?? DEFAULT_OPTIONS.reportNotifyParent,
		reportPassRefToParent: raw?.reportPassRefToParent ?? DEFAULT_OPTIONS.reportPassRefToParent,
		reportResetState: raw?.reportResetState ?? DEFAULT_OPTIONS.reportResetState,
		stateHooks: new Set(raw?.stateHooks ?? DEFAULT_OPTIONS.stateHooks),
	};
}

function getImportedName(specifier: TSESTree.ImportSpecifier): string | undefined {
	const { imported } = specifier;
	return imported.type === TSESTree.AST_NODE_TYPES.Identifier
		? imported.name
		: imported.type === TSESTree.AST_NODE_TYPES.Literal && typeof imported.value === "string"
			? imported.value
			: undefined;
}

function isHookCall(
	node: TSESTree.CallExpression,
	hookIdentifiers: ReadonlySet<string>,
	reactNamespaces: ReadonlySet<string>,
	hookNames: ReadonlySet<string>,
): boolean {
	const { callee } = node;
	if (callee.type === TSESTree.AST_NODE_TYPES.Identifier) return hookIdentifiers.has(callee.name);
	if (
		callee.type === TSESTree.AST_NODE_TYPES.MemberExpression &&
		!callee.computed &&
		callee.object.type === TSESTree.AST_NODE_TYPES.Identifier &&
		callee.property.type === TSESTree.AST_NODE_TYPES.Identifier
	) {
		return reactNamespaces.has(callee.object.name) && hookNames.has(callee.property.name);
	}
	return false;
}

function isFunctionLike(node: TSESTree.Node | null | undefined): node is FunctionNode {
	return (
		node?.type === TSESTree.AST_NODE_TYPES.FunctionExpression ||
		node?.type === TSESTree.AST_NODE_TYPES.ArrowFunctionExpression ||
		node?.type === TSESTree.AST_NODE_TYPES.FunctionDeclaration
	);
}

function getFunctionName(node: FunctionNode): string | undefined {
	if (
		(node.type === TSESTree.AST_NODE_TYPES.FunctionDeclaration ||
			node.type === TSESTree.AST_NODE_TYPES.FunctionExpression) &&
		node.id
	) {
		return node.id.name;
	}

	const { parent } = node;
	if (!parent) return undefined;

	if (
		parent.type === TSESTree.AST_NODE_TYPES.VariableDeclarator &&
		parent.id.type === TSESTree.AST_NODE_TYPES.Identifier
	) {
		return parent.id.name;
	}

	if (
		parent.type === TSESTree.AST_NODE_TYPES.Property &&
		!parent.computed &&
		parent.key.type === TSESTree.AST_NODE_TYPES.Identifier
	) {
		return parent.key.name;
	}

	if (
		parent.type === TSESTree.AST_NODE_TYPES.MethodDefinition &&
		parent.key.type === TSESTree.AST_NODE_TYPES.Identifier
	) {
		return parent.key.name;
	}

	return undefined;
}

function isCustomHookName(name: string | undefined): boolean {
	return typeof name === "string" && name.startsWith("use");
}

function isBlockBody(
	node: TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression,
): node is (TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression) & { body: TSESTree.BlockStatement } {
	return node.body.type === TSESTree.AST_NODE_TYPES.BlockStatement;
}

function isReturnWithoutArgument(statement: TSESTree.Statement): boolean {
	if (statement.type === TSESTree.AST_NODE_TYPES.ReturnStatement) return statement.argument === null;
	if (statement.type !== TSESTree.AST_NODE_TYPES.BlockStatement) return false;
	if (statement.body.length !== 1) return false;
	const [inner] = statement.body;
	return inner?.type === TSESTree.AST_NODE_TYPES.ReturnStatement && inner.argument === null;
}

function hasReturnWithArgument(body: TSESTree.BlockStatement): boolean {
	const stack: Array<TSESTree.Node> = [...body.body];

	while (stack.length > 0) {
		const current = stack.pop();
		if (!current) continue;

		switch (current.type) {
			case TSESTree.AST_NODE_TYPES.FunctionDeclaration:
			case TSESTree.AST_NODE_TYPES.FunctionExpression:
			case TSESTree.AST_NODE_TYPES.ArrowFunctionExpression:
				continue;

			case TSESTree.AST_NODE_TYPES.ReturnStatement:
				if (current.argument) return true;
				continue;

			case TSESTree.AST_NODE_TYPES.BlockStatement:
				stack.push(...current.body);
				continue;

			case TSESTree.AST_NODE_TYPES.IfStatement:
				stack.push(current.consequent);
				if (current.alternate) stack.push(current.alternate);
				continue;

			case TSESTree.AST_NODE_TYPES.ForStatement:
			case TSESTree.AST_NODE_TYPES.ForInStatement:
			case TSESTree.AST_NODE_TYPES.ForOfStatement:
			case TSESTree.AST_NODE_TYPES.WhileStatement:
			case TSESTree.AST_NODE_TYPES.DoWhileStatement:
				stack.push(current.body);
				continue;

			case TSESTree.AST_NODE_TYPES.SwitchStatement:
				for (const switchCase of current.cases) stack.push(...switchCase.consequent);
				continue;

			case TSESTree.AST_NODE_TYPES.TryStatement:
				stack.push(current.block);
				if (current.handler?.body) stack.push(current.handler.body);
				if (current.finalizer) stack.push(current.finalizer);
				continue;

			case TSESTree.AST_NODE_TYPES.LabeledStatement:
				stack.push(current.body);
				continue;

			case TSESTree.AST_NODE_TYPES.WithStatement:
				stack.push(current.body);
				continue;

			default:
				continue;
		}
	}

	return false;
}

function stripLeadingGuard(statements: ReadonlyArray<TSESTree.Statement>): ReadonlyArray<TSESTree.Statement> {
	if (statements.length === 0) return statements;
	const [first] = statements;
	if (!first || first.type !== TSESTree.AST_NODE_TYPES.IfStatement) return statements;
	if (first.alternate) return statements;
	if (!isReturnWithoutArgument(first.consequent)) return statements;
	return statements.slice(1);
}

function unwrapChainExpression(expression: TSESTree.Expression): TSESTree.Expression {
	if (expression.type === TSESTree.AST_NODE_TYPES.ChainExpression) return expression.expression;
	return expression;
}

function getCallExpressionFromStatement(statement: TSESTree.Statement): TSESTree.CallExpression | undefined {
	if (statement.type !== TSESTree.AST_NODE_TYPES.ExpressionStatement) return undefined;
	const expression = unwrapChainExpression(statement.expression);
	return expression.type === TSESTree.AST_NODE_TYPES.CallExpression ? expression : undefined;
}

function isStateSetterCall(
	callExpression: TSESTree.CallExpression,
	stateSetterIdentifiers: ReadonlySet<string>,
): boolean {
	return (
		callExpression.callee.type === TSESTree.AST_NODE_TYPES.Identifier &&
		stateSetterIdentifiers.has(callExpression.callee.name)
	);
}

function isFalseLiteral(node: TSESTree.Node): boolean {
	return node.type === TSESTree.AST_NODE_TYPES.Literal && node.value === false;
}

function isConstantLiteral(node: TSESTree.Node): boolean {
	if (node.type === TSESTree.AST_NODE_TYPES.Literal) return node.value === null || node.value === undefined;

	if (
		node.type === TSESTree.AST_NODE_TYPES.UnaryExpression &&
		node.operator === "void" &&
		node.argument.type === TSESTree.AST_NODE_TYPES.Literal &&
		node.argument.value === 0
	) {
		return true;
	}

	return false;
}

function isEmptyArrayExpression(node: TSESTree.Node): boolean {
	return node.type === TSESTree.AST_NODE_TYPES.ArrayExpression && node.elements.length === 0;
}

function isEmptyObjectExpression(node: TSESTree.Node): boolean {
	return node.type === TSESTree.AST_NODE_TYPES.ObjectExpression && node.properties.length === 0;
}

function isResetValue(node: TSESTree.Node): boolean {
	if (isConstantLiteral(node)) return true;
	if (node.type === TSESTree.AST_NODE_TYPES.Literal) {
		const { value } = node;
		return value === "" || value === 0 || value === false;
	}

	if (isEmptyArrayExpression(node)) return true;
	if (isEmptyObjectExpression(node)) return true;
	return false;
}

function getResetFlagNameFromStatement(
	statement: TSESTree.Statement,
	stateSetterToValue: ReadonlyMap<string, string>,
): string | undefined {
	const callExpression = getCallExpressionFromStatement(statement);
	if (!callExpression || callExpression.callee.type !== TSESTree.AST_NODE_TYPES.Identifier) return undefined;

	const flagName = stateSetterToValue.get(callExpression.callee.name);
	if (!flagName || callExpression.arguments.length !== 1) return undefined;

	const [argument] = callExpression.arguments;
	if (!(argument && isFalseLiteral(argument))) return undefined;
	return flagName;
}

function getSideEffectCall(
	statement: TSESTree.Statement,
	stateSetterIdentifiers: ReadonlySet<string>,
): TSESTree.CallExpression | undefined {
	const callExpression = getCallExpressionFromStatement(statement);
	if (!callExpression || isStateSetterCall(callExpression, stateSetterIdentifiers)) return undefined;
	return callExpression;
}

function isNegativeFlagTest(test: TSESTree.Expression, flagName: string): boolean {
	return (
		test.type === TSESTree.AST_NODE_TYPES.UnaryExpression &&
		test.operator === "!" &&
		test.argument.type === TSESTree.AST_NODE_TYPES.Identifier &&
		test.argument.name === flagName
	);
}

function isPositiveFlagTest(test: TSESTree.Expression, flagName: string): boolean {
	return test.type === TSESTree.AST_NODE_TYPES.Identifier && test.name === flagName;
}

function getStatementsFromConsequent(consequent: TSESTree.Statement): ReadonlyArray<TSESTree.Statement> {
	if (consequent.type === TSESTree.AST_NODE_TYPES.BlockStatement) return consequent.body;
	return [consequent];
}

function matchEventFlagPattern(
	statements: ReadonlyArray<TSESTree.Statement>,
	stateSetterToValue: ReadonlyMap<string, string>,
	stateSetterIdentifiers: ReadonlySet<string>,
): string | undefined {
	if (statements.length === 3) {
		const [guard, first, second] = statements;
		if (!guard || guard.type !== TSESTree.AST_NODE_TYPES.IfStatement) return undefined;
		if (guard.alternate) return undefined;
		if (!(first && second)) return undefined;

		const firstFlag = getResetFlagNameFromStatement(first, stateSetterToValue);
		const secondFlag = getResetFlagNameFromStatement(second, stateSetterToValue);

		if (firstFlag && !secondFlag) {
			if (!(isNegativeFlagTest(guard.test, firstFlag) && isReturnWithoutArgument(guard.consequent))) {
				return undefined;
			}

			if (!getSideEffectCall(second, stateSetterIdentifiers)) return undefined;
			return firstFlag;
		}

		if (secondFlag && !firstFlag) {
			if (!(isNegativeFlagTest(guard.test, secondFlag) && isReturnWithoutArgument(guard.consequent))) {
				return undefined;
			}

			if (!getSideEffectCall(first, stateSetterIdentifiers)) return undefined;
			return secondFlag;
		}
	}

	if (statements.length === 1) {
		const [onlyStatement] = statements;
		if (!onlyStatement || onlyStatement.type !== TSESTree.AST_NODE_TYPES.IfStatement) return undefined;
		if (onlyStatement.alternate) return undefined;

		const { test } = onlyStatement;
		const consequentStatements = getStatementsFromConsequent(onlyStatement.consequent);
		if (consequentStatements.length !== 2) return undefined;

		const [first, second] = consequentStatements;
		if (!(first && second)) return undefined;

		const firstFlag = getResetFlagNameFromStatement(first, stateSetterToValue);
		const secondFlag = getResetFlagNameFromStatement(second, stateSetterToValue);

		if (firstFlag && !secondFlag) {
			if (!isPositiveFlagTest(test, firstFlag)) return undefined;
			if (!getSideEffectCall(second, stateSetterIdentifiers)) return undefined;
			return firstFlag;
		}

		if (
			secondFlag &&
			!firstFlag &&
			isPositiveFlagTest(test, secondFlag) &&
			getSideEffectCall(first, stateSetterIdentifiers)
		) {
			return secondFlag;
		}
	}

	return undefined;
}

function expressionContainsIdentifier(node: TSESTree.Expression): boolean {
	const stack: Array<TSESTree.Expression | TSESTree.PrivateIdentifier> = [node];
	const visited = new Set<TSESTree.Node>();

	while (stack.length > 0) {
		const current = stack.pop();
		if (!current || visited.has(current)) continue;
		visited.add(current);

		if (current.type === TSESTree.AST_NODE_TYPES.Identifier) return true;

		if (current.type === TSESTree.AST_NODE_TYPES.MemberExpression) {
			stack.push(current.object);
			if (!current.computed) stack.push(current.property);

			continue;
		}

		if (current.type === TSESTree.AST_NODE_TYPES.CallExpression) {
			stack.push(current.callee);
			for (const arg of current.arguments) {
				if (arg.type !== TSESTree.AST_NODE_TYPES.SpreadElement) stack.push(arg);
			}

			continue;
		}

		if (
			current.type === TSESTree.AST_NODE_TYPES.BinaryExpression ||
			current.type === TSESTree.AST_NODE_TYPES.LogicalExpression
		) {
			stack.push(current.left);
			stack.push(current.right);
			continue;
		}

		if (current.type === TSESTree.AST_NODE_TYPES.UnaryExpression) {
			stack.push(current.argument);
			continue;
		}

		if (current.type === TSESTree.AST_NODE_TYPES.ConditionalExpression) {
			stack.push(current.test);
			stack.push(current.consequent);
			stack.push(current.alternate);
			continue;
		}

		if (current.type === TSESTree.AST_NODE_TYPES.TemplateLiteral) {
			for (const expression of current.expressions) stack.push(expression);
			continue;
		}

		if (current.type === TSESTree.AST_NODE_TYPES.ArrayExpression) {
			for (const element of current.elements) {
				if (element && element.type !== TSESTree.AST_NODE_TYPES.SpreadElement) stack.push(element);
			}
			continue;
		}

		if (current.type === TSESTree.AST_NODE_TYPES.ObjectExpression) {
			for (const property of current.properties) {
				if (property.type === TSESTree.AST_NODE_TYPES.Property) {
					stack.push(property.value as TSESTree.Expression);
				}
			}
			continue;
		}

		if (current.type === TSESTree.AST_NODE_TYPES.ChainExpression) {
			stack.push(current.expression);
			continue;
		}
	}

	return false;
}

function countSetterCalls(
	statements: ReadonlyArray<TSESTree.Statement>,
	stateSetterIdentifiers: ReadonlySet<string>,
): number | undefined {
	let count = 0;

	for (const statement of statements) {
		if (statement.type === TSESTree.AST_NODE_TYPES.IfStatement) {
			if (statement.alternate) return undefined;

			const innerStatements = getStatementsFromConsequent(statement.consequent);
			const innerCount = countSetterCalls(innerStatements, stateSetterIdentifiers);
			if (innerCount === undefined || innerCount === 0) return undefined;

			count += innerCount;
			continue;
		}

		const callExpression = getCallExpressionFromStatement(statement);
		if (!(callExpression && isStateSetterCall(callExpression, stateSetterIdentifiers))) return undefined;

		// Check that at least one argument contains an identifier reference
		// (i.e., the value is derived from something, not just a constant)
		const hasDerivedArgument = callExpression.arguments.some((argument) => {
			if (argument.type === TSESTree.AST_NODE_TYPES.SpreadElement) return false;
			return expressionContainsIdentifier(argument);
		});

		if (!hasDerivedArgument) return undefined;
		count += 1;
	}

	return count > 0 ? count : undefined;
}

function countPropertyCallbackCalls(
	statements: ReadonlyArray<TSESTree.Statement>,
	functionContext: FunctionContext,
	propertyCallbackPrefixes: ReadonlySet<string>,
): number | undefined {
	let count = 0;

	for (const statement of statements) {
		if (statement.type === TSESTree.AST_NODE_TYPES.IfStatement) {
			if (statement.alternate) return undefined;

			const innerStatements = getStatementsFromConsequent(statement.consequent);
			const innerCount = countPropertyCallbackCalls(innerStatements, functionContext, propertyCallbackPrefixes);
			if (innerCount === undefined || innerCount === 0) return undefined;

			count += innerCount;
			continue;
		}

		const callExpression = getCallExpressionFromStatement(statement);
		if (!callExpression) return undefined;
		if (!isPropertyCallbackCall(callExpression, functionContext, propertyCallbackPrefixes)) return undefined;
		count += 1;
	}

	return count > 0 ? count : undefined;
}

function hasPrefix(value: string, prefixes: ReadonlySet<string>): boolean {
	for (const prefix of prefixes) if (value.startsWith(prefix)) return true;
	return false;
}

function getPropertyName(property: TSESTree.Property): string | undefined {
	const { key } = property;
	if (key.type === TSESTree.AST_NODE_TYPES.Identifier) return key.name;
	if (key.type === TSESTree.AST_NODE_TYPES.Literal && typeof key.value === "string") return key.value;
	return undefined;
}

function getPropertyValueIdentifier(property: TSESTree.Property): TSESTree.Identifier | undefined {
	const { value } = property;
	if (value.type === TSESTree.AST_NODE_TYPES.Identifier) return value;
	if (
		value.type === TSESTree.AST_NODE_TYPES.AssignmentPattern &&
		value.left.type === TSESTree.AST_NODE_TYPES.Identifier
	) {
		return value.left;
	}
	return undefined;
}

function unwrapParameter(parameter: TSESTree.Parameter): TSESTree.Parameter {
	if (parameter.type === TSESTree.AST_NODE_TYPES.AssignmentPattern) return parameter.left;
	return parameter;
}

function buildFunctionContext(
	node: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression,
	propertyCallbackPrefixes: ReadonlySet<string>,
	functionId: number,
	isCustomHook: boolean,
): FunctionContext {
	const context: FunctionContext = {
		functionId,
		isCustomHook,
		propertyCallbackIdentifiers: new Set<string>(),
	};
	const [firstParameter] = node.params;
	if (!firstParameter) return context;

	const parameter = unwrapParameter(firstParameter);
	if (parameter.type === TSESTree.AST_NODE_TYPES.Identifier) {
		context.propertyObjectName = parameter.name;
		return context;
	}

	if (parameter.type !== TSESTree.AST_NODE_TYPES.ObjectPattern) return context;

	for (const property of parameter.properties) {
		if (property.type !== TSESTree.AST_NODE_TYPES.Property) continue;

		const propertyName = getPropertyName(property);
		if (!(propertyName && hasPrefix(propertyName, propertyCallbackPrefixes))) continue;

		const valueIdentifier = getPropertyValueIdentifier(property);
		if (valueIdentifier) context.propertyCallbackIdentifiers.add(valueIdentifier.name);
	}

	return context;
}

function isPropertyCallbackCall(
	callExpression: TSESTree.CallExpression,
	functionContext: FunctionContext,
	propertyCallbackPrefixes: ReadonlySet<string>,
): boolean {
	const { callee } = callExpression;
	if (callee.type === TSESTree.AST_NODE_TYPES.Identifier) {
		return functionContext.propertyCallbackIdentifiers.has(callee.name);
	}

	if (
		callee.type === TSESTree.AST_NODE_TYPES.MemberExpression &&
		!callee.computed &&
		callee.object.type === TSESTree.AST_NODE_TYPES.Identifier &&
		callee.property.type === TSESTree.AST_NODE_TYPES.Identifier
	)
		return (
			functionContext.propertyObjectName !== undefined &&
			callee.object.name === functionContext.propertyObjectName &&
			hasPrefix(callee.property.name, propertyCallbackPrefixes)
		);

	return false;
}

function hasDependencyIdentifier(callExpression: TSESTree.CallExpression, name: string): boolean {
	const [, dependencyArgument] = callExpression.arguments;
	if (!dependencyArgument || dependencyArgument.type !== TSESTree.AST_NODE_TYPES.ArrayExpression) return false;

	for (const element of dependencyArgument.elements) {
		if (element?.type === TSESTree.AST_NODE_TYPES.Identifier && element.name === name) return true;
	}

	return false;
}

function getDependencyIdentifiers(callExpression: TSESTree.CallExpression): Set<string> {
	const identifiers = new Set<string>();
	const [, dependencyArgument] = callExpression.arguments;
	if (!dependencyArgument || dependencyArgument.type !== TSESTree.AST_NODE_TYPES.ArrayExpression) return identifiers;

	for (const element of dependencyArgument.elements) {
		if (element?.type === TSESTree.AST_NODE_TYPES.Identifier) {
			identifiers.add(element.name);
		}
	}

	return identifiers;
}

function isEmptyDependencyArray(callExpression: TSESTree.CallExpression): boolean {
	const [, dependencyArgument] = callExpression.arguments;
	if (!dependencyArgument) return true;
	if (dependencyArgument.type !== TSESTree.AST_NODE_TYPES.ArrayExpression) return false;
	return dependencyArgument.elements.length === 0;
}

function collectSetterCalls(
	statements: ReadonlyArray<TSESTree.Statement>,
	stateSetterIdentifiers: ReadonlySet<string>,
): Set<string> {
	const setters = new Set<string>();

	for (const statement of statements) {
		if (statement.type === TSESTree.AST_NODE_TYPES.IfStatement) {
			const innerStatements = getStatementsFromConsequent(statement.consequent);
			for (const setter of collectSetterCalls(innerStatements, stateSetterIdentifiers)) setters.add(setter);
			continue;
		}

		const callExpression = getCallExpressionFromStatement(statement);
		if (
			callExpression &&
			isStateSetterCall(callExpression, stateSetterIdentifiers) &&
			callExpression.callee.type === TSESTree.AST_NODE_TYPES.Identifier
		) {
			setters.add(callExpression.callee.name);
		}
	}

	return setters;
}

function hasNonSetterSideEffect(
	statements: ReadonlyArray<TSESTree.Statement>,
	stateSetterIdentifiers: ReadonlySet<string>,
	propertyCallbackIdentifiers: ReadonlySet<string>,
): boolean {
	for (const statement of statements) {
		if (statement.type === TSESTree.AST_NODE_TYPES.IfStatement) {
			const innerStatements = getStatementsFromConsequent(statement.consequent);
			if (hasNonSetterSideEffect(innerStatements, stateSetterIdentifiers, propertyCallbackIdentifiers)) {
				return true;
			}
			continue;
		}

		const callExpression = getCallExpressionFromStatement(statement);
		if (!callExpression) continue;

		if (isStateSetterCall(callExpression, stateSetterIdentifiers)) continue;
		if (
			callExpression.callee.type === TSESTree.AST_NODE_TYPES.Identifier &&
			propertyCallbackIdentifiers.has(callExpression.callee.name)
		) {
			continue;
		}
		if (
			callExpression.callee.type === TSESTree.AST_NODE_TYPES.MemberExpression &&
			!callExpression.callee.computed &&
			callExpression.callee.object.type === TSESTree.AST_NODE_TYPES.Identifier &&
			callExpression.callee.property.type === TSESTree.AST_NODE_TYPES.Identifier &&
			propertyCallbackIdentifiers.has(callExpression.callee.object.name)
		) {
			continue;
		}

		return true;
	}

	return false;
}

function hasOnlyResetValueSetterCalls(
	statements: ReadonlyArray<TSESTree.Statement>,
	stateSetterIdentifiers: ReadonlySet<string>,
): boolean {
	if (statements.length === 0) return false;

	for (const statement of statements) {
		if (statement.type === TSESTree.AST_NODE_TYPES.IfStatement) {
			if (statement.alternate) return false;
			const innerStatements = getStatementsFromConsequent(statement.consequent);
			if (!hasOnlyResetValueSetterCalls(innerStatements, stateSetterIdentifiers)) return false;
			continue;
		}

		const callExpression = getCallExpressionFromStatement(statement);
		if (!callExpression) return false;
		if (!isStateSetterCall(callExpression, stateSetterIdentifiers)) return false;
		if (callExpression.arguments.length !== 1) return false;
		const [argument] = callExpression.arguments;
		if (!(argument && isResetValue(argument))) return false;
	}

	return true;
}

function hasOnlyConstantSetterCalls(
	statements: ReadonlyArray<TSESTree.Statement>,
	stateSetterIdentifiers: ReadonlySet<string>,
): boolean {
	if (statements.length === 0) return false;

	for (const statement of statements) {
		if (statement.type === TSESTree.AST_NODE_TYPES.IfStatement) {
			if (statement.alternate) return false;
			const innerStatements = getStatementsFromConsequent(statement.consequent);
			if (!hasOnlyConstantSetterCalls(innerStatements, stateSetterIdentifiers)) return false;
			continue;
		}

		const callExpression = getCallExpressionFromStatement(statement);
		if (!callExpression) return false;
		if (!isStateSetterCall(callExpression, stateSetterIdentifiers)) return false;
		if (callExpression.arguments.length !== 1) return false;
		const [argument] = callExpression.arguments;
		if (!argument) return false;

		if (
			argument.type === TSESTree.AST_NODE_TYPES.Literal &&
			typeof argument.value !== "object" &&
			argument.value !== null
		) {
			continue;
		}
		if (isEmptyArrayExpression(argument)) continue;
		if (isEmptyObjectExpression(argument)) continue;

		return false;
	}

	return true;
}

function hasOnlyLogCalls(statements: ReadonlyArray<TSESTree.Statement>): boolean {
	if (statements.length === 0) return false;

	for (const statement of statements) {
		if (statement.type === TSESTree.AST_NODE_TYPES.IfStatement) {
			if (statement.alternate) return false;
			const innerStatements = getStatementsFromConsequent(statement.consequent);
			if (!hasOnlyLogCalls(innerStatements)) return false;
			continue;
		}

		const callExpression = getCallExpressionFromStatement(statement);
		if (!callExpression) return false;

		if (
			callExpression.callee.type === TSESTree.AST_NODE_TYPES.MemberExpression &&
			!callExpression.callee.computed &&
			callExpression.callee.object.type === TSESTree.AST_NODE_TYPES.Identifier &&
			callExpression.callee.object.name === "console" &&
			callExpression.callee.property.type === TSESTree.AST_NODE_TYPES.Identifier
		) {
			continue;
		}

		return false;
	}

	return true;
}

function hasExternalStorePattern(statements: ReadonlyArray<TSESTree.Statement>): boolean {
	const subscribeMethods = new Set(["addEventListener", "subscribe", "on", "addListener"]);
	const hasSubscription = statements.some((statement) => {
		const callExpression = getCallExpressionFromStatement(statement);
		if (!callExpression) return false;

		if (
			callExpression.callee.type === TSESTree.AST_NODE_TYPES.MemberExpression &&
			!callExpression.callee.computed &&
			callExpression.callee.property.type === TSESTree.AST_NODE_TYPES.Identifier
		) {
			return subscribeMethods.has(callExpression.callee.property.name);
		}

		return false;
	});

	return hasSubscription;
}

function hasRefPassedToParent(
	statements: ReadonlyArray<TSESTree.Statement>,
	refIdentifiers: ReadonlySet<string>,
	propertyCallbackIdentifiers: ReadonlySet<string>,
): boolean {
	for (const statement of statements) {
		if (statement.type === TSESTree.AST_NODE_TYPES.IfStatement) {
			const innerStatements = getStatementsFromConsequent(statement.consequent);
			if (hasRefPassedToParent(innerStatements, refIdentifiers, propertyCallbackIdentifiers)) return true;
			continue;
		}

		const callExpression = getCallExpressionFromStatement(statement);
		if (!callExpression) continue;

		if (
			callExpression.callee.type === TSESTree.AST_NODE_TYPES.Identifier &&
			propertyCallbackIdentifiers.has(callExpression.callee.name)
		) {
			for (const argument of callExpression.arguments) {
				if (
					argument.type === TSESTree.AST_NODE_TYPES.MemberExpression &&
					!argument.computed &&
					argument.object.type === TSESTree.AST_NODE_TYPES.Identifier &&
					argument.property.type === TSESTree.AST_NODE_TYPES.Identifier &&
					argument.property.name === "current" &&
					refIdentifiers.has(argument.object.name)
				) {
					return true;
				}
			}
		}
	}

	return false;
}

function hasConditionalSetterBasedOnProp(
	statements: ReadonlyArray<TSESTree.Statement>,
	stateSetterIdentifiers: ReadonlySet<string>,
	stateValueIdentifiers: ReadonlySet<string>,
	depIdentifiers: ReadonlySet<string>,
): boolean {
	for (const statement of statements) {
		if (statement.type === TSESTree.AST_NODE_TYPES.IfStatement) {
			const conditionIdentifiers = collectIdentifiers(statement.test);
			const hasPropInCondition = [...conditionIdentifiers].some(
				(id) => depIdentifiers.has(id) && !stateValueIdentifiers.has(id),
			);

			if (hasPropInCondition) {
				const consequentStatements = getStatementsFromConsequent(statement.consequent);
				const hasSetterInConsequent = consequentStatements.some((stmt) => {
					const call = getCallExpressionFromStatement(stmt);
					return call !== undefined && isStateSetterCall(call, stateSetterIdentifiers);
				});

				if (hasSetterInConsequent) return true;
			}

			if (statement.alternate) {
				const alternateStatements =
					statement.alternate.type === TSESTree.AST_NODE_TYPES.BlockStatement
						? statement.alternate.body
						: [statement.alternate];
				if (
					hasConditionalSetterBasedOnProp(
						alternateStatements,
						stateSetterIdentifiers,
						stateValueIdentifiers,
						depIdentifiers,
					)
				) {
					return true;
				}
			}
		}
	}

	return false;
}

function collectIdentifiers(node: TSESTree.Node): Set<string> {
	const identifiers = new Set<string>();
	const visited = new Set<TSESTree.Node>();
	const stack: Array<TSESTree.Node> = [node];

	while (stack.length > 0) {
		const current = stack.pop();
		if (!current || visited.has(current)) continue;
		visited.add(current);

		if (current.type === TSESTree.AST_NODE_TYPES.Identifier) {
			identifiers.add(current.name);
			continue;
		}

		if (current.type === TSESTree.AST_NODE_TYPES.MemberExpression) {
			stack.push(current.object);
			if (!current.computed) stack.push(current.property);
			continue;
		}

		if (current.type === TSESTree.AST_NODE_TYPES.CallExpression) {
			stack.push(current.callee);
			for (const argument of current.arguments) {
				if (argument.type !== TSESTree.AST_NODE_TYPES.SpreadElement) stack.push(argument);
			}
			continue;
		}

		if (
			current.type === TSESTree.AST_NODE_TYPES.BinaryExpression ||
			current.type === TSESTree.AST_NODE_TYPES.LogicalExpression
		) {
			stack.push(current.left);
			stack.push(current.right);
			continue;
		}

		if (current.type === TSESTree.AST_NODE_TYPES.UnaryExpression) {
			stack.push(current.argument);
			continue;
		}

		if (current.type === TSESTree.AST_NODE_TYPES.ConditionalExpression) {
			stack.push(current.test);
			stack.push(current.consequent);
			stack.push(current.alternate);
			continue;
		}

		if (current.type === TSESTree.AST_NODE_TYPES.ChainExpression) {
			stack.push(current.expression);
			continue;
		}
	}

	return identifiers;
}

const EVENT_SIDE_EFFECT_PREFIXES = new Set([
	"show",
	"hide",
	"display",
	"navigate",
	"redirect",
	"submit",
	"send",
	"post",
	"notify",
	"alert",
	"confirm",
	"prompt",
	"track",
	"log",
	"report",
]);

function hasEventSpecificLogic(
	statements: ReadonlyArray<TSESTree.Statement>,
	stateSetterIdentifiers: ReadonlySet<string>,
	stateValueIdentifiers: ReadonlySet<string>,
): boolean {
	for (const statement of statements) {
		if (statement.type === TSESTree.AST_NODE_TYPES.IfStatement) {
			const conditionIdentifiers = collectIdentifiers(statement.test);
			const stateInCondition = [...conditionIdentifiers].filter((id) => stateValueIdentifiers.has(id));

			if (stateInCondition.length > 0) {
				const consequentStatements = getStatementsFromConsequent(statement.consequent);
				const hasEventSideEffect = consequentStatements.some((stmt) => {
					const call = getCallExpressionFromStatement(stmt);
					if (!call || isStateSetterCall(call, stateSetterIdentifiers)) return false;

					if (call.callee.type === TSESTree.AST_NODE_TYPES.Identifier) {
						const { name } = call.callee;
						for (const prefix of EVENT_SIDE_EFFECT_PREFIXES) {
							if (name.toLowerCase().startsWith(prefix)) return true;
						}
					}

					if (
						call.callee.type === TSESTree.AST_NODE_TYPES.MemberExpression &&
						!call.callee.computed &&
						call.callee.property.type === TSESTree.AST_NODE_TYPES.Identifier
					) {
						const method = call.callee.property.name.toLowerCase();
						for (const prefix of EVENT_SIDE_EFFECT_PREFIXES) if (method.startsWith(prefix)) return true;
					}

					return false;
				});

				if (hasEventSideEffect) return true;
			}

			if (statement.alternate) {
				const alternateStatements =
					statement.alternate.type === TSESTree.AST_NODE_TYPES.BlockStatement
						? statement.alternate.body
						: [statement.alternate];

				if (hasEventSpecificLogic(alternateStatements, stateSetterIdentifiers, stateValueIdentifiers)) {
					return true;
				}
			}
		}
	}

	return false;
}

function depArraysAreIdentical(ids1: ReadonlySet<string>, ids2: ReadonlySet<string>): boolean {
	if (ids1.size !== ids2.size) return false;
	for (const id of ids1) if (!ids2.has(id)) return false;
	return true;
}

function getOwnerStateKey(ownerFunctionId: number, stateValue: string): string {
	return `${ownerFunctionId}:${stateValue}`;
}

function getFunctionBody(node: FunctionNode): TSESTree.BlockStatement | undefined {
	if (node.body.type === TSESTree.AST_NODE_TYPES.BlockStatement) return node.body;
	return undefined;
}

export default createRule<Options, MessageIds>({
	create(context) {
		const options = normalizeOptions(context.options[0]);
		const reactSources = getReactSources(options.environment);
		const PROGRAM_FUNCTION_ID = 0;

		const reactNamespaces = new Set<string>();
		const effectIdentifiers = new Set<string>();
		const stateHookIdentifiers = new Set<string>();
		const stateSetterIdentifiers = new Set<string>();
		const stateValueIdentifiers = new Set<string>();
		const stateSetterToValue = new Map<string, string>();
		const refHookIdentifiers = new Set<string>();
		const refIdentifiers = new Set<string>();
		const functionContextStack = new Array<FunctionContext>();
		let nextFunctionId = 1;

		// Named function resolution
		const namedFunctions = new Map<string, FunctionNode>();

		// Effect tracking for cross-effect analysis
		const componentEffects = new Array<EffectInfo>();

		function isEffectCall(node: TSESTree.CallExpression): boolean {
			return isHookCall(node, effectIdentifiers, reactNamespaces, options.hooks);
		}

		function isStateHookCall(node: TSESTree.CallExpression): boolean {
			return isHookCall(node, stateHookIdentifiers, reactNamespaces, options.stateHooks);
		}

		function isRefHookCall(node: TSESTree.CallExpression): boolean {
			return isHookCall(node, refHookIdentifiers, reactNamespaces, options.refHooks);
		}

		function recordStateSetter(node: TSESTree.VariableDeclarator): void {
			if (!node.init || node.init.type !== TSESTree.AST_NODE_TYPES.CallExpression) return;
			if (!isStateHookCall(node.init)) return;
			if (node.id.type !== TSESTree.AST_NODE_TYPES.ArrayPattern) return;

			const { elements } = node.id;
			if (elements.length < 2) return;
			const [, setterElement] = elements;
			if (!setterElement || setterElement.type !== TSESTree.AST_NODE_TYPES.Identifier) return;
			stateSetterIdentifiers.add(setterElement.name);

			const [stateElement] = elements;
			if (stateElement && stateElement.type === TSESTree.AST_NODE_TYPES.Identifier) {
				stateValueIdentifiers.add(stateElement.name);
				stateSetterToValue.set(setterElement.name, stateElement.name);
			}
		}

		function recordRef(node: TSESTree.VariableDeclarator): void {
			if (!node.init || node.init.type !== TSESTree.AST_NODE_TYPES.CallExpression) return;
			if (!isRefHookCall(node.init)) return;
			if (node.id.type !== TSESTree.AST_NODE_TYPES.Identifier) return;
			refIdentifiers.add(node.id.name);
		}

		function recordNamedFunction(node: TSESTree.VariableDeclarator): void {
			if (node.id.type !== TSESTree.AST_NODE_TYPES.Identifier) return;
			if (!node.init) return;

			if (
				node.init.type === TSESTree.AST_NODE_TYPES.FunctionExpression ||
				node.init.type === TSESTree.AST_NODE_TYPES.ArrowFunctionExpression
			) {
				namedFunctions.set(node.id.name, node.init);
			}
		}

		function enterFunction(node: FunctionNode): void {
			const functionId = nextFunctionId;
			nextFunctionId += 1;
			const functionName = getFunctionName(node);
			functionContextStack.push(
				buildFunctionContext(
					node,
					options.propertyCallbackPrefixes,
					functionId,
					isCustomHookName(functionName),
				),
			);

			if (node.type === TSESTree.AST_NODE_TYPES.FunctionDeclaration && node.id) {
				namedFunctions.set(node.id.name, node);
			}
		}

		function exitFunction(): void {
			functionContextStack.pop();
		}

		const KNOWN_EXTERNAL_PATTERNS = new Set([
			"log",
			"warn",
			"error",
			"info",
			"debug",
			"setTimeout",
			"clearTimeout",
			"setInterval",
			"clearInterval",
			"requestAnimationFrame",
			"cancelAnimationFrame",
			"fetch",
			"navigate",
			"navigateTo",
			"redirect",
			"post",
			"get",
			"put",
			"delete",
			"patch",
			"send",
			"submit",
			"track",
			"analytics",
			"report",
			"notify",
			"showNotification",
			"alert",
			"confirm",
			"prompt",
			"subscribe",
			"unsubscribe",
			"observe",
			"unobserve",
			"addEventListener",
			"removeEventListener",
			"addListener",
			"removeListener",
		]);

		function hasRealExternalSideEffect(
			statements: ReadonlyArray<TSESTree.Statement>,
			setterIds: ReadonlySet<string>,
			callbackIds: ReadonlySet<string>,
		): boolean {
			for (const statement of statements) {
				if (statement.type === TSESTree.AST_NODE_TYPES.IfStatement) {
					const inner = getStatementsFromConsequent(statement.consequent);
					if (hasRealExternalSideEffect(inner, setterIds, callbackIds)) return true;
					continue;
				}

				const call = getCallExpressionFromStatement(statement);
				if (!call) continue;

				if (isStateSetterCall(call, setterIds)) continue;

				if (call.callee.type === TSESTree.AST_NODE_TYPES.Identifier && callbackIds.has(call.callee.name))
					continue;

				if (call.callee.type === TSESTree.AST_NODE_TYPES.Identifier) {
					const { name } = call.callee;
					if (KNOWN_EXTERNAL_PATTERNS.has(name)) return true;
					if (
						name.startsWith("log") ||
						name.startsWith("fetch") ||
						name.startsWith("send") ||
						name.startsWith("track") ||
						name.startsWith("report") ||
						name.startsWith("show") ||
						name.startsWith("navigate") ||
						name.startsWith("submit") ||
						name.startsWith("post") ||
						name.startsWith("notify")
					) {
						return true;
					}
				}

				if (
					call.callee.type === TSESTree.AST_NODE_TYPES.MemberExpression &&
					!call.callee.computed &&
					call.callee.property.type === TSESTree.AST_NODE_TYPES.Identifier
				) {
					if (
						call.callee.object.type === TSESTree.AST_NODE_TYPES.Identifier &&
						callbackIds.has(call.callee.object.name)
					)
						continue;

					const method = call.callee.property.name;
					// Only consider console.log/warn/error as real side effects
					if (
						(method === "log" ||
							method === "warn" ||
							method === "error" ||
							method === "info" ||
							method === "debug") &&
						call.callee.object.type === TSESTree.AST_NODE_TYPES.Identifier &&
						call.callee.object.name === "console"
					)
						return true;
					if (
						method.startsWith("fetch") ||
						method.startsWith("send") ||
						method.startsWith("post") ||
						method.startsWith("track") ||
						method === "setTimeout" ||
						method === "clearTimeout" ||
						method === "setInterval" ||
						method === "clearInterval" ||
						method === "requestAnimationFrame" ||
						method === "cancelAnimationFrame" ||
						method === "subscribe" ||
						method === "unsubscribe" ||
						method === "observe" ||
						method === "unobserve" ||
						method === "addEventListener" ||
						method === "removeEventListener" ||
						method === "addListener" ||
						method === "removeListener" ||
						method === "then" ||
						method === "catch" ||
						method === "finally"
					)
						return true;
				}
			}

			return false;
		}

		function analyzeEffect(
			node: TSESTree.CallExpression,
			statements: ReadonlyArray<TSESTree.Statement>,
			body: TSESTree.BlockStatement | undefined,
		): void {
			const functionContext = functionContextStack.at(-1);
			const coreStatements = stripLeadingGuard(statements);
			const depIdentifiers = getDependencyIdentifiers(node);

			const setterCalls = collectSetterCalls(statements, stateSetterIdentifiers);
			const hasNonSetter = hasNonSetterSideEffect(
				statements,
				stateSetterIdentifiers,
				functionContext?.propertyCallbackIdentifiers ?? new Set(),
			);
			const hasReturnCleanup = body !== undefined && hasReturnWithArgument(body);

			// Track effect for cross-effect analysis
			componentEffects.push({
				depIdentifiers,
				hasNonSetterSideEffect: hasNonSetter,
				hasReturnWithCleanup: hasReturnCleanup,
				node,
				ownerFunctionId: functionContext?.functionId ?? PROGRAM_FUNCTION_ID,
				setterCalls,
				statements,
			});

			// 1. emptyEffect - empty body or only return statement
			if (options.reportEmptyEffect) {
				if (statements.length === 0) {
					context.report({ messageId: "emptyEffect", node });
					return;
				}
				const [firstStatement] = statements;
				if (firstStatement && isReturnWithoutArgument(firstStatement)) {
					context.report({ messageId: "emptyEffect", node });
					return;
				}
			}

			// 2. initializeState - empty deps + constant setter
			if (
				options.reportInitializeState &&
				isEmptyDependencyArray(node) &&
				hasOnlyConstantSetterCalls(statements, stateSetterIdentifiers)
			) {
				context.report({ messageId: "initializeState", node });
				return;
			}

			// 3. resetState - constant/reset value setters + prop deps
			if (options.reportResetState && hasOnlyResetValueSetterCalls(statements, stateSetterIdentifiers)) {
				const hasPropDeps = [...depIdentifiers].some(
					(id) => !(stateValueIdentifiers.has(id) || stateSetterIdentifiers.has(id)),
				);
				if (hasPropDeps) {
					context.report({ messageId: "resetState", node });
					return;
				}
			}

			// 4. eventFlag - existing pattern
			if (options.reportEventFlag) {
				const flagName = matchEventFlagPattern(statements, stateSetterToValue, stateSetterIdentifiers);
				if (flagName && hasDependencyIdentifier(node, flagName)) {
					context.report({ messageId: "eventFlag", node });
					return;
				}
			}

			// 5. eventSpecificLogic - broader pattern
			if (
				options.reportEventSpecificLogic &&
				hasEventSpecificLogic(statements, stateSetterIdentifiers, stateValueIdentifiers)
			) {
				context.report({ messageId: "eventSpecificLogic", node });
				return;
			}

			// 6. adjustState - conditional setter on prop change (check BEFORE derivedState)
			if (
				options.reportAdjustState &&
				hasConditionalSetterBasedOnProp(
					statements,
					stateSetterIdentifiers,
					stateValueIdentifiers,
					depIdentifiers,
				) &&
				!hasNonSetter
			) {
				context.report({ messageId: "adjustState", node });
				return;
			}

			// 7. derivedState - existing pattern
			if (options.reportDerivedState) {
				const setterCount = countSetterCalls(coreStatements, stateSetterIdentifiers);
				if (setterCount !== undefined) {
					context.report({ messageId: "derivedState", node });
					return;
				}
			}

			// 8. mixedDerivedState - setters mixed with non-setter calls
			// Only flag if the non-setter calls don't appear to be real external side effects
			if (options.reportMixedDerivedState && setterCalls.size > 0 && hasNonSetter && !hasReturnCleanup) {
				const hasRealSideEffect = hasRealExternalSideEffect(
					statements,
					stateSetterIdentifiers,
					functionContext?.propertyCallbackIdentifiers ?? new Set(),
				);
				if (!hasRealSideEffect) {
					context.report({ messageId: "mixedDerivedState", node });
					return;
				}
			}

			// 9. passRefToParent - check BEFORE notifyParent (more specific pattern)
			if (
				options.reportPassRefToParent &&
				functionContext &&
				hasRefPassedToParent(statements, refIdentifiers, functionContext.propertyCallbackIdentifiers)
			) {
				context.report({ messageId: "passRefToParent", node });
				return;
			}

			// 10. notifyParent - existing pattern
			if (options.reportNotifyParent && functionContext && !functionContext.isCustomHook) {
				const callbackCount = countPropertyCallbackCalls(
					coreStatements,
					functionContext,
					options.propertyCallbackPrefixes,
				);
				if (callbackCount !== undefined) {
					context.report({ messageId: "notifyParent", node });
					return;
				}
			}

			// 11. externalStore
			if (options.reportExternalStore && hasExternalStorePattern(statements) && hasReturnCleanup) {
				context.report({ messageId: "externalStore", node });
				return;
			}

			// 12. logOnly
			if (options.reportLogOnly && hasOnlyLogCalls(statements)) {
				context.report({ messageId: "logOnly", node });
			}
		}

		function analyzeEffectChains(): void {
			if (!options.reportEffectChain) return;

			// Build mapping: state value -> effects that set it
			const stateSetByEffect = new Map<string, Set<number>>();
			for (let index = 0; index < componentEffects.length; index += 1) {
				const effect = componentEffects[index];
				if (!effect) continue;
				for (const setter of effect.setterCalls) {
					const stateValue = stateSetterToValue.get(setter);
					if (stateValue) {
						const ownerStateKey = getOwnerStateKey(effect.ownerFunctionId, stateValue);
						let setters = stateSetByEffect.get(ownerStateKey);
						if (!setters) {
							setters = new Set();
							stateSetByEffect.set(ownerStateKey, setters);
						}
						setters.add(index);
					}
				}
			}

			// Check if any effect depends on state set only by other effects
			for (const effect of componentEffects) {
				if (!effect) continue;

				// Skip effects with actual side effects (not just state setting)
				if (effect.hasNonSetterSideEffect || effect.hasReturnWithCleanup) continue;

				for (const dep of effect.depIdentifiers) {
					const ownerStateKey = getOwnerStateKey(effect.ownerFunctionId, dep);
					const setterEffectIndices = stateSetByEffect.get(ownerStateKey);
					if (setterEffectIndices && setterEffectIndices.size > 0) {
						// This effect depends on state that is set by other effects
						// Check if all setter effects are pure state-setters
						const allSettersArePure = [...setterEffectIndices].every((idx) => {
							const setterEffect = componentEffects[idx];
							return (
								setterEffect &&
								!setterEffect.hasNonSetterSideEffect &&
								!setterEffect.hasReturnWithCleanup
							);
						});

						if (allSettersArePure) {
							context.report({ messageId: "effectChain", node: effect.node });
							// Only report once per effect
							return;
						}
					}
				}
			}
		}

		function analyzeDuplicateDeps(): void {
			if (!options.reportDuplicateDeps) return;
			if (componentEffects.length < 2) return;

			const reported = new Set<number>();

			for (let index = 0; index < componentEffects.length; index += 1) {
				if (reported.has(index)) continue;
				const effect1 = componentEffects[index];
				if (!effect1 || effect1.depIdentifiers.size === 0) continue;

				const duplicates = [index];

				for (let jndex = index + 1; jndex < componentEffects.length; jndex += 1) {
					if (reported.has(jndex)) continue;
					const effect2 = componentEffects[jndex];
					if (!effect2) continue;
					if (effect2.ownerFunctionId !== effect1.ownerFunctionId) continue;

					if (depArraysAreIdentical(effect1.depIdentifiers, effect2.depIdentifiers)) duplicates.push(jndex);
				}

				if (duplicates.length > 1) {
					for (const idx of duplicates) {
						reported.add(idx);
						const effect = componentEffects[idx];
						if (effect) context.report({ messageId: "duplicateDeps", node: effect.node });
					}
				}
			}
		}

		return {
			ArrowFunctionExpression: enterFunction,
			"ArrowFunctionExpression:exit": exitFunction,
			CallExpression(node): void {
				if (!isEffectCall(node)) return;

				const [callback] = node.arguments;
				if (!callback) return;

				// Handle named function reference
				if (callback.type === TSESTree.AST_NODE_TYPES.Identifier) {
					const namedFunc = namedFunctions.get(callback.name);
					if (namedFunc) {
						const body = getFunctionBody(namedFunc);
						if (body) {
							if (namedFunc.async) return;

							const statements = body.body.filter(
								(statement) => statement.type !== TSESTree.AST_NODE_TYPES.EmptyStatement,
							);

							analyzeEffect(node, statements, body);
						}
					}
					return;
				}

				if (!isFunctionLike(callback)) return;
				if (callback.async) return;
				if (!isBlockBody(callback)) return;

				const statements = callback.body.body.filter(
					(statement) => statement.type !== TSESTree.AST_NODE_TYPES.EmptyStatement,
				);

				analyzeEffect(node, statements, callback.body);
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

					if (specifier.type !== TSESTree.AST_NODE_TYPES.ImportSpecifier) continue;
					const importedName = getImportedName(specifier);
					if (!importedName) continue;

					if (options.hooks.has(importedName)) effectIdentifiers.add(specifier.local.name);
					if (options.stateHooks.has(importedName)) stateHookIdentifiers.add(specifier.local.name);
					if (options.refHooks.has(importedName)) refHookIdentifiers.add(specifier.local.name);
				}
			},
			// Cross-effect analysis on component exit
			"Program:exit"(): void {
				analyzeEffectChains();
				analyzeDuplicateDeps();
			},
			VariableDeclarator(node): void {
				recordStateSetter(node);
				recordRef(node);
				recordNamedFunction(node);
			},
		};
	},
	defaultOptions: [{}],
	meta: {
		docs: {
			description:
				"Disallow effects that only derive state, notify parent callbacks, reset state on prop changes, or route event side effects through state.",
		},
		messages: {
			adjustState:
				"This effect adjusts state when a prop changes. Adjust the state directly during rendering or restructure to avoid this need.",
			derivedState:
				"This effect only derives state from properties or state. Compute the value during rendering instead of useEffect.",
			duplicateDeps:
				"Multiple effects have identical dependency arrays. Combine them into a single effect for better performance.",
			effectChain:
				"This effect is part of a chain of effects that only derive state from other effects. Consolidate the logic into event handlers or compute during rendering.",
			emptyEffect: "This effect has an empty body and should be removed.",
			eventFlag:
				"This effect only reacts to a state flag. Call the side effect directly in the event handler instead of toggling state.",
			eventSpecificLogic:
				"This effect runs event-specific logic based on state. Move this logic to the event handler that triggers the state change.",
			externalStore:
				"This effect subscribes to an external store and syncs to state. Use `useSyncExternalStore` instead.",
			initializeState:
				"This effect initializes state with a constant value. Pass the value as the useState initializer instead.",
			logOnly:
				"This effect only contains console.log calls. Remove it (debug leftover) or move the logging to an event handler.",
			mixedDerivedState:
				"This effect contains state setter calls that derive values from props or state mixed with other operations. Extract the setter calls and compute values during rendering.",
			notifyParent:
				"This effect only notifies a parent via a property callback. Call the callback in the event handler instead of useEffect.",
			passRefToParent:
				"This effect passes a ref to a parent callback. Use `forwardRef` or `useImperativeHandle` instead.",
			resetState:
				"This effect resets state when a prop changes. Pass a `key` prop to the component instead to reset all state automatically.",
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
						default: [...DEFAULT_OPTIONS.hooks],
						items: { type: "string" },
						type: "array",
					},
					propertyCallbackPrefixes: {
						default: [...DEFAULT_OPTIONS.propertyCallbackPrefixes],
						items: { type: "string" },
						type: "array",
					},
					refHooks: {
						default: [...DEFAULT_OPTIONS.refHooks],
						description: "Ref hook names that return mutable ref objects.",
						items: { type: "string" },
						type: "array",
					},
					reportAdjustState: {
						default: true,
						type: "boolean",
					},
					reportDerivedState: {
						default: true,
						type: "boolean",
					},
					reportDuplicateDeps: {
						default: true,
						type: "boolean",
					},
					reportEffectChain: {
						default: true,
						type: "boolean",
					},
					reportEmptyEffect: {
						default: true,
						type: "boolean",
					},
					reportEventFlag: {
						default: true,
						type: "boolean",
					},
					reportEventSpecificLogic: {
						default: true,
						type: "boolean",
					},
					reportExternalStore: {
						default: true,
						type: "boolean",
					},
					reportInitializeState: {
						default: true,
						type: "boolean",
					},
					reportLogOnly: {
						default: true,
						type: "boolean",
					},
					reportMixedDerivedState: {
						default: true,
						type: "boolean",
					},
					reportNotifyParent: {
						default: true,
						type: "boolean",
					},
					reportPassRefToParent: {
						default: true,
						type: "boolean",
					},
					reportResetState: {
						default: true,
						type: "boolean",
					},
					stateHooks: {
						default: [...DEFAULT_OPTIONS.stateHooks],
						description: "State hook names that return [value, setter] pairs.",
						items: { type: "string" },
						type: "array",
					},
				},
				type: "object",
			},
		],
		type: "suggestion",
	},
	name: "no-useless-use-effect",
});
