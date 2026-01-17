import { resolve } from "node:path";
import { type } from "arktype";
import type { ValidRules } from "../commands/formatters/types";
import { isValidRules } from "../commands/formatters/types";

function stringifyUnknownError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export async function getConfigurationPathAsync(directory: string): Promise<string | undefined> {
	const typescriptPath = resolve(directory, "eslint.config.ts");
	if (await Bun.file(typescriptPath).exists()) return typescriptPath;

	const javascriptPath = resolve(directory, "eslint.config.js");
	if (await Bun.file(javascriptPath).exists()) return javascriptPath;

	return undefined;
}

async function getConfigurationStringAsync(configurationPath: string, cwd: string, directory: string): Promise<string> {
	try {
		process.chdir(directory);
		const text = await Bun.$`bun x --bun eslint --print-config ${configurationPath}`.quiet().text();
		process.chdir(cwd);

		return text;
	} catch (error) {
		throw new Error(`Failed to load ESLint configuration: ${stringifyUnknownError(error)}`, { cause: error });
	} finally {
		process.chdir(cwd);
	}
}

export async function getConfigurationAsync(cwd: string, directory: string): Promise<ValidRules> {
	const configurationPath = await getConfigurationPathAsync(directory);
	if (configurationPath === undefined) throw new Error("No ESLint configuration found.");

	const text = await getConfigurationStringAsync(configurationPath, cwd, directory);

	const json = isValidRules(JSON.parse(text));
	if (json instanceof type.errors) throw new TypeError(`The ESLint configuration is invalid: ${json.summary}`);

	return json;
}
