import { getMemberPropertyName, unwrapNode } from "$utilities/ast-utilities";
import { createRule } from "$utilities/create-rule";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";

import type { TSESTree } from "@typescript-eslint/utils";

type MessageIds = "preferFunctions";

export interface NoEventsInEventsCallbackOptions {
	readonly eventsImportPaths: ReadonlyArray<string>;
}

type Options = [NoEventsInEventsCallbackOptions];

type TaintKind = "container" | "none" | "value";
type PresentTaintKind = Exclude<TaintKind, "none">;
type TrackableAssignmentTarget =
	| TSESTree.ArrayPattern
	| TSESTree.AssignmentPattern
	| TSESTree.Identifier
	| TSESTree.ObjectPattern;

interface CallbackState {
	readonly playerContainers: Set<string>;
	readonly playerValues: Set<string>;
}

interface FunctionState {
	readonly callbackDepth: number;
	readonly callbackState: CallbackState | undefined;
}

type CallbackFunction = TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression;

function normalizeImportPaths(options: NoEventsInEventsCallbackOptions): ReadonlySet<string> {
	return new Set(options.eventsImportPaths);
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
	if (rootIdentifier === undefined || !eventsIdentifiers.has(rootIdentifier)) return undefined;

	const [callbackArgument] = node.arguments;
	switch (callbackArgument?.type) {
		case AST_NODE_TYPES.ArrowFunctionExpression:
		case AST_NODE_TYPES.FunctionExpression:
			return callbackArgument;

		default:
			return undefined;
	}
}

function isEventsMethodCall(node: TSESTree.CallExpression, eventsIdentifiers: ReadonlySet<string>): boolean {
	const unwrappedCallee = unwrapNode(node.callee);
	if (unwrappedCallee.type !== AST_NODE_TYPES.MemberExpression) return false;

	const rootIdentifier = getRootIdentifierName(unwrappedCallee);
	return rootIdentifier !== undefined && eventsIdentifiers.has(rootIdentifier);
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
	kind: PresentTaintKind,
	state: CallbackState,
): boolean {
	if (pattern.type === AST_NODE_TYPES.Identifier) {
		if (kind === "value") return markAsPlayerValue(pattern.name, state);
		return markAsPlayerContainer(pattern.name, state);
	}

	return markPatternValues(pattern, state);
}

function isTrackableAssignmentTarget(target: TSESTree.Node): target is TrackableAssignmentTarget {
	return (
		target.type === AST_NODE_TYPES.ArrayPattern ||
		target.type === AST_NODE_TYPES.AssignmentPattern ||
		target.type === AST_NODE_TYPES.Identifier ||
		target.type === AST_NODE_TYPES.ObjectPattern
	);
}

function markAssignmentTarget(target: TSESTree.Node, kind: TaintKind, state: CallbackState): boolean {
	if (target.type === AST_NODE_TYPES.MemberExpression || kind === "none" || !isTrackableAssignmentTarget(target)) {
		return false;
	}

	if (target.type === AST_NODE_TYPES.Identifier) {
		if (kind === "value") return markAsPlayerValue(target.name, state);
		return markAsPlayerContainer(target.name, state);
	}

	return markPatternValues(target, state);
}

function classifyArrayTaint(node: TSESTree.ArrayExpression, state: CallbackState): TaintKind {
	for (const element of node.elements) {
		if (element === null) continue;

		const target = element.type === AST_NODE_TYPES.SpreadElement ? element.argument : element;
		if (classifyNodeTaint(target, state) !== "none") return "container";
	}

	return "none";
}

function classifyObjectTaint(node: TSESTree.ObjectExpression, state: CallbackState): TaintKind {
	for (const property of node.properties) {
		if (property.type === AST_NODE_TYPES.SpreadElement) {
			if (classifyNodeTaint(property.argument, state) !== "none") return "container";
			continue;
		}

		if (classifyNodeTaint(property.value, state) !== "none") return "container";
	}

	return "none";
}

function classifyConditionalTaint(node: TSESTree.ConditionalExpression, state: CallbackState): TaintKind {
	const consequent = classifyNodeTaint(node.consequent, state);
	return consequent === classifyNodeTaint(node.alternate, state) ? consequent : "none";
}

function classifyIdentifierTaint(node: TSESTree.Identifier, state: CallbackState): TaintKind {
	if (state.playerValues.has(node.name)) return "value";
	if (state.playerContainers.has(node.name)) return "container";
	return "none";
}

function classifySequenceTaint(node: TSESTree.SequenceExpression, state: CallbackState): TaintKind {
	let taint: TaintKind = "none";
	for (const expression of node.expressions) {
		taint = classifyNodeTaint(expression, state);
	}

	return taint;
}

