import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utilities/create-rule";

type MessageIds = "unexpectedClassProperty" | "unexpectedAssignment";
type Options = ["always" | "never"];

type SimpleLiteralCandidate = TSESTree.Expression | TSESTree.AssignmentPattern | TSESTree.TSEmptyBodyFunctionExpression;

function isExpression(node: SimpleLiteralCandidate): node is TSESTree.Expression {
	return node.type !== AST_NODE_TYPES.AssignmentPattern && node.type !== AST_NODE_TYPES.TSEmptyBodyFunctionExpression;
}

function isSimpleLiteralProperty({ computed, value }: TSESTree.Property): boolean {
	return !computed && isExpression(value) && isSimpleLiteral(value);
}

function isSimpleLiteral(node: TSESTree.Expression | undefined): boolean {
	if (!node) return false;

	switch (node.type) {
		case AST_NODE_TYPES.Literal:
			return true;

		case AST_NODE_TYPES.MemberExpression:
			return isSimpleLiteral(node.object);

		case AST_NODE_TYPES.CallExpression:
			return node.callee.type === AST_NODE_TYPES.MemberExpression && isSimpleLiteral(node.callee.object);

		case AST_NODE_TYPES.ArrayExpression:
			return node.elements.every((element) => {
				if (element === null) return true;
				if (element.type === AST_NODE_TYPES.SpreadElement) return false;
				return isSimpleLiteral(element);
			});

		case AST_NODE_TYPES.ObjectExpression:
			return node.properties.every((property) =>
				property.type === AST_NODE_TYPES.SpreadElement || property.type !== AST_NODE_TYPES.Property
					? false
					: isSimpleLiteralProperty(property),
			);

		default:
			return false;
	}
}

function isStaticMemberExpression(node: TSESTree.MemberExpression): boolean {
	let current: TSESTree.Expression = node;
	while (current.type === AST_NODE_TYPES.MemberExpression) {
		if (current.computed && current.property.type !== AST_NODE_TYPES.Literal) return false;
		current = current.object;
	}
	return true;
}

function isConstructor(node: TSESTree.ClassElement): boolean {
	return (
		node.type === AST_NODE_TYPES.MethodDefinition &&
		node.kind === "constructor" &&
		node.key.type === AST_NODE_TYPES.Identifier &&
		node.key.name === "constructor"
	);
}

export default createRule<Options, MessageIds>({
	create(context) {
		const option = context.options[0] ?? "always";

		if (option === "never") {
			return {
				PropertyDefinition(node): void {
					if (node.static) return;
					context.report({
						messageId: "unexpectedClassProperty",
						node,
					});
				},
			};
		}

		return {
			ClassDeclaration(node): void {
				checkClass(node.body);
			},
			ClassExpression(node): void {
				checkClass(node.body);
			},
		};

		function checkClass(body: TSESTree.ClassBody): void {
			for (const member of body.body) {
				if (!isConstructor(member)) continue;
				if (member.type !== AST_NODE_TYPES.MethodDefinition) continue;
				if (!member.value || member.value.type !== AST_NODE_TYPES.FunctionExpression) continue;

				for (const statement of member.value.body.body) {
					if (statement.type !== AST_NODE_TYPES.ExpressionStatement) continue;

					const { expression } = statement;
					if (expression.type !== AST_NODE_TYPES.AssignmentExpression) continue;
					if (expression.left.type !== AST_NODE_TYPES.MemberExpression) continue;
					if (expression.left.object.type !== AST_NODE_TYPES.ThisExpression) continue;

					if (
						(expression.left.property.type === AST_NODE_TYPES.Identifier ||
							expression.left.property.type === AST_NODE_TYPES.Literal) &&
						isSimpleLiteral(expression.right) &&
						isStaticMemberExpression(expression.left)
					) {
						context.report({
							messageId: "unexpectedAssignment",
							node: expression,
						});
					}
				}
			}
		}
	},
	defaultOptions: ["always"],
	meta: {
		docs: {
			description: "Prefer class properties to assignment of literals in constructors.",
		},
		messages: {
			unexpectedAssignment:
				"Constructor assigns a literal value to this.property. Literals are static and known at class definition time. Move to a class property declaration: propertyName = value; at class level. This clarifies intent and reduces constructor complexity.",
			unexpectedClassProperty:
				"Class property declarations are disabled by rule configuration (mode: 'never'). Move initialization into the constructor: this.propertyName = value; inside constructor().",
		},
		schema: [{ enum: ["always", "never"], type: "string" }],
		type: "suggestion",
	},
	name: "prefer-class-properties",
});
