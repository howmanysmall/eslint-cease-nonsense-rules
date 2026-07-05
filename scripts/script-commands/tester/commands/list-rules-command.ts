import nodePath from "node:path";
import { exit } from "node:process";
import { Command } from "@cliffy/command";
import { type } from "arktype";
import picocolors from "picocolors";

import { withContext } from "../logging/log-utilities";
import { getConfigurationPathAsync } from "../utilities/eslint-utilities";
import { isDirectorySimpleAsync } from "../utilities/fs-utilities";
import { getCommandTextAsync } from "../utilities/process-utilities";
import { isValidRules } from "./formatters/types";

const log = withContext({ namespace: "tester", scope: "list-rules" });

const getRulesCommand = new Command()
	.name("list-rules")
	.description("List all available ESLint rules from the live environment.")
	.version("1.0.0")
	.arguments("<directory:string>")
	.action(async (_, directoryUnresolved) => {
		const directory = nodePath.resolve(directoryUnresolved);
		const isDirectoryReal = await isDirectorySimpleAsync(directory);
		if (!isDirectoryReal) {
			log.fail("The specified directory does not exist.");
			exit(1);
		}

		const configurationPath = await getConfigurationPathAsync(directory);
		if (configurationPath === undefined) {
			log.fail("No ESLint configuration found in the specified directory.");
			exit(1);
		}

		log.verbose("Loading ESLint configuration...");

		const text = await getCommandTextAsync("nlx", ["eslint", "--print-config", configurationPath], {
			cwd: directory,
		});

		const json = isValidRules(JSON.parse(text));
		if (json instanceof type.errors) {
			log.fail(`The ESLint configuration is invalid: ${json.summary}`);
			exit(1);
		}

		const { rules } = json;
		const enabledRules = Object.entries(rules)
			.filter(([, [status]]) => status !== 0)
			.map(([name]) => name);

		const ruleNames = enabledRules.toSorted().map((name) => `- ${picocolors.green(name)}`);
		log.log(`Enabled ESLint rules in ${picocolors.cyan(directory)}:`);
		log.log(ruleNames.join("\n"));
	});

export default getRulesCommand;
