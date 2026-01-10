import type { TSESTree } from "@typescript-eslint/utils";
import { ESLintUtils } from "@typescript-eslint/utils";

import type ts from "typescript";

import { createRule } from "../utilities/create-rule";

type MessageIds = "preferEnumItem" | "preferEnumItemNumber";

export interface PreferEnumItemOptions {
	readonly fixNumericToValue?: boolean;
}

type Options = [PreferEnumItemOptions?];

function getUnionTypes(type: ts.Type): ReadonlyArray<ts.Type> {
	if (type.isUnion()) return type.types;
	return [type];
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

		return {
			Literal(node): void {
				const { value } = node;
				if (typeof value !== "string" && typeof value !== "number") return;

				const contextualType = getContextualType(node);
				if (contextualType === undefined) return;

				// Find enum match in contextual type (implementation pending)
				const unionTypes = getUnionTypes(contextualType);
				void unionTypes;
				void fixNumericToValue;
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
			preferEnumItemNumber:
				"Use an `{{ enumType }}` member instead of `{{ value }}`. Check the enum definition for the correct member.",
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
