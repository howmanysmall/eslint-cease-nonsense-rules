import { TSESTree } from "@typescript-eslint/types";
import { getReactSources, isReactImport } from "../constants/react-sources";
import type { EnvironmentMode } from "../types/environment-mode";
import { createRule } from "../utilities/create-rule";

type MessageIds = "derivedState" | "notifyParent" | "eventFlag";

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
	 * Report effects that only derive state from properties or state.
	 * @default true
	 */
	readonly reportDerivedState?: boolean;

	/**
	 * Report effects that only notify a parent via a property callback.
	 * @default true
	 */
	readonly reportNotifyParent?: boolean;

	/**
	 * Report effects that route event side effects through a state flag.
	 * @default true
	 */
	readonly reportEventFlag?: boolean;

	/**
	 * Prefixes for property callback names.
	 * @default ["on"]
	 */
	readonly propertyCallbackPrefixes?: ReadonlyArray<string>;
}

type Options = [NoUselessUseEffectOptions?];

interface NormalizedOptions {
	readonly environment: EnvironmentMode;
	readonly hooks: ReadonlySet<string>;
	readonly reportDerivedState: boolean;
	readonly reportNotifyParent: boolean;
	readonly reportEventFlag: boolean;
	readonly propertyCallbackPrefixes: ReadonlySet<string>;
}

const DEFAULT_OPTIONS: Required<NoUselessUseEffectOptions> = {
	environment: "roblox-ts",
	hooks: ["useEffect", "useLayoutEffect", "useInsertionEffect"],
	propertyCallbackPrefixes: ["on"],
	reportDerivedState: true,
	reportEventFlag: true,
	reportNotifyParent: true,
};

const STATE_HOOKS = new Set(["useState", "useReducer"]);

interface FunctionContext {
	propertyObjectName?: string;
	readonly propertyCallbackIdentifiers: Set<string>;
}

function normalizeOptions(raw: NoUselessUseEffectOptions | undefined): NormalizedOptions {
	return {
		environment: raw?.environment ?? DEFAULT_OPTIONS.environment,
		hooks: new Set(raw?.hooks ?? DEFAULT_OPTIONS.hooks),
		propertyCallbackPrefixes: new Set(raw?.propertyCallbackPrefixes ?? DEFAULT_OPTIONS.propertyCallbackPrefixes),
		reportDerivedState: raw?.reportDerivedState ?? DEFAULT_OPTIONS.reportDerivedState,
		reportEventFlag: raw?.reportEventFlag ?? DEFAULT_OPTIONS.reportEventFlag,
		reportNotifyParent: raw?.reportNotifyParent ?? DEFAULT_OPTIONS.reportNotifyParent,
	};
}

