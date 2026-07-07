import { AST_NODE_TYPES } from "@typescript-eslint/types";

import { evaluateConstant, normalizeZero, unwrap } from "./constant-folder";

import type { TSESTree } from "@typescript-eslint/types";
import type { SourceCode } from "@typescript-eslint/utils/ts-eslint";

import type { CapturedValue, ParsedParameter, ParsedPattern, WhenCondition } from "./pattern-types";

type SourceTextProvider = Pick<SourceCode, "getText">;

export type PatternIndex = ReadonlyMap<string, ReadonlyArray<ParsedPattern>>;

type ParameterState =
	| { readonly kind: "available"; readonly isMissing: boolean; readonly parameter: TSESTree.Expression }
	| { readonly kind: "missing" }
	| { readonly kind: "spread" };

type ResolvedCallee =
	| { readonly kind: "constructor"; readonly typeName: string }
	| { readonly kind: "staticMethod"; readonly typeName: string; readonly methodName: string }
	| { readonly kind: "unknown" };

type LiteralPatternParameter = Extract<ParsedParameter, { readonly kind: "literal" | "optional" }>;
type CapturePatternParameter = Extract<ParsedParameter, { readonly kind: "capture" }>;
type ConditionOperator = "!=" | "==" | ">" | "<" | ">=" | "<=";

/**
 * Build an index for O(1) pattern lookup
 *
 * @param patterns - Array of parsed patterns to index
 * @returns Map of pattern index keys to pattern arrays
 */
export function buildPatternIndex(patterns: ReadonlyArray<ParsedPattern>): PatternIndex {
	const index = new Map<string, Array<ParsedPattern>>();

	for (const pattern of patterns) {
		const key =
			pattern.type === "constructor"
				? `constructor:${pattern.typeName}`
				: `staticMethod:${pattern.typeName}:${pattern.methodName}`;

		const existing = index.get(key);
		if (existing) existing.push(pattern);
		else index.set(key, [pattern]);
	}

	return index;
}

/**
 * Resolve the callee of a call/new expression
 *
 * @param node - Call or new expression node
 * @returns Resolved callee information
 */
export function resolveCallee(
	node: TSESTree.CallExpression | TSESTree.NewExpression | TSESTree.ChainExpression,
): ResolvedCallee {
	const expression = unwrap(node);
	const callableNode =
		expression.type === AST_NODE_TYPES.ChainExpression ? unwrap(expression.expression) : expression;

	if (callableNode.type !== AST_NODE_TYPES.CallExpression && callableNode.type !== AST_NODE_TYPES.NewExpression) {
		return { kind: "unknown" };
	}

	const callee = unwrap(callableNode.callee);

	if (callableNode.type === AST_NODE_TYPES.NewExpression && callee.type === AST_NODE_TYPES.Identifier) {
		return { kind: "constructor", typeName: callee.name };
	}

	if (
		callableNode.type === AST_NODE_TYPES.CallExpression &&
		callee.type === AST_NODE_TYPES.MemberExpression &&
		!callee.computed
	) {
		const object = unwrap(callee.object);
		if (object.type === AST_NODE_TYPES.Identifier && callee.property.type === AST_NODE_TYPES.Identifier) {
			return {
				kind: "staticMethod",
				methodName: callee.property.name,
				typeName: object.name,
			};
		}
	}

	return { kind: "unknown" };
}

/**
 * Capture an argument value for matching
 *
 * @param node - Expression node to capture
 * @param sourceCode - ESLint source code object
 * @returns Captured value with metadata
 */
export function captureParameter(node: TSESTree.Expression, sourceCode: SourceTextProvider): CapturedValue {
	const expression = unwrap(node);
	const sourceText = sourceCode.getText(expression);
	const constValue = evaluateConstant(expression);

	let expressionKey: string;
	let isComplex = false;

	if (expression.type === AST_NODE_TYPES.Literal && typeof expression.value === "number") {
		expressionKey = `literal:${normalizeZero(expression.value)}`;
	} else if (expression.type === AST_NODE_TYPES.Identifier) {
		expressionKey = expression.name === "undefined" ? "undefined" : `id:${expression.name}`;
	} else if (constValue === undefined) {
		expressionKey = `complex:${sourceText}`;
		isComplex = true;
	} else expressionKey = `const:${constValue}`;

	if (constValue === undefined) return { expressionKey, isComplex, node: expression, sourceText };

	return { constValue, expressionKey, isComplex, node: expression, sourceText };
}

function getParameterState(parameter: TSESTree.CallExpressionArgument | undefined): ParameterState {
	if (parameter === undefined) return { kind: "missing" };
	if (parameter.type === AST_NODE_TYPES.SpreadElement) return { kind: "spread" };

	const unwrappedParameter = unwrap(parameter);
	return {
		isMissing: unwrappedParameter.type === AST_NODE_TYPES.Identifier && unwrappedParameter.name === "undefined",
		kind: "available",
		parameter,
	};
}

