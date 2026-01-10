import type { TSESTree } from "@typescript-eslint/utils";
import { ESLintUtils } from "@typescript-eslint/utils";

import type ts from "typescript";

import { createRule } from "../utilities/create-rule";

type MessageIds = "preferEnumItem";

interface EnumMatch {
	readonly enumPath: string;
}

export interface PreferEnumItemOptions {
	readonly fixNumericToValue?: boolean;
}

type Options = [PreferEnumItemOptions?];

const ENUM_PREFIX = "Enum.";

function getFullEnumPath(checker: ts.TypeChecker, type: ts.Type): string | undefined {
	const symbol = type.getSymbol();
	if (symbol === undefined) return undefined;

	const fullName = checker.getFullyQualifiedName(symbol);
	if (!fullName.startsWith(ENUM_PREFIX)) return undefined;

	return fullName;
}

function getPropertyLiteralType(
	checker: ts.TypeChecker,
	type: ts.Type,
	propertyName: string,
): string | number | undefined {
	const property = type.getProperty(propertyName);
	if (property === undefined) return undefined;

	const propertyType = checker.getTypeOfSymbol(property);
	if (propertyType.isStringLiteral()) return propertyType.value;
	if (propertyType.isNumberLiteral()) return propertyType.value;

	return undefined;
}

function getUnionTypes(type: ts.Type): ReadonlyArray<ts.Type> {
	if (type.isUnion()) return type.types;
	return [type];
}

function createEnumMatch(enumPath: string): EnumMatch {
	return { enumPath };
}

export default createRule<Options, MessageIds>({
	create(context) {
		const [{ fixNumericToValue = false } = {}] = context.options;
		const services = ESLintUtils.getParserServices(context);
		const checker = services.program.getTypeChecker();

		function getContextualType(node: TSESTree.Node): ts.Type | undefined {
			const tsNode = services.esTreeNodeToTSNodeMap.get(node);
			return checker.getContextualType(tsNode as ts.Expression);
		}

		function findEnumMatch(contextualType: ts.Type, literalValue: string | number): EnumMatch | undefined {
			const unionTypes = getUnionTypes(contextualType);

			for (const memberType of unionTypes) {
				const enumPath = getFullEnumPath(checker, memberType);
				if (enumPath === undefined) continue;

				if (typeof literalValue === "string") {
					const nameProperty = getPropertyLiteralType(checker, memberType, "Name");
					if (nameProperty === literalValue) return createEnumMatch(enumPath);
				} else {
					const valueProperty = getPropertyLiteralType(checker, memberType, "Value");
					if (valueProperty === literalValue) return createEnumMatch(enumPath);
				}
			}

			return undefined;
		}

		return {
			Literal(node): void {
				const { value } = node;
				if (typeof value !== "string" && typeof value !== "number") return;

				const contextualType = getContextualType(node);
				if (contextualType === undefined) return;

				const match = findEnumMatch(contextualType, value);
				if (match === undefined) return;

				const isString = typeof value === "string";
				const displayValue = isString ? `"${value}"` : String(value);
				const fixPath = fixNumericToValue && !isString ? `${match.enumPath}.Value` : match.enumPath;

				context.report({
					data: {
						enumType: match.enumPath.split(".").slice(0, -1).join("."),
						expected: fixPath,
						value: displayValue,
					},
					fix(fixer) {
						return fixer.replaceText(node, fixPath);
					},
					messageId: "preferEnumItem",
					node,
				});
			},
		};
	},
	defaultOptions: [{}],
	meta: {
		docs: {
			description: "Enforce using EnumItem values instead of string or number literals.",
		},
		fixable: "code",
		messages: {
			preferEnumItem:
				"Use `{{ expected }}` instead of `{{ value }}`. EnumItems provide type safety and avoid magic values.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					fixNumericToValue: {
						default: false,
						description: "When true, numeric literals fix to Enum.X.Y.Value instead of Enum.X.Y",
						type: "boolean",
					},
				},
				type: "object",
			},
		],
		type: "suggestion",
	},
	name: "prefer-enum-item",
});
