import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utilities/create-rule";

type MessageIds = "preferFunctions";

export interface NoEventsInEventsCallbackOptions {
	readonly eventsImportPaths?: ReadonlyArray<string>;
}

type Options = [NoEventsInEventsCallbackOptions?];

type TaintKind = "container" | "none" | "value";

interface CallbackState {
	readonly playerContainers: Set<string>;
	readonly playerValues: Set<string>;
}

interface FunctionState {
	readonly callbackState: CallbackState | undefined;
	readonly callbackDepth: number;
}

type CallbackFunction = TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression;

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.length > 0;
}

function normalizeImportPaths(options: NoEventsInEventsCallbackOptions | undefined): ReadonlySet<string> {
	const normalized = new Set<string>();
	if (!options?.eventsImportPaths) return normalized;

	for (const importPath of options.eventsImportPaths) {
		if (isNonEmptyString(importPath)) normalized.add(importPath);
	}

	return normalized;
}

function unwrapNode(node: TSESTree.Node): TSESTree.Node {
	if (node.type === AST_NODE_TYPES.ChainExpression) return unwrapNode(node.expression);
	if (node.type === AST_NODE_TYPES.TSAsExpression) return unwrapNode(node.expression);
	if (node.type === AST_NODE_TYPES.TSInstantiationExpression) return unwrapNode(node.expression);
	if (node.type === AST_NODE_TYPES.TSNonNullExpression) return unwrapNode(node.expression);
	if (node.type === AST_NODE_TYPES.TSTypeAssertion) return unwrapNode(node.expression);
	return node;
}

function getMemberPropertyName(node: TSESTree.MemberExpression): string | undefined {
	if (!node.computed && node.property.type === AST_NODE_TYPES.Identifier) return node.property.name;
	if (node.computed && node.property.type === AST_NODE_TYPES.Literal && typeof node.property.value === "string") {
		return node.property.value;
	}

	return undefined;
}

function getRootIdentifierName(node: TSESTree.Node): string | undefined {
	const unwrapped = unwrapNode(node);

	if (unwrapped.type === AST_NODE_TYPES.Identifier) return unwrapped.name;
	if (unwrapped.type !== AST_NODE_TYPES.MemberExpression) return undefined;

	return getRootIdentifierName(unwrapped.object);
}

function getConnectCallback(
	node: TSESTree.CallExpression,
	eventsIdentifiers: ReadonlySet<string>,
): CallbackFunction | undefined {
	const unwrappedCallee = unwrapNode(node.callee);
	if (unwrappedCallee.type !== AST_NODE_TYPES.MemberExpression) return undefined;
	if (getMemberPropertyName(unwrappedCallee) !== "connect") return undefined;

	const rootIdentifier = getRootIdentifierName(unwrappedCallee.object);
	if (!(rootIdentifier && eventsIdentifiers.has(rootIdentifier))) return undefined;

	const [callbackArgument] = node.arguments;
	if (!callbackArgument) return undefined;
	if (callbackArgument.type === AST_NODE_TYPES.ArrowFunctionExpression) return callbackArgument;
	if (callbackArgument.type === AST_NODE_TYPES.FunctionExpression) return callbackArgument;

	return undefined;
}

function isEventsMethodCall(node: TSESTree.CallExpression, eventsIdentifiers: ReadonlySet<string>): boolean {
	const unwrappedCallee = unwrapNode(node.callee);
	if (unwrappedCallee.type !== AST_NODE_TYPES.MemberExpression) return false;

	const rootIdentifier = getRootIdentifierName(unwrappedCallee);
	if (!rootIdentifier) return false;
	return eventsIdentifiers.has(rootIdentifier);
}

function addIfMissing(set: Set<string>, value: string): boolean {
	if (set.has(value)) return false;
	set.add(value);
	return true;
}

function markAsPlayerValue(name: string, state: CallbackState): boolean {
	return addIfMissing(state.playerValues, name);
}

function markAsPlayerContainer(name: string, state: CallbackState): boolean {
	return addIfMissing(state.playerContainers, name);
}

