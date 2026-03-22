#!/usr/bin/env bun

import { readdir, stat } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { argv, exit } from "node:process";
import { barplot, bench, run } from "mitata";

const [directory] = argv.slice(2);
if (!directory) {
	console.error("Please provide a directory path.");
	exit(1);
}

async function getDirectoryPathAsync(path: string): Promise<string | undefined> {
	try {
		const resolved = resolve(path);
		const stats = await stat(resolved);
		return stats.isDirectory() ? resolved : undefined;
	} catch {
		return undefined;
	}
}

const directoryPath = await getDirectoryPathAsync(directory);
if (directoryPath === undefined) {
	console.error("The provided path is not a directory.");
	exit(1);
}

const sourceDirectoryPath = await getDirectoryPathAsync(resolve(directoryPath, "src"));
if (sourceDirectoryPath === undefined) {
	console.error("The 'src' directory does not exist.");
	exit(1);
}

const descendants = await readdir(sourceDirectoryPath, { recursive: true, withFileTypes: true });
const files = descendants
	.filter((entry) => entry.isFile() && entry.name !== ".DS_Store")
	.map((entry) => resolve(sourceDirectoryPath, entry.name));

const VALID_EXTS = new Set([".tsx", ".ts", ".jsx", ".js", ".mts", ".mjs", ".cts", ".cjs"]);

function getExtensionExtName(filePath: string): string | undefined {
	const extension = extname(filePath);
	return VALID_EXTS.has(extension) ? extension : undefined;
}

function getExtension(filePath: string): string | undefined {
	if (filePath.endsWith(".tsx")) return ".tsx";
	if (filePath.endsWith(".ts")) return ".ts";
	if (filePath.endsWith(".jsx")) return ".jsx";
	if (filePath.endsWith(".js")) return ".js";
	if (filePath.endsWith(".mts")) return ".mts";
	if (filePath.endsWith(".mjs")) return ".mjs";
	if (filePath.endsWith(".cts")) return ".cts";
	if (filePath.endsWith(".cjs")) return ".cjs";
	return undefined;
}

function getExtensionBranching(filePath: string): string | undefined {
	const len = filePath.length;
	if (len < 3) return undefined;

	const last = filePath.charCodeAt(len - 1);

	if (last === 120) {
		if (filePath.endsWith(".tsx")) return ".tsx";
		if (filePath.endsWith(".jsx")) return ".jsx";
		return undefined;
	}

	if (last === 115) {
		if (filePath.endsWith(".ts")) return ".ts";
		if (filePath.endsWith(".js")) return ".js";
		if (filePath.endsWith(".mts")) return ".mts";
		if (filePath.endsWith(".mjs")) return ".mjs";
		if (filePath.endsWith(".cts")) return ".cts";
		if (filePath.endsWith(".cjs")) return ".cjs";
	}

	return undefined;
}

function getExtensionMicro(filePath: string): string | undefined {
	const len = filePath.length;

	// .ts, .js (3 chars)
	if (len >= 3 && filePath.charCodeAt(len - 3) === 46) {
		const c1 = filePath.charCodeAt(len - 2);
		const c2 = filePath.charCodeAt(len - 1);
		if (c1 === 116 && c2 === 115) return ".ts";
		if (c1 === 106 && c2 === 115) return ".js";
	}

	// .tsx, .jsx, .mts, .mjs, .cts, .cjs (4 chars)
	if (len >= 4 && filePath.charCodeAt(len - 4) === 46) {
		const c1 = filePath.charCodeAt(len - 3);
		const c2 = filePath.charCodeAt(len - 2);
		const c3 = filePath.charCodeAt(len - 1);
		if (c1 === 116 && c2 === 115 && c3 === 120) return ".tsx";
		if (c1 === 106 && c2 === 115 && c3 === 120) return ".jsx";
		if (c2 === 116 && c3 === 115) {
			// ?ts
			if (c1 === 109) return ".mts";
			if (c1 === 99) return ".cts";
		}
		if (c2 === 106 && c3 === 115) {
			// ?js
			if (c1 === 109) return ".mjs";
			if (c1 === 99) return ".cjs";
		}
	}

	return undefined;
}

function getExtensionFunny(filePath: string): string | undefined {
	const len = filePath.length;

	// Check for .ts or .js (3-char extensions) — most common case
	if (len >= 3 && filePath.charCodeAt(len - 3) === 0x2e) {
		const c1 = filePath.charCodeAt(len - 2);
		const c2 = filePath.charCodeAt(len - 1);
		if (c1 === 0x74 && c2 === 0x73) return ".ts";
		if (c1 === 0x6a && c2 === 0x73) return ".js";
	}

	// Check for 4-char extensions: .tsx, .jsx, .mts, .mjs, .cts, .cjs
	if (len >= 4 && filePath.charCodeAt(len - 4) === 0x2e) {
		const c1 = filePath.charCodeAt(len - 3);
		const c2 = filePath.charCodeAt(len - 2);
		const c3 = filePath.charCodeAt(len - 1);

		if (c3 === 0x78) {
			if (c1 === 0x74 && c2 === 0x73) return ".tsx";
			if (c1 === 0x6a && c2 === 0x73) return ".jsx";
		} else if (c3 === 0x73) {
			if (c2 === 0x74) {
				if (c1 === 0x6d) return ".mts";
				if (c1 === 0x63) return ".cts";
			} else if (c2 === 0x6a) {
				if (c1 === 0x6d) return ".mjs";
				if (c1 === 0x63) return ".cjs";
			}
		}
	}

	return undefined;
}

barplot(() => {
	bench("getExtension", () => {
		files.map((file) => getExtension(file));
	}).baseline(true);
	bench("getExtensionExtName", () => {
		files.map((file) => getExtensionExtName(file));
	});
	bench("getExtensionBranching", () => {
		files.map((file) => getExtensionBranching(file));
	});
	bench("getExtensionMicro", () => {
		files.map((file) => getExtensionMicro(file));
	});
	bench("getExtensionFunny", () => {
		files.map((file) => getExtensionFunny(file));
	});
});

await run({});
