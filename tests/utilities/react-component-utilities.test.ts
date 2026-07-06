import { describe, expect, it, vi } from "vitest";
import {
	isFunctionLikeNode,
	isLikelyReactComponentName,
	isReactComponentFunction,
} from "$utilities/react-component-utilities";
import { parse } from "@typescript-eslint/parser";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import ts from "typescript";

import type { TSESTree } from "@typescript-eslint/utils";

function getStatement(program: TSESTree.Program, index: number): TSESTree.Statement {
	const statement = program.body[index];
	if (statement === undefined) {
		const error = new Error(`Missing statement at index ${index}`);
		Error.captureStackTrace(error, getStatement);
		throw error;
	}
	return statement;
}

function getSingleDeclarationInit(statement: TSESTree.Statement): TSESTree.Expression {
	if (statement.type !== AST_NODE_TYPES.VariableDeclaration) {
		const error = new Error(`Expected variable declaration, received ${statement.type}`);
		Error.captureStackTrace(error, getSingleDeclarationInit);
		throw error;
	}

	const [declaration] = statement.declarations;
	if (declaration?.init === undefined || declaration.init === null) {
		const error = new Error("Expected one initialized variable declarator");
		Error.captureStackTrace(error, getSingleDeclarationInit);
		throw error;
	}
	return declaration.init;
}

