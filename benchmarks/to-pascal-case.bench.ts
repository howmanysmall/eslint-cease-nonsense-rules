// oxlint-disable no-non-null-assertion
// oxlint-disable prefer-code-point
// oxlint-disable prefer-string-raw
import { regex } from "arkregex";
import { barplot, bench, do_not_optimize, run } from "mitata";
import { toPascalCase } from "../src/utilities/casing-utilities";

const RUNS = 1000;
const values = [
	"MostRecent",
	"LeastRecent",
	"Newest",
	"Oldest",
	"mostRecent",
	"leastRecent",
	"newest",
	"oldest",
	"most_recent",
	"least_recent",
];

const SPLIT_MARKER = "\0";
const SPLIT_REPLACE_VALUE = `$1${SPLIT_MARKER}$2`;

const SPLIT_LOWER_TO_UPPER_ASCII = /([a-z\d])([A-Z])/g;
const SPLIT_UPPER_TO_UPPER_ASCII = /([A-Z])([A-Z][a-z])/g;

const SPLIT_LOWER_TO_UPPER_UNICODE = regex("([\\p{Ll}\\d])(\\p{Lu})", "gu");
const SPLIT_UPPER_TO_UPPER_UNICODE = regex("(\\p{Lu})([\\p{Lu}][\\p{Ll}])", "gu");

function toPascalCaseTurbo(value: string): string {
	const trimmed = value.trim();
	if (trimmed.length === 0) return "";

	// Check for non-ASCII (rare for identifiers)
	let ascii = true;
	for (let index = 0; index < trimmed.length; index++) {
		if (trimmed.charCodeAt(index) > 127) {
			ascii = false;
			break;
		}
	}

	const marked = ascii
		? trimmed
				.replace(SPLIT_LOWER_TO_UPPER_ASCII, SPLIT_REPLACE_VALUE)
				.replace(SPLIT_UPPER_TO_UPPER_ASCII, SPLIT_REPLACE_VALUE)
		: trimmed
				.replace(SPLIT_LOWER_TO_UPPER_UNICODE, SPLIT_REPLACE_VALUE)
				.replace(SPLIT_UPPER_TO_UPPER_UNICODE, SPLIT_REPLACE_VALUE);

	let result = "";
	let wordStart = 0;

	for (let index = 0; index <= marked.length; index++) {
		if (index === marked.length || marked.charCodeAt(index) === 0) {
			if (index > wordStart) {
				const firstCode = marked.charCodeAt(wordStart);

				// Prefix underscore if word starts with digit and not first word
				if (result.length > 0 && firstCode >= 48 && firstCode <= 57) {
					result += "_";
				}

				result += marked[wordStart].toUpperCase();
				if (index > wordStart + 1) {
					result += marked.slice(wordStart + 1, index).toLowerCase();
				}
			}
			wordStart = index + 1;
		}
	}

	return result;
}

barplot(() => {
	bench("turbo", () => {
		for (let index = 0; index < RUNS; index += 1) {
			do_not_optimize(values.map((value) => toPascalCaseTurbo(value)));
		}
	});
	bench("classic", () => {
		for (let index = 0; index < RUNS; index += 1) {
			do_not_optimize(values.map((value) => toPascalCase(value)));
		}
	});
});

await run({});
