import { access } from "node:fs/promises";
import { resolve } from "node:path";

async function fileExistsAsync(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

export async function getConfigurationPathAsync(directory: string): Promise<string | undefined> {
	const typescriptPath = resolve(directory, "eslint.config.ts");
	if (await fileExistsAsync(typescriptPath)) return typescriptPath;

	const javascriptPath = resolve(directory, "eslint.config.js");
	if (await fileExistsAsync(javascriptPath)) return javascriptPath;

	return undefined;
}
