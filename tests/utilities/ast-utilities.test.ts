import { describe, expect, it, vi } from "vitest";
import parser from "@typescript-eslint/parser";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { getMemberPropertyName, unwrapExpression } from "@utilities/ast-utilities";

import type { TSESTree } from "@typescript-eslint/utils";

vi.setConfig({ testTimeout: 1000 });

function parseExpression(code: string): TSESTree.Expression {
	const { ast } = parser.parseForESLint(code, { ecmaVersion: 2022, sourceType: "module" });
	const [statement] = ast.body;
	if (statement?.type !== AST_NODE_TYPES.ExpressionStatement) throw new Error("Expected expression statement");
	return statement.expression;
}

function parseMemberExpression(code: string): TSESTree.MemberExpression {
	const expression = parseExpression(code);
	if (expression.type !== AST_NODE_TYPES.MemberExpression) throw new Error("Expected member expression");
	return expression;
}

function parsePrivateMemberExpression(): TSESTree.MemberExpression {
	const { ast } = parser.parseForESLint("class Foo { #bar = 1; test() { return this.#bar; } }", {
		ecmaVersion: 2022,
		sourceType: "module",
	});
	const [classDeclaration] = ast.body;
	if (classDeclaration?.type !== AST_NODE_TYPES.ClassDeclaration) throw new Error("Expected class declaration");
	const [, method] = classDeclaration.body.body;
	if (method?.type !== AST_NODE_TYPES.MethodDefinition) throw new Error("Expected method definition");
	if (method.value.body === null) throw new Error("Expected method body");
	const [returnStatement] = method.value.body.body;
	if (returnStatement?.type !== AST_NODE_TYPES.ReturnStatement) throw new Error("Expected return statement");
	if (returnStatement.argument?.type !== AST_NODE_TYPES.MemberExpression) {
		throw new Error("Expected member expression");
	}
	return returnStatement.argument;
}

describe("ast-utilities", () => {
	it("unwraps nested expression wrappers", () => {
		expect.assertions(1);
		const expression = parseExpression("(((value as string) as unknown)!)");
		expect(unwrapExpression(expression).type).toBe(AST_NODE_TYPES.Identifier);
	}, 1000);

	it("gets member property names for static, computed, and unsupported access", () => {
		expect.assertions(3);
		const staticMember = parseMemberExpression("obj.name");
		const computedMember = parseMemberExpression("obj['value']");
		const dynamicMember = parseMemberExpression("obj[dynamic]");

		expect(getMemberPropertyName(staticMember)).toBe("name");
		expect(getMemberPropertyName(computedMember)).toBe("value");
		expect(getMemberPropertyName(dynamicMember)).toBeUndefined();
	}, 1000);

	it("returns undefined for private member access", () => {
		expect.assertions(1);
		const privateMemberExpression = parsePrivateMemberExpression();
		expect(getMemberPropertyName(privateMemberExpression)).toBeUndefined();
	}, 1000);
});