function isMissingParameter(state: ParameterState): boolean {
	return state.kind === "missing" || (state.kind === "available" && state.isMissing);
}

function matchesLiteralParameter(
	pattern: LiteralPatternParameter,
	state: ParameterState,
	sourceCode: SourceTextProvider,
): boolean {
	if (state.kind !== "available" || state.isMissing) return false;

	const captured = captureParameter(state.parameter, sourceCode);
	return captured.constValue === pattern.value;
}

function captureNamedParameter(
	pattern: CapturePatternParameter,
	state: ParameterState,
	captures: Map<string, CapturedValue>,
	sourceCode: SourceTextProvider,
): boolean {
	if (state.kind !== "available" || state.isMissing) return false;

	const captured = captureParameter(state.parameter, sourceCode);
	const existing = captures.get(pattern.name);
	if (existing !== undefined && existing.expressionKey !== captured.expressionKey) return false;

	captures.set(pattern.name, captured);
	return true;
}

function matchesPatternParameter(
	pattern: ParsedParameter,
	state: ParameterState,
	captures: Map<string, CapturedValue>,
	sourceCode: SourceTextProvider,
): boolean {
	if (state.kind === "spread") return false;

	if (pattern.kind === "capture") return captureNamedParameter(pattern, state, captures, sourceCode);
	if (pattern.kind === "literal") return matchesLiteralParameter(pattern, state, sourceCode);
	if (pattern.kind === "optional") {
		return isMissingParameter(state) || matchesLiteralParameter(pattern, state, sourceCode);
	}

	return !isMissingParameter(state);
}

/**
 * Match arguments against a pattern
 *
 * @param patterns - Pattern arguments to match against
 * @param parameters - Actual expression arguments
 * @param sourceCode - ESLint source code object
 * @returns Map of captures if match succeeds, undefined otherwise
 */
export function matchParameters(
	patterns: ReadonlyArray<ParsedParameter>,
	parameters: ReadonlyArray<TSESTree.CallExpressionArgument>,
	sourceCode: SourceTextProvider,
): Map<string, CapturedValue> | undefined {
	const captures = new Map<string, CapturedValue>();

	const optionalStart = patterns.findIndex((pattern) => pattern?.kind === "optional");
	const minimumParameters = optionalStart === -1 ? patterns.length : optionalStart;

	if (parameters.length < minimumParameters || parameters.length > patterns.length) return undefined;

	for (let index = 0; index < patterns.length; index += 1) {
		const pattern = patterns[index];
		if (pattern === undefined) continue;
		const state = getParameterState(parameters[index]);
		if (!matchesPatternParameter(pattern, state, captures, sourceCode)) return undefined;
	}

	return captures;
}

function parseCondition(condition: WhenCondition): [ConditionOperator, string] {
	if (condition.startsWith(">=")) return [">=", condition.slice(2).trim()];
	if (condition.startsWith("<=")) return ["<=", condition.slice(2).trim()];
	if (condition.startsWith("!=")) return ["!=", condition.slice(2).trim()];
	if (condition.startsWith("==")) return ["==", condition.slice(2).trim()];
	if (condition.startsWith(">")) return [">", condition.slice(1).trim()];

	return ["<", condition.slice(1).trim()];
}

/**
 * Evaluate when conditions against captured values
 *
 * @param conditions - Map of variable names to conditions
 * @param captures - Map of captured values
 * @returns True if all conditions pass
 */
export function evaluateConditions(
	conditions: ReadonlyMap<string, WhenCondition>,
	captures: ReadonlyMap<string, CapturedValue>,
): boolean {
	for (const [name, condition] of conditions) {
		const captured = captures.get(name);
		if (captured?.constValue === undefined) return false;

		const value = captured.constValue;
		const [operator, targetString] = parseCondition(condition);
		const target = Number(targetString);
		if (!Number.isFinite(target)) return false;

		let passes: boolean;
		switch (operator) {
			case "!=": {
				passes = value !== target;
				break;
			}

			case "==": {
				passes = value === target;
				break;
			}

			case ">": {
				passes = value > target;
				break;
			}

			case "<": {
				passes = value < target;
				break;
			}

			case ">=": {
				passes = value >= target;
				break;
			}

			case "<=": {
				passes = value <= target;
				break;
			}
		}

		if (!passes) return false;
	}
	return true;
}

/**
 * Check if captures can be safely substituted
 *
 * @param captures - Map of captured values
 * @returns True if all captures are simple (not complex expressions)
 */
export function canSafelySubstitute(captures: ReadonlyMap<string, CapturedValue>): boolean {
	for (const [, captured] of captures) if (captured.isComplex) return false;
	return true;
}
