import { describe, expect, it, vi } from "vitest";
import { getImportSpecifierName, getMemberPropertyName, unwrapExpression, unwrapNode } from "$utilities/ast-utilities";
import parser from "@typescript-eslint/parser";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";

import type { TSESTree } from "@typescript-eslint/utils";

vi.setConfig({ testTimeout: 1000 });

function parseExpression(code: string): TSESTree.Expression {
	const { ast } = parser.parseForESLint(code, { ecmaVersion: 2022, sourceType: "module" });
	const [statement] = ast.body;
	if (statement?.type !== AST_NODE_TYPES.ExpressionStatement) {
		const error = new Error("Expected expression statement");
		Error.captureStackTrace(error, parseExpression);
		throw error;
	}
	return statement.expression;
}

function parseMemberExpression(code: string): TSESTree.MemberExpression {
	const expression = parseExpression(code);
	if (expression.type !== AST_NODE_TYPES.MemberExpression) {
		const error = new Error("Expected member expression");
		Error.captureStackTrace(error, parseMemberExpression);
		throw error;
	}
	return expression;
}

function parseImportSpecifier(code: string): TSESTree.ImportSpecifier {
	const { ast } = parser.parseForESLint(code, { ecmaVersion: 2022, sourceType: "module" });
	const [statement] = ast.body;
	if (statement?.type !== AST_NODE_TYPES.ImportDeclaration) {
		const error = new Error("Expected import declaration");
		Error.captureStackTrace(error, parseImportSpecifier);
		throw error;
	}
	const [specifier] = statement.specifiers;
	if (specifier?.type !== AST_NODE_TYPES.ImportSpecifier) {
		const error = new Error("Expected import specifier");
		Error.captureStackTrace(error, parseImportSpecifier);
		throw error;
	}
	return specifier;
}

function parsePrivateMemberExpression(): TSESTree.MemberExpression {
	const { ast } = parser.parseForESLint("class Foo { #bar = 1; test() { return this.#bar; } }", {
		ecmaVersion: 2022,
		sourceType: "module",
	});
	const [classDeclaration] = ast.body;
	if (classDeclaration?.type !== AST_NODE_TYPES.ClassDeclaration) {
		const error = new Error("Expected class declaration");
		Error.captureStackTrace(error, parsePrivateMemberExpression);
		throw error;
	}
	const [, method] = classDeclaration.body.body;
	if (method?.type !== AST_NODE_TYPES.MethodDefinition) {
		const error = new Error("Expected method definition");
		Error.captureStackTrace(error, parsePrivateMemberExpression);
		throw error;
	}
	if (method.value.body === null) {
		const error = new Error("Expected method body");
		Error.captureStackTrace(error, parsePrivateMemberExpression);
		throw error;
	}
	const [returnStatement] = method.value.body.body;
	if (returnStatement?.type !== AST_NODE_TYPES.ReturnStatement) {
		const error = new Error("Expected return statement");
		Error.captureStackTrace(error, parsePrivateMemberExpression);
		throw error;
	}
	if (returnStatement.argument?.type !== AST_NODE_TYPES.MemberExpression) {
		const error = new Error("Expected member expression");
		Error.captureStackTrace(error, parsePrivateMemberExpression);
		throw error;
	}
	return returnStatement.argument;
}

describe("ast-utilities", () => {
	it("unwraps nested expression wrappers", () => {
		expect.assertions(1);
		const expression = parseExpression("(((value as string) as unknown)!)");
		expect(unwrapExpression(expression).type).toBe(AST_NODE_TYPES.Identifier);
	}, 1000);

	it.each([
		["TSAsExpression", "value as string"],
		["TSInstantiationExpression", "factory<string>"],
		["TSNonNullExpression", "value!"],
		["TSSatisfiesExpression", "value satisfies string"],
		["TSTypeAssertion", "<string>value"],
		["ChainExpression", "obj?.value"],
	])(
		"unwraps node-level %s wrappers",
		(_name, code) => {
			expect.assertions(1);
			const expression = parseExpression(code);
			expect(unwrapNode(expression).type).not.toBe(expression.type);
		},
		1000,
	);

	it("gets member property names for static, computed, and unsupported access", () => {
		expect.assertions(3);
		const staticMember = parseMemberExpression("obj.name");
		const computedMember = parseMemberExpression("obj['value']");
		const dynamicMember = parseMemberExpression("obj[dynamic]");

		expect(getMemberPropertyName(staticMember)).toBe("name");
		expect(getMemberPropertyName(computedMember)).toBe("value");
		expect(getMemberPropertyName(dynamicMember)).toBeUndefined();
	}, 1000);

	it("gets imported names from import specifiers", () => {
		expect.assertions(2);
		const identifierSpecifier = parseImportSpecifier('import { createPortal as mountPortal } from "react-dom";');
		const stringSpecifier = parseImportSpecifier('import { "createPortal" as mountPortal } from "react-dom";');

		expect(getImportSpecifierName(identifierSpecifier)).toBe("createPortal");
		expect(getImportSpecifierName(stringSpecifier)).toBe("createPortal");
	}, 1000);

	it("returns undefined for private member access", () => {
		expect.assertions(1);
		const privateMemberExpression = parsePrivateMemberExpression();
		expect(getMemberPropertyName(privateMemberExpression)).toBeUndefined();
	}, 1000);
});