function getImportedName(specifier: TSESTree.ImportSpecifier): string | undefined {
	const { imported } = specifier;
	return imported.type === TSESTree.AST_NODE_TYPES.Identifier
		? imported.name
		: imported.type === TSESTree.AST_NODE_TYPES.Literal && typeof imported.value === "string"
			? imported.value : undefined;
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

function isFunctionLike(
	node: TSESTree.Node | null | undefined,
): node is TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression {
	return (
		node?.type === TSESTree.AST_NODE_TYPES.FunctionExpression ||
		node?.type === TSESTree.AST_NODE_TYPES.ArrowFunctionExpression
	);
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

function isStateSetterCall(callExpression: TSESTree.CallExpression, stateSetterIdentifiers: ReadonlySet<string>): boolean {
	return (
		callExpression.callee.type === TSESTree.AST_NODE_TYPES.Identifier &&
		stateSetterIdentifiers.has(callExpression.callee.name)
	);
}

function isFalseLiteral(node: TSESTree.Node): boolean {
	return node.type === TSESTree.AST_NODE_TYPES.Literal && node.value === false;
}

function getResetFlagNameFromStatement(
	statement: TSESTree.Statement,
	stateSetterToValue: ReadonlyMap<string, string>,
): string | undefined {
	const callExpression = getCallExpressionFromStatement(statement);
	if (!callExpression) return undefined;
	if (callExpression.callee.type !== TSESTree.AST_NODE_TYPES.Identifier) return undefined;
	const flagName = stateSetterToValue.get(callExpression.callee.name);
	if (!flagName) return undefined;
	if (callExpression.arguments.length !== 1) return undefined;
	const [argument] = callExpression.arguments;
	if (!(argument && isFalseLiteral(argument))) return undefined;
	return flagName;
}

function getSideEffectCall(
	statement: TSESTree.Statement,
	stateSetterIdentifiers: ReadonlySet<string>,
): TSESTree.CallExpression | undefined {
	const callExpression = getCallExpressionFromStatement(statement);
	if (!callExpression) return undefined;
	if (isStateSetterCall(callExpression, stateSetterIdentifiers)) return undefined;
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
			if (!(isNegativeFlagTest(guard.test, firstFlag) && isReturnWithoutArgument(guard.consequent))) return undefined;
			if (!getSideEffectCall(second, stateSetterIdentifiers)) return undefined;
			return firstFlag;
		}

		if (secondFlag && !firstFlag) {
			if (!(isNegativeFlagTest(guard.test, secondFlag) && isReturnWithoutArgument(guard.consequent))) return undefined;
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
		) return secondFlag;
	}

	return undefined;
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
	for (const prefix of prefixes) {
		if (value.startsWith(prefix)) return true;
	}
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
): FunctionContext {
	const context: FunctionContext = { propertyCallbackIdentifiers: new Set<string>() };
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

export default createRule<Options, MessageIds>({
	create(context) {
		const options = normalizeOptions(context.options[0]);
		const reactSources = getReactSources(options.environment);

		const reactNamespaces = new Set<string>();
		const effectIdentifiers = new Set<string>();
		const stateHookIdentifiers = new Set<string>();
		const stateSetterIdentifiers = new Set<string>();
		const stateSetterToValue = new Map<string, string>();
		const functionContextStack: Array<FunctionContext> = [];

		function isEffectCall(node: TSESTree.CallExpression): boolean {
			return isHookCall(node, effectIdentifiers, reactNamespaces, options.hooks);
		}

		function isStateHookCall(node: TSESTree.CallExpression): boolean {
			return isHookCall(node, stateHookIdentifiers, reactNamespaces, STATE_HOOKS);
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
				stateSetterToValue.set(setterElement.name, stateElement.name);
			}
		}

		function enterFunction(
			node: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression,
		): void {
			functionContextStack.push(buildFunctionContext(node, options.propertyCallbackPrefixes));
		}

		function exitFunction(): void {
			functionContextStack.pop();
		}

		return {
			ArrowFunctionExpression: enterFunction,
			"ArrowFunctionExpression:exit": exitFunction,
			CallExpression(node): void {
				if (!isEffectCall(node)) return;
				const [callback] = node.arguments;
				if (!isFunctionLike(callback)) return;
				if (callback.async) return;
				if (!isBlockBody(callback)) return;
				if (hasReturnWithArgument(callback.body)) return;

				const statements = callback.body.body.filter(
					(statement) => statement.type !== TSESTree.AST_NODE_TYPES.EmptyStatement,
				);
				if (statements.length === 0) return;

				const functionContext = functionContextStack.at(-1);
				const coreStatements = stripLeadingGuard(statements);

				if (options.reportEventFlag) {
					const flagName = matchEventFlagPattern(statements, stateSetterToValue, stateSetterIdentifiers);
					if (flagName && hasDependencyIdentifier(node, flagName)) {
						context.report({ messageId: "eventFlag", node });
						return;
					}
				}

				if (options.reportDerivedState) {
					const setterCount = countSetterCalls(coreStatements, stateSetterIdentifiers);
					if (setterCount !== undefined) {
						context.report({ messageId: "derivedState", node });
						return;
					}
				}

				if (options.reportNotifyParent && functionContext) {
					const callbackCount = countPropertyCallbackCalls(
						coreStatements,
						functionContext,
						options.propertyCallbackPrefixes,
					);
					if (callbackCount !== undefined) {
						context.report({ messageId: "notifyParent", node });
					}
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

					if (specifier.type !== TSESTree.AST_NODE_TYPES.ImportSpecifier) continue;
					const importedName = getImportedName(specifier);
					if (!importedName) continue;

					if (options.hooks.has(importedName)) effectIdentifiers.add(specifier.local.name);
					if (STATE_HOOKS.has(importedName)) stateHookIdentifiers.add(specifier.local.name);
				}
			},
			VariableDeclarator: recordStateSetter,
		};
	},
	defaultOptions: [{}],
	meta: {
		docs: {
			description:
				"Disallow effects that only derive state, notify parent callbacks, or route event flags through state.",
		},
		messages: {
			derivedState:
				"This effect only derives state from properties or state. Compute the value during rendering instead of useEffect.",
			eventFlag:
				"This effect only reacts to a state flag. Call the side effect directly in the event handler instead of toggling state.",
			notifyParent:
				"This effect only notifies a parent via a property callback. Call the callback in the event handler instead of useEffect.",
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
					reportDerivedState: {
						default: true,
						type: "boolean",
					},
					reportEventFlag: {
						default: true,
						type: "boolean",
					},
					reportNotifyParent: {
						default: true,
						type: "boolean",
					},
				},
				type: "object",
			},
		],
		type: "suggestion",
	},
	name: "no-useless-use-effect",
});
