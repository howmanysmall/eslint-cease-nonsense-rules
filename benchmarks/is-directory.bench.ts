#!/usr/bin/env bun

import { access, constants, lstat, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { barplot, bench, run, summary } from "mitata";

interface EnoentError extends Error {
	code: "ENOENT";
}
function isEnoentError(error: unknown): error is EnoentError {
	return error instanceof Error && "code" in error && typeof error.code === "string" && error.code === "ENOENT";
}
interface NotADirectoryError extends Error {
	code: "ENOTDIR";
}
type NotDirectoryError = EnoentError | NotADirectoryError;
function isNotDirectoryError(error: unknown): error is NotDirectoryError {
	return (
		error instanceof Error &&
		"code" in error &&
		typeof error.code === "string" &&
		(error.code === "ENOENT" || error.code === "ENOTDIR")
	);
}

async function isDirectoryStatAsync(path: string): Promise<boolean> {
	try {
		const stats = await stat(path);
		return stats.isDirectory();
	} catch (error) {
		if (isNotDirectoryError(error)) return false;
		throw error;
	}
}

async function isDirectoryLinkStatAsync(path: string): Promise<boolean> {
	try {
		const stats = await lstat(path);
		return stats.isDirectory();
	} catch (error) {
		if (isNotDirectoryError(error)) return false;
		throw error;
	}
}

async function isDirectoryAccessAsync(path: string): Promise<boolean> {
	try {
		await access(path, constants.F_OK);
		return true;
	} catch (error: unknown) {
		if (isEnoentError(error)) return false;
		throw error;
	}
}
async function isDirectoryReadAsync(path: string): Promise<boolean> {
	try {
		await readdir(path);
		return true;
	} catch (error) {
		if (!error) throw error;
		if (isNotDirectoryError(error)) return false;
		throw error;
	}
}

const PATH_A = resolve(".", "benchmarks");
const PATH_B = resolve("..", "bffudjhfdhjs");

barplot(() => {
	summary(() => {
		bench("access", async () => {
			await Promise.all([isDirectoryAccessAsync(PATH_A), isDirectoryAccessAsync(PATH_B)]);
		});
		bench("stat", async () => {
			await Promise.all([isDirectoryStatAsync(PATH_A), isDirectoryStatAsync(PATH_B)]);
		});
		bench("lstat", async () => {
			await Promise.all([isDirectoryLinkStatAsync(PATH_A), isDirectoryLinkStatAsync(PATH_B)]);
		});
		bench("readdir", async () => {
			await Promise.all([isDirectoryReadAsync(PATH_A), isDirectoryReadAsync(PATH_B)]);
		});
	});
});

await run({});
