import type { Hooks, Plugin } from "@opencode-ai/plugin";
import { isBashOutput, isReadOutput } from "./types/outputs";
import { sendNotificationAsync } from "./utilities/send-notification-async";

function definePlugin<THooks extends Hooks>(
	plugin: (input: Parameters<Plugin>[0]) => Promise<THooks>,
): (input: Parameters<Plugin>[0]) => Promise<THooks> {
	return plugin;
}

const WHITESPACE_REGEXP = /\s+/g;
const BUN_RUN_REGEXP = /^bun run test(\s|$)/i;
const BUN_TEST_ONLY_REGEXP = /^bun test(\s|$)/i;

const ENV_PREFIX_REGEXP = /^(?:[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|[^\s]+)\s+)+/;

const enum BunTestType {
	None = 0x00,

	BunRun = 0x01,
	BunTest = 0x02,

	// Use non-overlapping values (your 0x03/0x04 collide logically)
	BunRunWithEnv = 0x11,
	BunTestWithEnv = 0x12,
}

function getBunTestType(command: string): BunTestType {
	const normalized = command.trim().replaceAll(WHITESPACE_REGEXP, " ");
	if (!normalized) return BunTestType.None;

	const hasEnvPrefix = ENV_PREFIX_REGEXP.test(normalized);
	const withoutEnv = hasEnvPrefix ? normalized.replace(ENV_PREFIX_REGEXP, "") : normalized;

	if (!withoutEnv.toLowerCase().startsWith("bun ")) return BunTestType.None;
	if (BUN_RUN_REGEXP.test(withoutEnv)) return hasEnvPrefix ? BunTestType.BunRunWithEnv : BunTestType.BunRun;
	if (BUN_TEST_ONLY_REGEXP.test(withoutEnv)) return hasEnvPrefix ? BunTestType.BunTestWithEnv : BunTestType.BunTest;

	return BunTestType.None;
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
			if (isBashOutput(tool, output)) {
				const { command } = output.args;
				const bunTestType = getBunTestType(command);
				if (bunTestType === BunTestType.None) return;

				switch (bunTestType) {
					case BunTestType.BunRun:
					case BunTestType.BunTest:
						output.args.command = `AGENT=1 ${command}`;
						break;

					case BunTestType.BunRunWithEnv:
					case BunTestType.BunTestWithEnv:
						break;
				}
			}
		},
	};
});

export const ProtectEnv = definePlugin(async function protectEnv(_context): Promise<Hooks> {
	return {
		"tool.execute.before": async (input, output) => {
			if (isReadOutput(input.tool, output) && output.args.filePath.includes(".env")) {
				throw new Error("Do not read .env files");
			}
		},
	};
});
