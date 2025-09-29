import { describe, it, expect } from "bun:test";
import { RuleTester } from "eslint";
import parser from "@typescript-eslint/parser";
import rule from "../../src/rules/enforce-ianitor-check-type";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		sourceType: "module",
		parser,
		parserOptions: {
			ecmaFeatures: {
				jsx: true,
			},
		},
	},
});

describe("enforce-ianitor-check-type", () => {
	it("should pass valid cases", () => {
		expect(() => {
			ruleTester.run("enforce-ianitor-check-type", rule, {
				valid: [
					// Simple types (score < 10)
					{
						code: "type Simple = string;",
						languageOptions: {
							parser,
						},
					},
					{
						code: "type BasicObject = { id: string; name: string };",
						languageOptions: {
							parser,
						},
					},
					{
						code: "const isSimple = Ianitor.string;",
						languageOptions: {
							parser,
						},
					},
					// Has annotation
					{
						code: "const isTyped: Ianitor.Check<SomeType> = Ianitor.interface({ name: Ianitor.string });",
						languageOptions: {
							parser,
						},
					},
					// Simple validator that should pass
					{
						code: "const validator = Ianitor.strictInterface({ name: Ianitor.string });",
						options: [{ baseThreshold: 20 }], // Increase threshold to make this pass
						languageOptions: {
							parser,
						},
					},
				],
				invalid: [
					// Complex Ianitor validator without type annotation
					{
						code: `
							const isUser = Ianitor.strictInterface({
								name: Ianitor.string,
								age: Ianitor.number,
								profile: Ianitor.interface({
									email: Ianitor.string,
									settings: Ianitor.record(Ianitor.string, Ianitor.unknown)
								})
							});
						`,
						languageOptions: {
							parser,
						},
						errors: 1,
					},
				],
			});
		}).not.toThrow();
	});
});
