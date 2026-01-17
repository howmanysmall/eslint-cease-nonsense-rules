import { stat } from "node:fs/promises";

interface NotDirectoryError extends Error {
	code: "ENOENT" | "ENOTDIR";
}
function isNotDirectoryError(error: unknown): error is NotDirectoryError {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		typeof error.code === "string" &&
		(error.code === "ENOENT" || error.code === "ENOTDIR")
	);
}

export async function isDirectoryAsync(path: string): Promise<boolean> {
	try {
		const stats = await stat(path);
		return stats.isDirectory();
	} catch (error) {
		if (isNotDirectoryError(error)) return false;
		throw error;
	}
}

export async function isDirectorySimpleAsync(path: string): Promise<boolean> {
	try {
		const stats = await stat(path);
		return stats.isDirectory();
	} catch {
		return false;
	}
}
