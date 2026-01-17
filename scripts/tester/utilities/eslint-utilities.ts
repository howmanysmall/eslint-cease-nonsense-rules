import { resolve } from "node:path";

export async function getConfigurationPathAsync(directory: string): Promise<string | undefined> {
	const typescriptPath = resolve(directory, "eslint.config.ts");
	if (await Bun.file(typescriptPath).exists()) return typescriptPath;

	const javascriptPath = resolve(directory, "eslint.config.js");
	if (await Bun.file(javascriptPath).exists()) return javascriptPath;

	return undefined;
}
