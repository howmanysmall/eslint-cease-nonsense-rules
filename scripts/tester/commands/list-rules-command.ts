import { resolve } from "node:path";
import { cwd, exit } from "node:process";
import { Command } from "@jsr/cliffy__command";
import { type } from "arktype";
import { consola } from "consola";
import picocolors from "picocolors";
import { getConfigurationPathAsync } from "../utilities/eslint-utilities";
import { isDirectorySimpleAsync } from "../utilities/fs-utilities";
import { isValidRules } from "./formatters/types";

const CURRENT_WORKING_DIRECTORY = cwd();

const getRulesCommand = new Command()
	.name("list-rules")
	.description("List all available ESLint rules from the live environment.")
	.version("1.0.0")
	.arguments("<directory:string>")
	.action(async (_, directoryUnresolved) => {
		const directory = resolve(directoryUnresolved);
		const isDirectoryReal = await isDirectorySimpleAsync(directory);
		if (!isDirectoryReal) {
			consola.fail("The specified directory does not exist.");
			exit(1);
		}

		const configurationPath = await getConfigurationPathAsync(directory);
		if (configurationPath === undefined) {
			consola.fail("No ESLint configuration found in the specified directory.");
			exit(1);
		}

		consola.verbose("Loading ESLint configuration...");

		process.chdir(directory);
		const text = await Bun.$`bun x --bun eslint --print-config ${configurationPath}`.quiet().text();
		process.chdir(CURRENT_WORKING_DIRECTORY);

		const json = isValidRules(JSON.parse(text));
		if (json instanceof type.errors) {
			consola.fail(`The ESLint configuration is invalid: ${json.summary}`);
			exit(1);
		}

		const { rules } = json;
		const enabledRules = Object.entries(rules)
			.filter(([, [status]]) => status !== 0)
			.map(([name]) => name);

		const ruleNames = enabledRules.toSorted().map((name) => `- ${picocolors.green(name)}`);
		consola.log(`Enabled ESLint rules in ${picocolors.cyan(directory)}:`);
		consola.log(ruleNames.join("\n"));
	});

export default getRulesCommand;
