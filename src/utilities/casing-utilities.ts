// oxlint-disable prefer-string-raw
import { regex } from "arkregex";

const SPLIT_LOWER_TO_UPPER = regex("([\\p{Ll}\\d])(\\p{Lu})", "gu");
const SPLIT_UPPER_TO_UPPER = regex("(\\p{Lu})([\\p{Lu}][\\p{Ll}])", "gu");
const NULL_MARKER = regex("\0", "g");
const SPLIT_REPLACE_VALUE = "$1\0$2";

const DEFAULT_PREFIX_SUFFIX_CHARACTERS = "";

function split(value: string): ReadonlyArray<string> {
	const result = value
		.trim()
		.replace(SPLIT_LOWER_TO_UPPER, SPLIT_REPLACE_VALUE)
		.replace(SPLIT_UPPER_TO_UPPER, SPLIT_REPLACE_VALUE);

	let startIndex = 0;
	let finishIndex = result.length;

	while (result.charAt(startIndex) === "\0") startIndex += 1;
	if (startIndex === finishIndex) return [];

	while (result.charAt(finishIndex - 1) === "\0") finishIndex -= 1;
	return result.slice(startIndex, finishIndex).split(NULL_MARKER);
}
function splitPrefixSuffix(value: string): readonly [prefix: string, words: ReadonlyArray<string>, suffix: string] {
	let prefixIndex = 0;
	while (prefixIndex < value.length) {
		const character = value.charAt(prefixIndex);
		if (!DEFAULT_PREFIX_SUFFIX_CHARACTERS.includes(character)) break;
		prefixIndex += 1;
	}

	let suffixIndex = value.length;
	while (suffixIndex > prefixIndex) {
		const index = suffixIndex - 1;
		const character = value.charAt(index);
		if (!DEFAULT_PREFIX_SUFFIX_CHARACTERS.includes(character)) break;
		suffixIndex = index;
	}

	return [value.slice(0, prefixIndex), split(value.slice(prefixIndex, suffixIndex)), value.slice(suffixIndex)];
}

function pascalCaseTransform(word: string, index: number): string {
	const [first = "\0"] = word;
	const initial = index > 0 && first >= "0" && first <= "9" ? `_${first}` : first.toUpperCase();
	return initial + word.slice(1).toLowerCase();
}

export function toPascalCase(value: string): string {
	const [prefix, words, suffix] = splitPrefixSuffix(value);
	// oxlint-disable-next-line no-array-callback-reference
	return prefix + words.map(pascalCaseTransform).join("") + suffix;
}