function classifyNodeTaint(node: TSESTree.Node, state: CallbackState): TaintKind {
	const unwrapped = unwrapNode(node);

	switch (unwrapped.type) {
		case AST_NODE_TYPES.ArrayExpression:
			return classifyArrayTaint(unwrapped, state);

		case AST_NODE_TYPES.AssignmentExpression:
			return classifyNodeTaint(unwrapped.right, state);

		case AST_NODE_TYPES.ConditionalExpression:
			return classifyConditionalTaint(unwrapped, state);

		case AST_NODE_TYPES.Identifier:
			return classifyIdentifierTaint(unwrapped, state);

		case AST_NODE_TYPES.MemberExpression: {
			const objectKind = classifyNodeTaint(unwrapped.object, state);
			return objectKind === "container" ? "value" : "none";
		}

		case AST_NODE_TYPES.ObjectExpression:
			return classifyObjectTaint(unwrapped, state);

		case AST_NODE_TYPES.SequenceExpression:
			return classifySequenceTaint(unwrapped, state);

		default:
			return "none";
	}
}

function trackEventsImportSpecifier(specifier: TSESTree.ImportClause, trackedEventsIdentifiers: Set<string>): void {
	if (specifier.type === AST_NODE_TYPES.ImportDefaultSpecifier) {
		if (specifier.local.name === "Events") trackedEventsIdentifiers.add(specifier.local.name);
		return;
	}

	if (specifier.type !== AST_NODE_TYPES.ImportSpecifier) return;
	if (specifier.imported.type === AST_NODE_TYPES.Identifier && specifier.imported.name === "Events") {
		trackedEventsIdentifiers.add(specifier.local.name);
		return;
	}

	if (specifier.imported.type === AST_NODE_TYPES.Literal && specifier.imported.value === "Events") {
		trackedEventsIdentifiers.add(specifier.local.name);
	}
}

const noEventsInEventsCallback = createRule<Options, MessageIds>({
	create(context) {
		const allowedImportPaths = normalizeImportPaths(context.options[0]);
		const trackedEventsIdentifiers = new Set<string>();
		const callbackStateByFunction = new WeakMap<CallbackFunction, CallbackState>();
		const functionStack = new Array<FunctionState>();

		function getCurrentTopLevelCallbackState(): CallbackState | undefined {
			const current = functionStack.at(-1);
			if (!current?.callbackState || current.callbackDepth > 0) return undefined;
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
				if (callbackState === undefined || node.operator !== "=") return;

				const taint = classifyNodeTaint(node.right, callbackState);
				if (taint !== "none") markAssignmentTarget(node.left, taint, callbackState);
			},

			CallExpression(node): void {
				const callback = getConnectCallback(node, trackedEventsIdentifiers);
				if (callback !== undefined) {
					const callbackState: CallbackState = {
						playerContainers: new Set<string>(),
						playerValues: new Set<string>(),
					};

					const [playerParameter] = callback.params;
					if (playerParameter !== undefined) markPatternValues(playerParameter, callbackState);

					callbackStateByFunction.set(callback, callbackState);
				}

				const currentCallbackState = getCurrentTopLevelCallbackState();
				if (currentCallbackState === undefined || !isEventsMethodCall(node, trackedEventsIdentifiers)) return;

				const [firstArgument] = node.arguments;
				if (firstArgument === undefined || firstArgument.type === AST_NODE_TYPES.SpreadElement) return;

				if (classifyNodeTaint(firstArgument, currentCallbackState) === "value") {
					context.report({
						messageId: "preferFunctions",
						node,
					});
				}
			},

			FunctionDeclaration: onFunctionEnter,
			"FunctionDeclaration:exit": onFunctionExit,
			FunctionExpression: onFunctionEnter,
			"FunctionExpression:exit": onFunctionExit,

			ImportDeclaration(node): void {
				const importSource = node.source.value;
				if (!allowedImportPaths.has(importSource)) return;

				for (const specifier of node.specifiers) {
					trackEventsImportSpecifier(specifier, trackedEventsIdentifiers);
				}
			},

			VariableDeclarator(node): void {
				const callbackState = getCurrentTopLevelCallbackState();
				if (callbackState === undefined || node.init === null) return;

				const taint = classifyNodeTaint(node.init, callbackState);
				if (taint === "none") return;

				markBindingPattern(node.id, taint, callbackState);
			},
		};
	},
	meta: {
		defaultOptions: [{ eventsImportPaths: [] }],
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

export default noEventsInEventsCallback;
