// oxlint-disable prefer-string-raw
import type { TSESTree } from "@typescript-eslint/types";
import { AST_NODE_TYPES } from "@typescript-eslint/types";
import type { SourceCode } from "@typescript-eslint/utils/ts-eslint";
import { regex } from "arkregex";
import { evaluateConstant, normalizeZero, unwrap } from "./constant-folder";
import type { CapturedValue, ParsedParameter, ParsedPattern, WhenCondition } from "./pattern-types";

export type PatternIndex = ReadonlyMap<string, ReadonlyArray<ParsedPattern>>;

export type ResolvedCallee =
	| { readonly kind: "constructor"; readonly typeName: string }
	| { readonly kind: "staticMethod"; readonly typeName: string; readonly methodName: string }
	| { readonly kind: "unknown" };

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
export function resolveCallee(node: TSESTree.CallExpression | TSESTree.NewExpression): ResolvedCallee {
	const callee = unwrap(node.callee);

	if (node.type === AST_NODE_TYPES.NewExpression && callee.type === AST_NODE_TYPES.Identifier) {
		return { kind: "constructor", typeName: callee.name };
	}

	if (node.type === AST_NODE_TYPES.CallExpression) {
		const member = callee.type === AST_NODE_TYPES.ChainExpression ? unwrap(callee.expression) : callee;

		if (member.type === AST_NODE_TYPES.MemberExpression && !member.computed) {
			const object = unwrap(member.object);
			if (object.type === AST_NODE_TYPES.Identifier && member.property.type === AST_NODE_TYPES.Identifier) {
				return {
					kind: "staticMethod",
					methodName: member.property.name,
					typeName: object.name,
				};
			}
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
export function captureParameter(node: TSESTree.Expression, sourceCode: SourceCode): CapturedValue {
	const expression = unwrap(node);
	const sourceText = sourceCode.getText(expression);
	const constValue = evaluateConstant(expression);

	let expressionKey: string;
	let isComplex = false;

	if (expression.type === AST_NODE_TYPES.Literal && typeof expression.value === "number") {
		expressionKey = `literal:${normalizeZero(expression.value)}`;
	} else if (expression.type === AST_NODE_TYPES.Identifier) {
		if (expression.name === "undefined") expressionKey = "undefined";
		else expressionKey = `id:${expression.name}`;
	} else if (constValue === undefined) {
		expressionKey = `complex:${sourceText}`;
		isComplex = true;
	} else expressionKey = `const:${constValue}`;

	if (constValue === undefined) return { expressionKey: expressionKey, isComplex, node: expression, sourceText };

	return { constValue, expressionKey: expressionKey, isComplex, node: expression, sourceText };
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
	parameters: ReadonlyArray<TSESTree.Expression>,
	sourceCode: SourceCode,
): Map<string, CapturedValue> | undefined {
	const captures = new Map<string, CapturedValue>();

	const optionalStart = patterns.findIndex((parsedArg) => parsedArg.kind === "optional");
	const minimumParameters = optionalStart === -1 ? patterns.length : optionalStart;

	if (parameters.length < minimumParameters || parameters.length > patterns.length) return undefined;

	for (let index = 0; index < patterns.length; index += 1) {
		const pattern = patterns[index];
		if (pattern === undefined) continue;
		const parameter = parameters[index];

		const unwrappedParameter = parameter === undefined ? undefined : unwrap(parameter);
		const isMissing =
			parameter === undefined ||
			(unwrappedParameter?.type === AST_NODE_TYPES.Identifier && unwrappedParameter.name === "undefined");

		if (pattern.kind === "literal") {
			if (isMissing) return undefined;
			const captured = captureParameter(parameter, sourceCode);
			if (captured.constValue !== pattern.value) return undefined;
		} else if (pattern.kind === "optional") {
			if (isMissing) continue;
			const captured = captureParameter(parameter, sourceCode);
			if (captured.constValue !== pattern.value) return undefined;
		} else if (pattern.kind === "capture") {
			if (isMissing) return undefined;
			const captured = captureParameter(parameter, sourceCode);
			const captureName: string = pattern.name;
			const existing = captures.get(captureName);
			if (existing !== undefined && existing.expressionKey !== captured.expressionKey) return undefined;
			captures.set(captureName, captured);
		} else if (pattern.kind === "wildcard" && isMissing) return undefined;
	}

	return captures;
}

const CONDITION_PATTERN = regex("^(?<operator>[!<>=]+)\\s*(?<target>.+)$");

function parseCondition(condition: WhenCondition): [string, string] {
	const match = CONDITION_PATTERN.exec(condition);
	return match ? [match.groups.operator, match.groups.target] : ["==", "0"];
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
		const [operator, targetStr] = parseCondition(condition);
		const target = Number.parseFloat(targetStr);
		if (!Number.isFinite(target)) return false;

		let passes: boolean;
		switch (operator) {
			case "!=":
				passes = value !== target;
				break;

			case "==":
				passes = value === target;
				break;

			case ">":
				passes = value > target;
				break;

			case "<":
				passes = value < target;
				break;

			case ">=":
				passes = value >= target;
				break;

			case "<=":
				passes = value <= target;
				break;

			default:
				passes = false;
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