function createTypeChecker(code: string): { checker: ts.TypeChecker; sourceFile: ts.SourceFile } {
	const fileName = "component.ts";
	const sourceFile = ts.createSourceFile(fileName, code, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
	const host = ts.createCompilerHost({});
	host.getSourceFile = (requestedFileName): ts.SourceFile | undefined =>
		requestedFileName === fileName ? sourceFile : undefined;
	host.readFile = (requestedFileName): string | undefined => (requestedFileName === fileName ? code : undefined);
	host.fileExists = (requestedFileName): boolean => requestedFileName === fileName;
	const program = ts.createProgram([fileName], { noLib: true, strict: true }, host);
	return { checker: program.getTypeChecker(), sourceFile };
}

function getFunctionType(code: string, name: string): { checker: ts.TypeChecker; type: ts.Type } {
	const { checker, sourceFile } = createTypeChecker(code);
	let symbol: ts.Symbol | undefined;
	for (const statement of sourceFile.statements) {
		if (ts.isFunctionDeclaration(statement) && statement.name?.text === name) {
			symbol = checker.getSymbolAtLocation(statement.name);
			break;
		}
	}
	if (symbol === undefined) {
		const error = new Error(`Missing function symbol: ${name}`);
		Error.captureStackTrace(error, getFunctionType);
		throw error;
	}
	return { checker, type: checker.getTypeOfSymbol(symbol) };
}

function getVariableType(code: string, name: string): { checker: ts.TypeChecker; type: ts.Type } {
	const { checker, sourceFile } = createTypeChecker(code);
	let symbol: ts.Symbol | undefined;
	for (const statement of sourceFile.statements) {
		if (ts.isVariableStatement(statement)) {
			for (const declaration of statement.declarationList.declarations) {
				if (ts.isIdentifier(declaration.name) && declaration.name.text === name) {
					symbol = checker.getSymbolAtLocation(declaration.name);
					break;
				}
			}
		}
	}
	if (symbol === undefined) {
		const error = new Error(`Missing variable symbol: ${name}`);
		Error.captureStackTrace(error, getVariableType);
		throw error;
	}
	return { checker, type: checker.getTypeOfSymbol(symbol) };
}

describe("react-component-utilities", () => {
	describe("isFunctionLikeNode", () => {
		it("accepts function-like node types", () => {
			expect.assertions(3);

			const program = parse("function Component() {} const Named = function() {}; const Arrow = () => null;");
			const declaration = getStatement(program, 0);
			const named = getStatement(program, 1);
			const arrow = getStatement(program, 2);

			expect(isFunctionLikeNode(declaration)).toBe(true);
			expect(isFunctionLikeNode(getSingleDeclarationInit(named))).toBe(true);
			expect(isFunctionLikeNode(getSingleDeclarationInit(arrow))).toBe(true);
		});

		it("rejects non-function node types", () => {
			expect.assertions(1);

			const program = parse("const value = 1;");
			const declaration = getStatement(program, 0);

			expect(isFunctionLikeNode(declaration)).toBe(false);
		});
	});

	describe("isLikelyReactComponentName", () => {
		it("accepts PascalCase names with lowercase characters", () => {
			expect.assertions(1);

			expect(isLikelyReactComponentName("UserCard")).toBe(true);
		});

		it("rejects empty, lowercase, all-caps, and underscored names", () => {
			expect.assertions(4);

			expect(isLikelyReactComponentName("")).toBe(false);
			expect(isLikelyReactComponentName("userCard")).toBe(false);
			expect(isLikelyReactComponentName("USER")).toBe(false);
			expect(isLikelyReactComponentName("User_Card")).toBe(false);
		});
	});

	describe("isReactComponentFunction", () => {
		it("rejects primitive return types", () => {
			expect.assertions(1);

			const { checker, type } = getFunctionType("function Component(): string { return ''; }", "Component");

			expect(isReactComponentFunction(checker, type)).toBe(false);
		});

		it("accepts React-like element return types", () => {
			expect.assertions(1);

			const { checker, type } = getFunctionType(
				"interface ReactElement {} function Component(): ReactElement { return {}; }",
				"Component",
			);

			expect(isReactComponentFunction(checker, type)).toBe(true);
		});

		it("accepts return types named Element", () => {
			expect.assertions(1);

			const { checker, type } = getFunctionType(
				"interface Element {} function Component(): Element { return {}; }",
				"Component",
			);

			expect(isReactComponentFunction(checker, type)).toBe(true);
		});

		it("accepts aliased return types named Element", () => {
			expect.assertions(1);

			const { checker, type } = getFunctionType(
				"type Element = {}; function Component(): Element { return {}; }",
				"Component",
			);

			expect(isReactComponentFunction(checker, type)).toBe(true);
		});

		it("accepts return types named ReactChild", () => {
			expect.assertions(1);

			const { checker, type } = getFunctionType(
				"interface ReactChild {} function Component(): ReactChild { return {}; }",
				"Component",
			);

			expect(isReactComponentFunction(checker, type)).toBe(true);
		});

		it("accepts element-like symbols when the checker prints an alias", () => {
			expect.assertions(1);

			const { checker, type } = getFunctionType(
				"interface CustomElement {} function Component(): CustomElement { return {}; }",
				"Component",
			);
			const typeToString = vi.spyOn(checker, "typeToString").mockReturnValue("View");

			try {
				expect(isReactComponentFunction(checker, type)).toBe(true);
			} finally {
				typeToString.mockRestore();
			}
		});

		it("accepts values without call signatures", () => {
			expect.assertions(1);

			const { checker, type } = getVariableType("const Component = 1;", "Component");

			expect(isReactComponentFunction(checker, type)).toBe(true);
		});

		it("rejects unions of primitive return types", () => {
			expect.assertions(1);

			const { checker, type } = getFunctionType(
				"function Component(): string | number { return Math.random() > 0.5 ? '' : 1; }",
				"Component",
			);

			expect(isReactComponentFunction(checker, type)).toBe(false);
		});

		it("accepts null return types", () => {
			expect.assertions(1);

			const { checker, type } = getFunctionType("function Component(): null { return null; }", "Component");

			expect(isReactComponentFunction(checker, type)).toBe(true);
		});

		it("rejects named non-element object return types", () => {
			expect.assertions(1);

			const { checker, type } = getFunctionType(
				"interface Model { value: string } function Component(): Model { return { value: '' }; }",
				"Component",
			);

			expect(isReactComponentFunction(checker, type)).toBe(false);
		});

		it("rejects anonymous object return types", () => {
			expect.assertions(1);

			const { checker, type } = getFunctionType(
				"function Component(): { value: string } { return { value: '' }; }",
				"Component",
			);

			expect(isReactComponentFunction(checker, type)).toBe(false);
		});
	});
});
