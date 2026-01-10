import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES, ESLintUtils } from "@typescript-eslint/utils";
import { isUnionType, unionConstituents } from "ts-api-utils";
import type { Expression, Type, TypeChecker } from "typescript";
import { createRule } from "../utilities/create-rule";

type MessageIds = "preferEnumItem";

function isJSXAttributeValue(node: TSESTree.Literal): boolean {
	const { parent } = node;
	return parent !== undefined && parent.type === AST_NODE_TYPES.JSXAttribute && parent.value === node;
}

function canHaveContextualEnumType(node: TSESTree.Literal): boolean {
	const { parent } = node;
	if (parent === undefined) return false;

	switch (parent.type) {
		case AST_NODE_TYPES.CallExpression:
		case AST_NODE_TYPES.NewExpression:
			return parent.arguments.includes(node);

		case AST_NODE_TYPES.Property:
			return parent.value === node;

		case AST_NODE_TYPES.JSXAttribute:
			return parent.value === node;

		case AST_NODE_TYPES.VariableDeclarator: {
			if (parent.init !== node) return false;
			const { id } = parent;
			return id.type === AST_NODE_TYPES.Identifier && id.typeAnnotation !== undefined;
		}

		default:
			return false;
	}
}

interface EnumMatch {
	readonly enumPath: string;
}

export interface PreferEnumItemOptions {
	readonly fixNumericToValue?: boolean;
}

type Options = [PreferEnumItemOptions?];

const ENUM_PREFIX = "Enum.";

function getFullEnumPath(checker: TypeChecker, type: Type): string | undefined {
	const symbol = type.getSymbol();
	if (symbol === undefined) return undefined;

	const fullName = checker.getFullyQualifiedName(symbol);
	if (!fullName.startsWith(ENUM_PREFIX)) return undefined;

	return fullName;
}

function getPropertyLiteralType(
	checker: TypeChecker,
	type: Type,
	propertyName: "Name" | "Value",
): string | number | undefined {
	const property = type.getProperty(propertyName);
	if (property === undefined) return undefined;

	const propertyType = checker.getTypeOfSymbol(property);
	if (propertyType.isStringLiteral()) return propertyType.value;
	if (propertyType.isNumberLiteral()) return propertyType.value;

	return undefined;
}

function getUnionTypes(type: Type): ReadonlyArray<Type> {
	if (isUnionType(type)) return unionConstituents(type);
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

		function getContextualType(node: TSESTree.Node): Type | undefined {
			const tsNode = services.esTreeNodeToTSNodeMap.get(node);
			return checker.getContextualType(tsNode as Expression);
		}

		function findEnumMatch(contextualType: Type, literalValue: string | number): EnumMatch | undefined {
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

				if (!canHaveContextualEnumType(node)) return;

				const contextualType = getContextualType(node);
				if (contextualType === undefined) return;

				const match = findEnumMatch(contextualType, value);
				if (match === undefined) return;

				const isString = typeof value === "string";
				const displayValue = isString ? `"${value}"` : String(value);
				const fixPath = fixNumericToValue && !isString ? `${match.enumPath}.Value` : match.enumPath;

				const needsJSXBraces = isJSXAttributeValue(node);
				const fixText = needsJSXBraces ? `{${fixPath}}` : fixPath;

				context.report({
					data: {
						enumType: match.enumPath.split(".").slice(0, -1).join("."),
						expected: fixPath,
						value: displayValue,
					},
					fix(fixer) {
						return fixer.replaceText(node, fixText);
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
