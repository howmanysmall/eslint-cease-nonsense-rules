#!/usr/bin/env bun

import { barplot, bench, run } from "mitata";

const MAX_LENGTH = 60;

function showInvisiblesBaseline(text: string): string {
	let result = text;
	if (result.length > MAX_LENGTH) result = `${result.slice(0, MAX_LENGTH)}…`;
	return result.replaceAll("\r", "␍").replaceAll("\n", "␊").replaceAll("\t", "→").replaceAll(" ", "·");
}
function showInvisibles1(text: string): string {
	let result = text;
	if (result.length > MAX_LENGTH) result = result.slice(0, MAX_LENGTH) + "…";

	let out = "";
	out += "\0"; // ensure fast path allocation (optional micro-optim)

	let i = 0;
	const len = result.length;
	for (; i < len; i++) {
		const c = result[i];
		switch (c) {
			case "\r":
				out += "␍";
				break;
			case "\n":
				out += "␊";
				break;
			case "\t":
				out += "→";
				break;
			case " ":
				out += "·";
				break;
			default:
				out += c;
		}
	}

	return out.slice(1); // remove prefix
}
function showInvisibles2(text: string): string {
	let result = text;

	const truncated = result.length > MAX_LENGTH;
	if (truncated) result = result.slice(0, MAX_LENGTH);

	let out = "";
	out += "\0";

	for (let i = 0, len = result.length; i < len; i++) {
		switch (result[i]) {
			case "\r":
				out += "␍";
				break;
			case "\n":
				out += "␊";
				break;
			case "\t":
				out += "→";
				break;
			case " ":
				out += "·";
				break;
			default:
				out += result[i];
		}
	}

	if (truncated) out += "…";

	return out.slice(1);
}
const MAP: Record<string, string> = {
	" ": "·",
	"\n": "␊",
	"\r": "␍",
	"\t": "→",
};
function showInvisibles3(text: string): string {
	let s = text;
	if (s.length > MAX_LENGTH) s = s.slice(0, MAX_LENGTH) + "…";

	let out = "";
	out += "\0";
	// biome-ignore lint/style/useForOf: shut up
	for (let i = 0; i < s.length; i++) {
		const c = s[i];
		out += MAP[c] ?? c;
	}
	return out.slice(1);
}

function showInvisibles4(text: string): string {
	const replacements: Record<string, string> = {
		" ": "·",
		"\n": "␊",
		"\r": "␍",
		"\t": "→",
	};

	const maxLength = Math.min(text.length, MAX_LENGTH);
	// oxlint-disable-next-line no-unsafe-assignment
	const result: Array<string> = new Array(maxLength + (text.length > MAX_LENGTH ? 1 : 0));

	for (let i = 0; i < maxLength; i++) {
		result[i] = replacements[text[i]] ?? text[i];
	}

	if (text.length > MAX_LENGTH) {
		result[maxLength] = "…";
	}

	return result.join("");
}
function showInvisibles5(text: string): string {
	const replacements: Record<string, string> = { " ": "·", "\n": "␊", "\r": "␍", "\t": "→" };

	return (
		// oxlint-disable-next-line prefer-spread
		text
			.slice(0, MAX_LENGTH)
			.split("")
			.map((c) => replacements[c] ?? c)
			.join("") + (text.length > MAX_LENGTH ? "…" : "")
	);
}

const CHAR_MAP: Record<string, string> = {
	" ": "·",
	"\n": "␊",
	"\r": "␍",
	"\t": "→",
};
const SUBSTITUTE_REGEXP = /[\r\n\t ]/;

function showInvisibles6(text: string): string {
	let result = text;
	if (result.length > MAX_LENGTH) result = result.slice(0, MAX_LENGTH) + "…";
	// Fast path: no substitutions needed
	if (!SUBSTITUTE_REGEXP.test(result)) return result;
	let out = "";
	// biome-ignore lint/style/useForOf: sybau
	for (let i = 0; i < result.length; ++i) {
		const ch = result[i];
		out += CHAR_MAP[ch] ?? ch;
	}
	return out;
}

const SYMBOLS: Record<string, string> = {
	" ": "·",
	"\n": "␊",
	"\r": "␍",
	"\t": "→",
};