function markPatternValues(pattern: TSESTree.Node, state: CallbackState): boolean {
	switch (pattern.type) {
		case AST_NODE_TYPES.ArrayPattern: {
			let changed = false;
			for (const element of pattern.elements) {
				if (!element) continue;
				changed = markPatternValues(element, state) || changed;
			}
			return changed;
		}
		case AST_NODE_TYPES.AssignmentPattern:
			return markPatternValues(pattern.left, state);
		case AST_NODE_TYPES.Identifier:
			return markAsPlayerValue(pattern.name, state);
		case AST_NODE_TYPES.ObjectPattern: {
			let changed = false;
			for (const property of pattern.properties) {
				if (property.type === AST_NODE_TYPES.RestElement) {
					changed = markPatternValues(property.argument, state) || changed;
					continue;
				}

				changed = markPatternValues(property.value, state) || changed;
			}

			return changed;
		}
		case AST_NODE_TYPES.RestElement:
			return markPatternValues(pattern.argument, state);
		default:
			return false;
	}
}

function markBindingPattern(
	pattern: TSESTree.BindingName | TSESTree.AssignmentPattern,
	kind: TaintKind,
	state: CallbackState,
): boolean {
	if (kind === "none") return false;

	if (pattern.type === AST_NODE_TYPES.Identifier) {
		if (kind === "value") return markAsPlayerValue(pattern.name, state);
		return markAsPlayerContainer(pattern.name, state);
	}

	if (
		pattern.type === AST_NODE_TYPES.ArrayPattern ||
		pattern.type === AST_NODE_TYPES.AssignmentPattern ||
		pattern.type === AST_NODE_TYPES.ObjectPattern
	) {
		return markPatternValues(pattern, state);
	}

	return false;
}

function markAssignmentTarget(target: TSESTree.Node, kind: TaintKind, state: CallbackState): boolean {
	if (target.type === AST_NODE_TYPES.MemberExpression || kind === "none") return false;

	if (
		target.type === AST_NODE_TYPES.ArrayPattern ||
		target.type === AST_NODE_TYPES.AssignmentPattern ||
		target.type === AST_NODE_TYPES.Identifier ||
		target.type === AST_NODE_TYPES.ObjectPattern ||
		target.type === AST_NODE_TYPES.RestElement
	) {
		if (target.type === AST_NODE_TYPES.Identifier) {
			if (kind === "value") return markAsPlayerValue(target.name, state);
			return markAsPlayerContainer(target.name, state);
		}

		return markPatternValues(target, state);
	}

	return false;
}

function classifyNodeTaint(node: TSESTree.Node, state: CallbackState): TaintKind {
	const unwrapped = unwrapNode(node);

	switch (unwrapped.type) {
		case AST_NODE_TYPES.ArrayExpression:
			for (const element of unwrapped.elements) {
				if (!element) continue;

				if (element.type === AST_NODE_TYPES.SpreadElement) {
					if (classifyNodeTaint(element.argument, state) !== "none") return "container";
					continue;
				}

				if (classifyNodeTaint(element, state) !== "none") return "container";
			}

			return "none";
		case AST_NODE_TYPES.AssignmentExpression:
			return classifyNodeTaint(unwrapped.right, state);
		case AST_NODE_TYPES.ConditionalExpression: {
			const consequent = classifyNodeTaint(unwrapped.consequent, state);
			const alternate = classifyNodeTaint(unwrapped.alternate, state);
			if (consequent === alternate) return consequent;
			return "none";
		}
		case AST_NODE_TYPES.Identifier:
			if (state.playerValues.has(unwrapped.name)) return "value";
			if (state.playerContainers.has(unwrapped.name)) return "container";
			return "none";
		case AST_NODE_TYPES.MemberExpression: {
			const objectKind = classifyNodeTaint(unwrapped.object, state);
			if (objectKind === "container") return "value";
			return "none";
		}
		case AST_NODE_TYPES.ObjectExpression:
			for (const property of unwrapped.properties) {
				if (property.type === AST_NODE_TYPES.SpreadElement) {
					if (classifyNodeTaint(property.argument, state) !== "none") return "container";
					continue;
				}

				if (classifyNodeTaint(property.value, state) !== "none") return "container";
			}

			return "none";
		case AST_NODE_TYPES.SequenceExpression: {
			const lastExpression = unwrapped.expressions.at(-1);
			if (!lastExpression) return "none";
			return classifyNodeTaint(lastExpression, state);
		}
		default:
			return "none";
	}
}

function seedPlayerValueFromParameter(parameter: TSESTree.Parameter, state: CallbackState): void {
	if (parameter.type === AST_NODE_TYPES.TSParameterProperty) {
		markPatternValues(parameter.parameter, state);

		return;
	}

	markPatternValues(parameter, state);
}

