#!/usr/bin/env bun

import { exit, platform } from "node:process";
import { Command } from "@jsr/cliffy__command";
import console from "consola";
import { cyan, gray, green, magenta, red, yellow } from "picocolors";
import getRulesCommand from "./tester/commands/get-rules-command";
import listRulesCommand from "./tester/commands/list-rules-command";
import testLiveCommand from "./tester/commands/test-live-command";

if (typeof Bun === "undefined") {
	const installScript =
		platform === "win32"
			? `${gray("`")}${green("powershell")} ${yellow("-c")} ${cyan('"irm bun.sh/install.ps1 | iex"')}${gray("`")}`
			: `${gray("`")}${green("curl")} ${yellow("-fsSL")} ${cyan("https://bun.sh/install")} ${magenta("|")} ${green("bash")}${gray("`")}`;
	console.fail(red("This script must be run with Bun."));
	console.fail(`Please install Bun using ${installScript}`);
	exit(1);
}

const command = new Command()
	.name("tester")
	.version("2.1.0")
	.description("A CLI for using the ESLint rules in a live environment.")
	.command("get-rules", getRulesCommand)
	.command("list-rules", listRulesCommand)
	.command("test-live", testLiveCommand);

await command.parse(Bun.argv.slice(2));