function showInvisibles7(text: string): string {
	let result = text;
	if (result.length > MAX_LENGTH) result = `${result.slice(0, MAX_LENGTH)}…`;
	return result.replaceAll(/[\r\n\t ]/g, (ch) => SYMBOLS[ch]);
}
const WHITESPACE_REGEXP = /[\r\n\t ]/g;
function toSymbol(character: string): string {
	return SYMBOLS[character];
}
function showInvisibles8(text: string): string {
	let result = text;
	if (result.length > MAX_LENGTH) result = `${result.slice(0, MAX_LENGTH)}…`;
	return result.replaceAll(WHITESPACE_REGEXP, toSymbol);
}

const RUNS = 1000;

const baseContents = await Bun.file(".oxlintrc.json").text().then(String);
const withCrlf = baseContents.replaceAll("\n", "\r\n");
const withLf = baseContents.replaceAll("\r\n", "\n");

{
	const inputs = [baseContents, withCrlf, withLf] as const;

	type Fn = (s: string) => string;
	const implementations: ReadonlyArray<{ name: string; fn: Fn }> = [
		{ fn: showInvisibles1, name: "Version 1" },
		{ fn: showInvisibles2, name: "Version 2" },
		{ fn: showInvisibles3, name: "Version 3" },
		{ fn: showInvisibles4, name: "Version 4" },
		{ fn: showInvisibles5, name: "Version 5" },
		{ fn: showInvisibles6, name: "Version 6" },
		{ fn: showInvisibles7, name: "Version 7" },
		{ fn: showInvisibles8, name: "Version 8" },
	];

	for (const input of inputs) {
		const expected = showInvisiblesBaseline(input);
		for (const impl of implementations) {
			const actual = impl.fn(input);
			if (actual !== expected) {
				const preview = input.length > 64 ? `${input.slice(0, 64)}…` : input;
				throw new Error(
					`Output mismatch for "${impl.name}"\ninput preview: ${JSON.stringify(
						preview,
					)}\nexpected: ${JSON.stringify(expected)}\nactual: ${JSON.stringify(actual)}`,
				);
			}
		}
	}
}

barplot(() => {
	bench("Baseline", () => {
		for (let index = 0; index < RUNS; index += 1) {
			showInvisiblesBaseline(baseContents);
			showInvisiblesBaseline(withCrlf);
			showInvisiblesBaseline(withLf);
		}
	})
		.baseline()
		.highlight("cyan");

	bench("Version 1", () => {
		for (let index = 0; index < RUNS; index += 1) {
			showInvisibles1(baseContents);
			showInvisibles1(withCrlf);
			showInvisibles1(withLf);
		}
	});
	bench("Version 2", () => {
		for (let index = 0; index < RUNS; index += 1) {
			showInvisibles2(baseContents);
			showInvisibles2(withCrlf);
			showInvisibles2(withLf);
		}
	});
	bench("Version 3", () => {
		for (let index = 0; index < RUNS; index += 1) {
			showInvisibles3(baseContents);
			showInvisibles3(withCrlf);
			showInvisibles3(withLf);
		}
	});

	bench("Version 4", () => {
		for (let index = 0; index < RUNS; index += 1) {
			showInvisibles4(baseContents);
			showInvisibles4(withCrlf);
			showInvisibles4(withLf);
		}
	});
	bench("Version 5", () => {
		for (let index = 0; index < RUNS; index += 1) {
			showInvisibles5(baseContents);
			showInvisibles5(withCrlf);
			showInvisibles5(withLf);
		}
	});

	bench("Version 6", () => {
		for (let index = 0; index < RUNS; index += 1) {
			showInvisibles6(baseContents);
			showInvisibles6(withCrlf);
			showInvisibles6(withLf);
		}
	});

	bench("Version 7", () => {
		for (let index = 0; index < RUNS; index += 1) {
			showInvisibles7(baseContents);
			showInvisibles7(withCrlf);
			showInvisibles7(withLf);
		}
	});
	bench("Version 8", () => {
		for (let index = 0; index < RUNS; index += 1) {
			showInvisibles8(baseContents);
			showInvisibles8(withCrlf);
			showInvisibles8(withLf);
		}
	}).highlight("yellow");
});

await run({});