export default createRule<Options, MessageIds>({
	create(context) {
		const allowedImportPaths = normalizeImportPaths(context.options[0]);
		const trackedEventsIdentifiers = new Set<string>();
		const callbackStateByFunction = new WeakMap<CallbackFunction, CallbackState>();
		const functionStack = new Array<FunctionState>();

		function getCurrentTopLevelCallbackState(): CallbackState | undefined {
			const current = functionStack.at(-1);
			if (!current?.callbackState) return undefined;
			if (current.callbackDepth > 0) return undefined;
			return current.callbackState;
		}

		function onFunctionEnter(
			node: TSESTree.ArrowFunctionExpression | TSESTree.FunctionDeclaration | TSESTree.FunctionExpression,
		): void {
			if (node.type !== AST_NODE_TYPES.FunctionDeclaration) {
				const callbackState = callbackStateByFunction.get(node);
				if (callbackState) {
					functionStack.push({ callbackDepth: 0, callbackState });
					return;
				}
			}

			const parentState = functionStack.at(-1);
			if (!parentState?.callbackState) {
				functionStack.push({ callbackDepth: 0, callbackState: undefined });
				return;
			}

			functionStack.push({
				callbackDepth: parentState.callbackDepth + 1,
				callbackState: parentState.callbackState,
			});
		}

		function onFunctionExit(): void {
			functionStack.pop();
		}

		return {
			ArrowFunctionExpression: onFunctionEnter,
			"ArrowFunctionExpression:exit": onFunctionExit,

			AssignmentExpression(node): void {
				const callbackState = getCurrentTopLevelCallbackState();
				if (!callbackState) return;
				if (node.operator !== "=") return;

				const taint = classifyNodeTaint(node.right, callbackState);
				if (taint === "none") return;
				markAssignmentTarget(node.left, taint, callbackState);
			},

			CallExpression(node): void {
				const callback = getConnectCallback(node, trackedEventsIdentifiers);
				if (callback) {
					const callbackState: CallbackState = {
						playerContainers: new Set<string>(),
						playerValues: new Set<string>(),
					};

					const [playerParameter] = callback.params;
					if (playerParameter) seedPlayerValueFromParameter(playerParameter, callbackState);

					callbackStateByFunction.set(callback, callbackState);
				}

				const currentCallbackState = getCurrentTopLevelCallbackState();
				if (!currentCallbackState) return;
				if (!isEventsMethodCall(node, trackedEventsIdentifiers)) return;

				const [firstArgument] = node.arguments;
				if (!firstArgument || firstArgument.type === AST_NODE_TYPES.SpreadElement) return;

				if (classifyNodeTaint(firstArgument, currentCallbackState) !== "value") return;

				context.report({
					messageId: "preferFunctions",
					node,
				});
			},

			FunctionDeclaration: onFunctionEnter,
			"FunctionDeclaration:exit": onFunctionExit,
			FunctionExpression: onFunctionEnter,
			"FunctionExpression:exit": onFunctionExit,

			ImportDeclaration(node): void {
				const importSource = node.source.value;
				if (typeof importSource !== "string") return;
				if (!allowedImportPaths.has(importSource)) return;

				for (const specifier of node.specifiers) {
					if (specifier.type === AST_NODE_TYPES.ImportDefaultSpecifier) {
						if (specifier.local.name === "Events") trackedEventsIdentifiers.add(specifier.local.name);
						continue;
					}

					if (specifier.type !== AST_NODE_TYPES.ImportSpecifier) continue;

					if (specifier.imported.type === AST_NODE_TYPES.Identifier && specifier.imported.name === "Events") {
						trackedEventsIdentifiers.add(specifier.local.name);
						continue;
					}

					if (specifier.imported.type === AST_NODE_TYPES.Literal && specifier.imported.value === "Events") {
						trackedEventsIdentifiers.add(specifier.local.name);
					}
				}
			},

			VariableDeclarator(node): void {
				const callbackState = getCurrentTopLevelCallbackState();
				if (!(callbackState && node.init)) return;

				const taint = classifyNodeTaint(node.init, callbackState);
				if (taint === "none") return;

				markBindingPattern(node.id, taint, callbackState);
			},
		};
	},
	defaultOptions: [{ eventsImportPaths: [] }],
	meta: {
		docs: {
			description:
				"Disallow sending Events back to the same player inside an Events.connect callback; use Functions for request/response.",
		},
		messages: {
			preferFunctions:
				"Do not call Events for the same player inside an Events.connect callback. Use a Functions callback instead.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					eventsImportPaths: {
						items: {
							minLength: 1,
							type: "string",
						},
						type: "array",
					},
				},
				required: ["eventsImportPaths"],
				type: "object",
			},
		],
		type: "problem",
	},
	name: "no-events-in-events-callback",
});
