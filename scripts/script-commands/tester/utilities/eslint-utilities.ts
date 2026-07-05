import { access } from "node:fs/promises";
import nodePath from "node:path";

async function fileExistsAsync(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

export async function getConfigurationPathAsync(directory: string): Promise<string | undefined> {
	const typescriptPath = nodePath.resolve(directory, "eslint.config.ts");
	if (await fileExistsAsync(typescriptPath)) return typescriptPath;

	const javascriptPath = nodePath.resolve(directory, "eslint.config.js");
	if (await fileExistsAsync(javascriptPath)) return javascriptPath;

	return undefined;
}
