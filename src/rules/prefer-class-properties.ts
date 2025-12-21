import type { Rule } from "eslint";
import type { ClassBody, ClassDeclaration, Expression, MemberExpression, Node } from "estree";

type Options = "always" | "never";

/**
 * Checks if a property is a simple literal property (not computed, value is a simple literal).
 * @param prop - The property to check
 * @returns True if the property is a simple literal
 */
function isSimpleLiteralProperty(prop: { computed: boolean; value: Expression | null }): boolean {
	return !prop.computed && prop.value !== null && isSimpleLiteral(prop.value);
}

/**
 * Checks if a node is a "simple literal" that can be hoisted to a class property.
 *
 * Includes:
 * - Literal values (strings, numbers, booleans, regex, null)
 * - Array expressions where all elements are simple literals
 * - Object expressions where all properties have simple literal values
 * - Member expressions on simple literals (e.g., 'foo'.length)
 * - Call expressions on simple literals (e.g., 'foo'.toUpperCase())
 * @param node - The node to check
 * @returns True if the node is a simple literal
 */
function isSimpleLiteral(node: Expression | null): boolean {
	if (node === null) return false;

	switch (node.type) {
		case "Literal":
			return true;

		case "MemberExpression":
			return isSimpleLiteral(node.object as Expression);

		case "CallExpression":
			return node.callee.type === "MemberExpression" && isSimpleLiteral(node.callee.object as Expression);

		case "ArrayExpression":
			return node.elements.every((element) => {
				if (element === null) return true;
				// Sparse array holes are fine
				if (element.type === "SpreadElement") return false;
				return isSimpleLiteral(element);
			});

		case "ObjectExpression":
			return node.properties.every((prop) => {
				if (prop.type === "SpreadElement") return false;
				return isSimpleLiteralProperty(prop);
			});

		default:
			return false;
	}
}

/**
 * Checks if a member expression is static (no computed properties with non-literal keys).
 * This ensures we only flag simple `this.foo` patterns, not `this[dynamicKey]`.
 * @param node - The member expression to check
 * @returns True if the member expression is static
 */
function isStaticMemberExpression(node: MemberExpression): boolean {
	let current: Expression = node;
	while (current.type === "MemberExpression") {
		if (current.computed && current.property.type !== "Literal") {
			return false;
		}
		current = current.object as Expression;
	}
	return true;
}

/**
 * Checks if a node is a constructor method definition.
 * @param node - The node to check
 * @returns True if the node is a constructor
 */
function isConstructor(node: Node): boolean {
	return (
		node.type === "MethodDefinition" &&
		node.kind === "constructor" &&
		node.key.type === "Identifier" &&
		node.key.name === "constructor"
	);
}

const preferClassProperties: Rule.RuleModule = {
	create(context) {
		const option: Options = (context.options[0] as Options | undefined) ?? "always";

		if (option === "never") {
			return {
				PropertyDefinition(node) {
					if (!node.static) {
						context.report({
							message: "Unexpected class property.",
							node,
						});
					}
				},
			};
		}

		// Option === 'always'
		return {
			ClassDeclaration(node: ClassDeclaration) {
				checkClass(node.body);
			},
			ClassExpression(node) {
				checkClass((node as unknown as ClassDeclaration).body);
			},
		};

		function checkClass(body: ClassBody): void {
			for (const member of body.body) {
				if (!isConstructor(member)) continue;
				if (member.type !== "MethodDefinition") continue;
				if (!member.value || member.value.type !== "FunctionExpression") continue;

				const constructorBody = member.value.body;
				for (const statement of constructorBody.body) {
					if (statement.type !== "ExpressionStatement") continue;

					const expr = statement.expression;
					if (expr.type !== "AssignmentExpression") continue;
					if (expr.left.type !== "MemberExpression") continue;
					if (expr.left.object.type !== "ThisExpression") continue;

					// Only flag direct this.x assignments, not this.foo.bar
					if (
						(expr.left.property.type === "Identifier" || expr.left.property.type === "Literal") &&
						isSimpleLiteral(expr.right) &&
						isStaticMemberExpression(expr.left)
					) {
						context.report({
							message: "Unexpected assignment of literal instance member.",
							node: expr as unknown as Node,
						});
					}
				}
			}
		}
	},
	meta: {
		docs: {
			description: "Prefer class properties to assignment of literals in constructors.",
			recommended: false,
		},
		schema: [{ enum: ["always", "never"] }],
		type: "suggestion",
	},
};

export default preferClassProperties;
