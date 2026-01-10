import { createRule } from "../utilities/create-rule";

type MessageIds = "preferEnumItem" | "preferEnumItemNumber";

export interface PreferEnumItemOptions {
	readonly fixNumericToValue?: boolean;
}

type Options = [PreferEnumItemOptions?];

export default createRule<Options, MessageIds>({
	create(_context) {
		return {
			Literal(_node): void {
				// Stub - implementation pending
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
