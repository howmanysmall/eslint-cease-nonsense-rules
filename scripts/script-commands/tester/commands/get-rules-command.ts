import nodePath from "node:path";
import { exit } from "node:process";
import { Command, EnumType } from "@cliffy/command";
import { type } from "arktype";

import { withContext } from "../logging/log-utilities";
import { getConfigurationPathAsync } from "../utilities/eslint-utilities";
import { isDirectorySimpleAsync } from "../utilities/fs-utilities";
import { getCommandTextAsync } from "../utilities/process-utilities";
import { formatRulesAsJson } from "./formatters/json-formatter";
import { formatRulesAsMinimal } from "./formatters/minimal-formatter";
import { formatRulesAsTable } from "./formatters/table-formatter";
import { isValidRules } from "./formatters/types";

import type { RuleEntry } from "./formatters/types";

const log = withContext({ namespace: "tester", scope: "get-rules" });

enum OutputFormat {
	Json = "json",
	Minimal = "minimal",
	Table = "table",
}

function getFormatter(format: OutputFormat): (entries: ReadonlyArray<RuleEntry>) => string {
	switch (format) {
		case OutputFormat.Json:
			return formatRulesAsJson;
		case OutputFormat.Minimal:
			return formatRulesAsMinimal;
		case OutputFormat.Table:
			return formatRulesAsTable;
		default: {
			const error = new Error(`Unsupported output format: ${String(format)}`);
			Error.captureStackTrace(error, getFormatter);
			throw error;
		}
	}
}

const getRulesCommand = new Command()
	.name("get-rules")
	.description("Get the ESLint rules from the live environment.")
	.version("1.0.0")
	.type("format", new EnumType(OutputFormat))
	.option("-f, --format <format:format>", "Output format", {
		default: OutputFormat.Table,
	})
	.arguments("<directory:string> <...rule-names:string>")
	.action(async ({ format }, directoryUnresolved, ruleName, ...ruleNames) => {
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

		const uniqueRuleNames = [...new Set([ruleName, ...ruleNames])];
		const entries: Array<RuleEntry> = uniqueRuleNames.map((name) => ({
			name,
			rule: rules[name],
		}));

		const formatter = getFormatter(format);
		console.log(formatter(entries));
	});

export default getRulesCommand;
