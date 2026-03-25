import { AST_NODE_TYPES } from "@typescript-eslint/utils";

import { createRule } from "../utilities/create-rule";

import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

type MessageIds = "useIdiv" | "useIdivNested";

interface PreferIdivOptions {
	reportNestedDivisions?: boolean;
}

type Options = [PreferIdivOptions];

const WRAPPER_TYPES = new Set([
	"TSAsExpression",
	"TSSatisfiesExpression",
	"TSTypeAssertion",
	"TSNonNullExpression",
	"TSInstantiationExpression",
	"ChainExpression",
]);

function unwrapExpression(expression: TSESTree.Expression): TSESTree.Expression {
	let current: TSESTree.Expression = expression;

	while (WRAPPER_TYPES.has(current.type)) {
		switch (current.type) {
			case AST_NODE_TYPES.TSAsExpression:
			case AST_NODE_TYPES.TSSatisfiesExpression:
			case AST_NODE_TYPES.TSTypeAssertion:
			case AST_NODE_TYPES.TSNonNullExpression:
			case AST_NODE_TYPES.TSInstantiationExpression:
			case AST_NODE_TYPES.ChainExpression:
				current = current.expression;
				break;
		}
	}

	return current;
}

function getMemberPropertyName(memberExpression: TSESTree.MemberExpression): string | undefined {
	if (!memberExpression.computed) {
		if (memberExpression.property.type === AST_NODE_TYPES.Identifier) return memberExpression.property.name;
		return undefined;
	}

	if (memberExpression.property.type !== AST_NODE_TYPES.Literal) return undefined;
	return typeof memberExpression.property.value === "string" ? memberExpression.property.value : undefined;
}

function hasShadowedBinding(
	context: TSESLint.RuleContext<MessageIds, Options>,
	node: TSESTree.Node,
	name: string,
): boolean {
	let scope: TSESLint.Scope.Scope | undefined = context.sourceCode.getScope(node);

	while (scope !== undefined) {
		const variable = scope.set.get(name);
		if (variable !== undefined && variable.defs.length > 0) return true;
		scope = scope.upper ?? undefined;
	}

	return false;
}

function isNestedDivision(binaryExpr: TSESTree.BinaryExpression): boolean {
	return binaryExpr.left.type === AST_NODE_TYPES.BinaryExpression && binaryExpr.left.operator === "/";
}

function needsParentheses(node: TSESTree.Expression): boolean {
	// Numeric literals need parentheses: 100.idiv(3) is invalid, (100).idiv(3) is valid
	if (node.type === AST_NODE_TYPES.Literal && typeof node.value === "number" && Number.isFinite(node.value)) {
		return true;
	}

	// Binary expressions need parentheses for operator precedence: (a + b).idiv(c) not a + b.idiv(c)
	if (node.type === AST_NODE_TYPES.BinaryExpression) {
		return true;
	}

	// Conditional expressions (ternary) need parentheses
	if (node.type === AST_NODE_TYPES.ConditionalExpression) {
		return true;
	}

	return false;
}

const preferIdiv = createRule<Options, MessageIds>({
	create(context) {
		const options = context.options[0] ?? {};
		const reportNestedDivisions = options.reportNestedDivisions ?? false;

		return {
			CallExpression(node): void {
				// Skip optional chaining
				if (node.optional) return;
				if (node.callee.type === AST_NODE_TYPES.Super) return;

				const callee = unwrapExpression(node.callee);

				// Must be a member expression (math.floor)
				if (callee.type !== AST_NODE_TYPES.MemberExpression) return;
				if (callee.optional) return;
				if (callee.object.type === AST_NODE_TYPES.Super) return;

				// Check property name is "floor"
				const propertyName = getMemberPropertyName(callee);
				if (propertyName !== "floor") return;

				// Check object is "math" identifier (not shadowed)
				const target = unwrapExpression(callee.object);
				if (target.type !== AST_NODE_TYPES.Identifier || target.name !== "math") return;
				if (hasShadowedBinding(context, target, "math")) return;

				// Must have exactly one argument
				if (node.arguments.length !== 1) return;

				// Unwrap the argument and check it's a division
				const arg = unwrapExpression(node.arguments[0] as TSESTree.Expression);
				if (arg.type !== AST_NODE_TYPES.BinaryExpression || arg.operator !== "/") return;

				// Check for nested division
				if (isNestedDivision(arg)) {
					if (reportNestedDivisions) {
						context.report({
							messageId: "useIdivNested",
							node,
						});
					}
					return;
				}

				// Simple division - report with auto-fix
				const leftText = context.sourceCode.getText(arg.left);
				const rightText = context.sourceCode.getText(arg.right);

				// Wrap numeric literals in parentheses
				const leftOperand = needsParentheses(arg.left) ? `(${leftText})` : leftText;

				context.report({
					data: { left: leftOperand, right: rightText },
					fix: (fixer) => fixer.replaceText(node, `${leftOperand}.idiv(${rightText})`),
					messageId: "useIdiv",
					node,
				});
			},
		};
	},
	defaultOptions: [{ reportNestedDivisions: false }],
	meta: {
		docs: {
			description: "Prefer using `.idiv()` for integer division instead of `math.floor(x / y)` in roblox-ts.",
		},
		fixable: "code",
		messages: {
			useIdiv: "Use `{{left}}.idiv({{right}})` instead of `math.floor({{left}} / {{right}})`.",
			useIdivNested:
				"Use explicit `.idiv()` calls instead of `math.floor()` with nested divisions. Note: `math.floor(a / b / c)` is NOT equivalent to `a.idiv(b).idiv(c)` due to floating-point vs stepwise floor semantics.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					reportNestedDivisions: {
						type: "boolean",
					},
				},
				type: "object",
			},
		],
		type: "suggestion",
	},
	name: "prefer-idiv",
});

export default preferIdiv;

export type { PreferIdivOptions };
