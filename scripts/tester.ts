#!/usr/bin/env bun

import { Command } from "@jsr/cliffy__command";

import getRulesCommand from "./script-commands/tester/commands/get-rules-command";
import listRulesCommand from "./script-commands/tester/commands/list-rules-command";
import testLiveCommand from "./script-commands/tester/commands/test-live-command";

const command = new Command()
	.name("tester")
	.version("3.0.0")
	.description("A CLI for using the ESLint rules in a live environment.")
	.command("get-rules", getRulesCommand)
	.command("list-rules", listRulesCommand)
	.command("test-live", testLiveCommand);

if (import.meta.main) await command.parse(process.argv.slice(2));
