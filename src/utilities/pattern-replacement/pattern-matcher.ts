import { AST_NODE_TYPES } from "@typescript-eslint/types";
import type { TSESTree } from "@typescript-eslint/types";
import type { SourceCode } from "@typescript-eslint/utils/ts-eslint";
import { evaluateConstant, normalizeZero, unwrap } from "./constant-folder";
import type { CapturedValue, ParsedArg, ParsedPattern, WhenCondition } from "./pattern-types";

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
		if (existing) {
			existing.push(pattern);
		} else {
			index.set(key, [pattern]);
		}
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
		// Handle optional chaining: Type?.method()
		const member = callee.type === AST_NODE_TYPES.ChainExpression ? unwrap(callee.expression) : callee;

		if (member.type === AST_NODE_TYPES.MemberExpression && !member.computed) {
			const obj = unwrap(member.object);
			if (obj.type === AST_NODE_TYPES.Identifier && member.property.type === AST_NODE_TYPES.Identifier) {
				return {
					kind: "staticMethod",
					methodName: member.property.name,
					typeName: obj.name,
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
export function captureArg(node: TSESTree.Expression, sourceCode: SourceCode): CapturedValue {
	const expr = unwrap(node);
	const sourceText = sourceCode.getText(expr);
	const constValue = evaluateConstant(expr);

	let exprKey: string;
	let isComplex = false;

	if (expr.type === AST_NODE_TYPES.Literal && typeof expr.value === "number") {
		exprKey = `literal:${normalizeZero(expr.value)}`;
	} else if (expr.type === AST_NODE_TYPES.Identifier) {
		if (expr.name === "undefined") {
			exprKey = "undefined";
		} else {
			exprKey = `id:${expr.name}`;
		}
	} else if (constValue === undefined) {
		exprKey = `complex:${sourceText}`;
		isComplex = true;
	} else {
		exprKey = `const:${constValue}`;
	}

	if (constValue === undefined) {
		return { exprKey, isComplex, node: expr, sourceText };
	}

	return { constValue, exprKey, isComplex, node: expr, sourceText };
}

/**
 * Match arguments against a pattern
 *
 * @param pattern - Pattern arguments to match against
 * @param args - Actual expression arguments
 * @param sourceCode - ESLint source code object
 * @returns Map of captures if match succeeds, undefined otherwise
 */
export function matchArgs(
	pattern: ReadonlyArray<ParsedArg>,
	args: ReadonlyArray<TSESTree.Expression>,
	sourceCode: SourceCode,
): Map<string, CapturedValue> | undefined {
	const captures = new Map<string, CapturedValue>();

	const optionalStart = pattern.findIndex((parsedArg) => parsedArg.kind === "optional");
	const minArgs = optionalStart === -1 ? pattern.length : optionalStart;

	if (args.length < minArgs || args.length > pattern.length) {
		return undefined;
	}

	for (let index = 0; index < pattern.length; index++) {
		const pat = pattern[index];
		if (pat === undefined) continue;
		const arg = args[index];

		const unwrappedArg = arg === undefined ? undefined : unwrap(arg);
		const isMissing =
			arg === undefined ||
			(unwrappedArg?.type === AST_NODE_TYPES.Identifier && unwrappedArg.name === "undefined");

		if (pat.kind === "literal") {
			if (isMissing) return undefined;
			const captured = captureArg(arg, sourceCode);
			if (captured.constValue !== pat.value) return undefined;
		} else if (pat.kind === "optional") {
			if (isMissing) continue;
			const captured = captureArg(arg, sourceCode);
			if (captured.constValue !== pat.value) return undefined;
		} else if (pat.kind === "capture") {
			if (isMissing) return undefined;
			const captured = captureArg(arg, sourceCode);
			const captureName: string = pat.name;
			const existing = captures.get(captureName);
			if (existing !== undefined && existing.exprKey !== captured.exprKey) {
				return undefined;
			}
			captures.set(captureName, captured);
		} else if (pat.kind === "wildcard" && isMissing) {
			return undefined;
		}
	}

	return captures;
}

const CONDITION_PATTERN = /^([!<>=]+)\s*(.+)$/;

function parseCondition(condition: WhenCondition): [string, string] {
	const match = condition.match(CONDITION_PATTERN);
	if (!(match?.[1] && match[2])) return ["==", "0"];
	return [match[1], match[2]];
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
		const [op, targetStr] = parseCondition(condition);
		const target = Number.parseFloat(targetStr);
		if (!Number.isFinite(target)) return false;

		let passes: boolean;
		switch (op) {
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
	for (const captured of captures.values()) {
		if (captured.isComplex) return false;
	}
	return true;
}
