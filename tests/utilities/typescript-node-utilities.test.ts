import { describe, expect, it } from "vitest";
import {
	getContextualTypeForExpressionNode,
	getRequiredEnumMemberDeclaration,
	getTypeNodeResult,
} from "$utilities/typescript-node-utilities";
import {
	createSourceFile,
	isEnumDeclaration,
	isExpressionStatement,
	isInterfaceDeclaration,
	isNumericLiteral,
	isTypeAliasDeclaration,
	ScriptTarget,
} from "typescript";

import type {
	EnumDeclaration,
	Expression,
	InterfaceDeclaration,
	SourceFile,
	Statement,
	Type,
	TypeAliasDeclaration,
} from "typescript";

function invariantError(message: string, stackTraceLimit: (...parameters: Array<never>) => unknown): Error {
	const error = new Error(message);
	Error.captureStackTrace(error, stackTraceLimit);
	return error;
}

function sourceFile(code: string): SourceFile {
	return createSourceFile("fixture.ts", code, ScriptTarget.Latest, true);
}

function firstStatement(code: string): Statement {
	const file = sourceFile(code);
	const [statement] = file.statements;
	if (statement === undefined) throw invariantError(`Expected statement for ${code}`, firstStatement);
	return statement;
}

function numericExpression(code: string): Expression {
	const statement = firstStatement(code);
	if (!(isExpressionStatement(statement) && isNumericLiteral(statement.expression))) {
		throw invariantError(`Expected numeric expression for ${code}`, numericExpression);
	}
	return statement.expression;
}

function typeAliasStatement(code: string): TypeAliasDeclaration {
	const statement = firstStatement(code);
	if (!isTypeAliasDeclaration(statement)) {
		throw invariantError("Expected type alias declaration.", typeAliasStatement);
	}
	return statement;
}

function enumStatement(code: string): EnumDeclaration {
	const statement = firstStatement(code);
	if (!isEnumDeclaration(statement)) throw invariantError("Expected enum declaration.", enumStatement);
	return statement;
}

function interfaceStatement(code: string): InterfaceDeclaration {
	const statement = firstStatement(code);
	if (!isInterfaceDeclaration(statement)) throw invariantError("Expected interface declaration.", interfaceStatement);
	return statement;
}

function unexpectedContextualTypeLookup(): Type | undefined {
	throw invariantError(
		"Expected non-expression nodes to skip contextual type lookup.",
		unexpectedContextualTypeLookup,
	);
}

function unexpectedTypeNodeCallback(): number {
	throw invariantError("Expected non-type nodes to skip callback execution.", unexpectedTypeNodeCallback);
}

describe("getContextualTypeForExpressionNode", () => {
	it("returns undefined for non-expression nodes", () => {
		expect.assertions(1);

		const result = getContextualTypeForExpressionNode(
			{
				getContextualType: unexpectedContextualTypeLookup,
			},
			firstStatement("interface Value {}"),
		);

		expect(result).toBeUndefined();
	});

	it("delegates expression nodes to the checker", () => {
		expect.assertions(1);

		let called = false;
		getContextualTypeForExpressionNode(
			{
				getContextualType(): Type | undefined {
					called = true;
					return undefined;
				},
			},
			numericExpression("1;"),
		);

		expect(called).toBe(true);
	});
});

describe("getTypeNodeResult", () => {
	it("returns undefined for non-type nodes", () => {
		expect.assertions(1);

		const result = getTypeNodeResult(firstStatement("const value = 1;"), unexpectedTypeNodeCallback);

		expect(result).toBeUndefined();
	});

	it("calls back with type nodes", () => {
		expect.assertions(1);

		const statement = typeAliasStatement("type Value = string;");

		expect(getTypeNodeResult(statement.type, (typeNode) => typeNode.kind)).toBe(statement.type.kind);
	});
});

describe("getRequiredEnumMemberDeclaration", () => {
	it("returns enum member declarations", () => {
		expect.assertions(1);

		const statement = enumStatement("enum Status { Ready }");

		const [member] = statement.members;
		expect(getRequiredEnumMemberDeclaration(member)).toBe(member);
	});

	it("throws for non-enum member declarations", () => {
		expect.assertions(1);

		const statement = interfaceStatement("interface Value {}");

		expect(() => getRequiredEnumMemberDeclaration(statement)).toThrow(
			"Expected enum member symbol to have an enum member declaration.",
		);
	});
});
