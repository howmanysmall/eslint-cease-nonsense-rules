import { resolve } from "node:path";

import { file } from "./node-file";

export async function getConfigurationPathAsync(directory: string): Promise<string | undefined> {
	const typescriptPath = resolve(directory, "eslint.config.ts");
	if (await file(typescriptPath).exists()) return typescriptPath;

	const javascriptPath = resolve(directory, "eslint.config.js");
	if (await file(javascriptPath).exists()) return javascriptPath;

	return undefined;
}
