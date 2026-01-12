import { regex } from "arkregex";
import { createRule } from "../utilities/create-rule";

type MessageIds = "namingConvention";

export interface NamingConventionOptions {
	readonly custom?: {
		readonly match?: boolean;
		readonly regex?: string;
	};
	readonly format?: ReadonlyArray<string>;
	readonly selector?: string;
}

type Options = [NamingConventionOptions?];

const regexCache = new Map<string, RegExp>();

function compileRegex(pattern: string): RegExp {
	const cached = regexCache.get(pattern);
	if (cached !== undefined) return cached;

	const compiled = new RegExp(pattern, "u");
	regexCache.set(pattern, compiled);
	return compiled;
}

const PASCAL_CASE_REGEXP = regex("^[A-Z][a-zA-Z0-9]*$");

function isPascalCase(value: string): boolean {
	return PASCAL_CASE_REGEXP.test(value);
}

function matchesFormat(value: string, formats: ReadonlyArray<string>): boolean {
	for (const format of formats) {
		switch (format) {
			case "PascalCase":
				if (isPascalCase(value)) return true;
				break;

			default:
				break;
		}
	}
	return false;
}

function matchesCustomRegex(value: string, custom: NamingConventionOptions["custom"]): boolean {
	if (custom === undefined || custom.regex === undefined) return true;

	const regex = compileRegex(custom.regex);
	const matches = regex.test(value);

	return custom.match === false ? !matches : matches;
}

export default createRule<Options, MessageIds>({
	create(context) {
		const [{ custom, format = ["PascalCase"], selector = "interface" } = {}] = context.options;

		return {
			TSInterfaceDeclaration(node): void {
				if (selector !== "interface") return;

				const interfaceName = node.id.name;

				if (format.length > 0 && !matchesFormat(interfaceName, format)) {
					context.report({
						data: {
							name: interfaceName,
							selector: "interface",
						},
						messageId: "namingConvention",
						node: node.id,
					});
					return;
				}

				if (!matchesCustomRegex(interfaceName, custom)) {
					context.report({
						data: {
							name: interfaceName,
							selector: "interface",
						},
						messageId: "namingConvention",
						node: node.id,
					});
				}
			},
		};
	},
	defaultOptions: [{}],
	meta: {
		docs: {
			description: "Enforce naming conventions",
		},
		messages: {
			namingConvention: "{{selector}} '{{name}}' must match the required naming convention.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					custom: {
						additionalProperties: false,
						properties: {
							match: {
								type: "boolean",
							},
							regex: {
								type: "string",
							},
						},
						type: "object",
					},
					format: {
						items: {
							type: "string",
						},
						type: "array",
					},
					selector: {
						type: "string",
					},
				},
				type: "object",
			},
		],
		type: "suggestion",
	},
	name: "naming-convention",
});
