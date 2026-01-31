// oxlint-disable prefer-string-raw
import type { TSESTree } from "@typescript-eslint/utils";
import { regex } from "arktype";
import { createRule } from "../utilities/create-rule";

// Irregular plurals, using lowercase for matching against tokens
const IRREGULAR_PLURALS = new Set<string>([
	"children",
	"dice",
	"feet",
	"geese",
	"men",
	"mice",
	"people",
	"teeth",
	"women",
	// Latin/Greek plurals commonly seen in programming nomenclature
	"criteria",
	"data",
	"media",
	"phenomena",
	"indices",
	"matrices",
	"vertices",
	"axes",
	"alumni",
	"cacti",
	"fungi",
	"octopi",
]);

const SINGULAR_EXCEPTIONS = new Set<string>([
	"news",
	"status",
	"alias",
	"analysis",
	"basis",
	"thesis",
	"crisis",
	"axis",
	"class",
	"glass",
	"series",
	"species",
	"business",
]);

// Common programming plurals we want to catch aggressively
const PROGRAMMING_PLURALS = new Set<string>([
	"args",
	"params",
	"parameters",
	"options",
	"settings",
	"props",
	"components",
	"hooks",
	"types",
	"enums",
	"services",
	"controllers",
	"models",
	"repositories",
	"dto",
	"dtos",
	"vo",
	"vos",
	"keys",
	"values",
	"entries",
	"items",
	"orders",
	"pages",
]);

const SINGULAR_ENUM_REGEX = regex("[A-Z]+(?![a-z])|[A-Z]?[a-z]+|\\d+", "g");

function tokenizeIdentifier(name: string): ReadonlyArray<string> {
	const parts = name.split("_");
	const tokens = new Array<string>();
	for (const part of parts) {
		const matches = part.match(SINGULAR_ENUM_REGEX);
		if (matches) tokens.push(...matches);
	}
	return tokens;
}

const INTEGER_REGEXP = regex("^\\d+$");

interface AlphaToken {
	readonly original: string;
	readonly lower: string;
}

function getLastAlphaToken(name: string): AlphaToken | undefined {
	const tokens = tokenizeIdentifier(name);
	let alphaToken: AlphaToken | undefined;
	for (let index = tokens.length - 1; index >= 0; index -= 1) {
		const token = tokens[index];
		if (token === undefined || INTEGER_REGEXP.test(token)) continue;
		alphaToken = { lower: token.toLowerCase(), original: token };
		break;
	}
	return alphaToken;
}

const ACRONYM_REGEXP = regex("^[A-Z]{2,}[sS]$");
function isAcronymPlural(original: string): boolean {
	return ACRONYM_REGEXP.test(original);
}

const ES_VOWELS_REGEXP = regex("((ch|sh|x|z|ss|o)es|xes|zes|ches|shes|sses|oes)$");
function isPluralWord(lower: string, original: string): boolean {
	if (IRREGULAR_PLURALS.has(lower) || PROGRAMMING_PLURALS.has(lower)) return true;
	if (SINGULAR_EXCEPTIONS.has(lower)) return false;

	if (
		isAcronymPlural(original) ||
		lower.endsWith("ies") ||
		lower.endsWith("ves") ||
		ES_VOWELS_REGEXP.test(lower) ||
		lower.endsWith("es")
	) {
		return true;
	}

	if (lower.endsWith("s")) return !(lower.endsWith("ss") || lower.endsWith("us") || lower.endsWith("is"));
	return false;
}

function isPlural(name: string): boolean {
	if (ACRONYM_REGEXP.test(name)) return true;
	const last = getLastAlphaToken(name);
	return last ? isPluralWord(last.lower, last.original) : false;
}

export default createRule({
	create(context) {
		return {
			TSEnumDeclaration(node: TSESTree.TSEnumDeclaration): void {
				const { name } = node.id;
				if (!isPlural(name)) return;
				context.report({
					data: { name },
					messageId: "notSingular",
					node,
				});
			},
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description: "Prefer singular TypeScript enums.",
		},
		messages: {
			notSingular:
				"Enum '{{ name }}' uses plural naming. Enums define a type of which only ONE value is selected at a time, so singular naming is semantically correct. Use 'Status' not 'Statuses', 'Color' not 'Colors'. Rename the enum to its singular form.",
		},
		schema: [],
		type: "suggestion",
	},
	name: "prefer-singular-enums",
});
