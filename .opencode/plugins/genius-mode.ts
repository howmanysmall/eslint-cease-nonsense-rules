// oxlint-disable typescript/require-await small-rules/prevent-abbreviations regexp-js/no-unused-capturing-group -- coal!
// biome-ignore-all lint/nursery/useNamedCaptureGroup: coal
import { TOOL_OUTPUT_ARGUMENTS_PROPERTY, isBashOutput, isReadOutput } from "./types/outputs";
import { sendNotificationAsync } from "./utilities/send-notification-async";

import type { Hooks, Plugin } from "@opencode-ai/plugin";

function definePlugin<THooks extends Hooks>(
	plugin: (input: Parameters<Plugin>[0]) => Promise<THooks>,
): (input: Parameters<Plugin>[0]) => Promise<THooks> {
	return plugin;
}

const WHITESPACE_REGEXP = /\s+/gv;
const BUN_RUN_TEST_REGEXP = /^bun run test(\s|$)/iv;
const BUN_TEST_REGEXP = /^bun test(\s|$)/iv;
const AUBE_RUN_TEST_REGEXP = /^aube run test(\s|$)/iv;
const AUBR_TEST_REGEXP = /^aubr test(\s|$)/iv;

const ENV_PREFIX_REGEXP = /^(?:[A-Za-z_]\w*=(?:"[^"]*"|'[^']*'|\S+)\s+)+/v;
const REPORTER_FLAG_REGEXP = /--reporter(?:\s|=)/v;

function extractEnvironmentPrefix(normalized: string): { envPrefix: string; command: string } {
	const match = ENV_PREFIX_REGEXP.exec(normalized);
	if (!match) return { command: normalized, envPrefix: "" };

	const [environmentPrefix] = match;
	return { command: normalized.slice(environmentPrefix.length), envPrefix: environmentPrefix };
}

function insertReporterForAubeRun(parameters: string): string {
	if (!parameters) return "-- --reporter agent";
	if (parameters === "--" || parameters.startsWith("-- ")) {
		const rest = parameters.slice(2).trim();
		return rest ? `-- --reporter agent ${rest}` : "-- --reporter agent";
	}
	return `-- --reporter agent ${parameters}`;
}

function buildAubrCommand(environmenPrefix: string, parameters: string): string {
	const suffix = parameters ? ` ${parameters}` : "";
	return `${environmenPrefix}aubr test --reporter agent${suffix}`;
}

function buildAubeRunCommand(environmentPrefix: string, parameters: string): string {
	return `${environmentPrefix}aube run test ${insertReporterForAubeRun(parameters)}`;
}

function transformTestCommand(command: string): string | undefined {
	const normalized = command.trim().replaceAll(WHITESPACE_REGEXP, " ");

	// Skip if --reporter is already present anywhere in the command.
	if (!normalized || REPORTER_FLAG_REGEXP.test(normalized)) return undefined;

	const { envPrefix: environmentPrefix, command: withoutEnvironment } = extractEnvironmentPrefix(normalized);
	if (!withoutEnvironment) return undefined;

	// aube run test <args> — already the right runner, just add --reporter.
	const aubeRunMatch = AUBE_RUN_TEST_REGEXP.exec(withoutEnvironment);
	if (aubeRunMatch) {
		const parameters = withoutEnvironment.slice(aubeRunMatch[0].length).trim();
		return buildAubeRunCommand(environmentPrefix, parameters);
	}

	// aubr test <args> — already the right runner, just add --reporter.
	const aubrMatch = AUBR_TEST_REGEXP.exec(withoutEnvironment);
	if (aubrMatch) {
		const parameters = withoutEnvironment.slice(aubrMatch[0].length).trim();
		return buildAubrCommand(environmentPrefix, parameters);
	}

	// Only check bun-prefixed commands below.
	if (!withoutEnvironment.toLowerCase().startsWith("bun ")) return undefined;

	// bun run test <args> → aube run test.
	const bunRunMatch = BUN_RUN_TEST_REGEXP.exec(withoutEnvironment);
	if (bunRunMatch) {
		const parameters = withoutEnvironment.slice(bunRunMatch[0].length).trim();
		return buildAubeRunCommand(environmentPrefix, parameters);
	}

	// bun test <args> → aubr test.
	const bunTestMatch = BUN_TEST_REGEXP.exec(withoutEnvironment);
	if (bunTestMatch) {
		const parameters = withoutEnvironment.slice(bunTestMatch[0].length).trim();
		return buildAubrCommand(environmentPrefix, parameters);
	}

	return undefined;
}

export const Notify = definePlugin(async function notify(context): Promise<Hooks> {
	return {
		event: async ({ event }) => {
			if (event.type !== "session.idle") return;
			await sendNotificationAsync(context);
		},
	};
});

export const BunTestInjection = definePlugin(async function injectTesting(_context): Promise<Hooks> {
	return {
		"tool.execute.before": async ({ tool }, output) => {
			if (!isBashOutput(tool, output)) return;
			const newCommand = transformTestCommand(output[TOOL_OUTPUT_ARGUMENTS_PROPERTY].command);
			if (newCommand !== undefined) output[TOOL_OUTPUT_ARGUMENTS_PROPERTY].command = newCommand;
		},
	};
});

export const ProtectEnv = definePlugin(async function protectEnvironment(_context): Promise<Hooks> {
	return {
		"tool.execute.before": async (input, output) => {
			if (isReadOutput(input.tool, output) && output[TOOL_OUTPUT_ARGUMENTS_PROPERTY].filePath.includes(".env")) {
				throw new Error("Do not read .env files");
			}
		},
	};
});
