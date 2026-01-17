import { resolve } from "node:path";
import { cwd, exit } from "node:process";
import { Command, EnumType } from "@jsr/cliffy__command";
import { type } from "arktype";
import { consola } from "consola";
import { isDirectorySimpleAsync } from "../utilities/fs-utilities";
import { formatRulesAsJson } from "./formatters/json-formatter";
import { formatRulesAsMinimal } from "./formatters/minimal-formatter";
import { formatRulesAsTable } from "./formatters/table-formatter";
import type { RuleEntry } from "./formatters/types";
import { isValidRules } from "./formatters/types";

const CURRENT_WORKING_DIRECTORY = cwd();

enum OutputFormat {
	Json = "json",
	Minimal = "minimal",
	Table = "table",
}

async function getConfigurationPathAsync(directory: string): Promise<string | undefined> {
	const typescriptPath = resolve(directory, "eslint.config.ts");
	const typescriptFile = Bun.file(typescriptPath);
	if (await typescriptFile.exists()) return typescriptPath;

	const javascriptPath = resolve(directory, "eslint.config.js");
	const javascriptFile = Bun.file(javascriptPath);
	if (await javascriptFile.exists()) return javascriptPath;

	return undefined;
}

function getFormatter(format: OutputFormat): (entries: ReadonlyArray<RuleEntry>) => string {
	switch (format) {
		case OutputFormat.Json:
			return formatRulesAsJson;
		case OutputFormat.Minimal:
			return formatRulesAsMinimal;
		case OutputFormat.Table:
			return formatRulesAsTable;
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

		const uniqueRuleNames = [...new Set<string>([ruleName, ...ruleNames])];
		const entries: Array<RuleEntry> = uniqueRuleNames.map((name) => ({
			name,
			rule: rules[name],
		}));

		const formatter = getFormatter(format);
		console.log(formatter(entries));
	});

export default getRulesCommand;
