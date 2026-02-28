import type { PluginInput } from "@opencode-ai/plugin";

async function failSilentAsync(callback: () => Promise<unknown>): Promise<void> {
	try {
		await callback();
	} catch {
		// Do not care.
	}
}

function buildNotificationMessage({ project, directory, worktree }: PluginInput): string {
	const parts = new Array<string>();

	const displayPath = worktree === directory ? directory : worktree;
	if (displayPath) parts.push(displayPath);
	if (project.vcs === "git" && project.vcsDir) parts.push(`repo: ${project.vcsDir}`);

	return parts.join(" · ") || "Session completed.";
}

const TITLE = "opencode — Session Complete";

export async function sendNotificationAsync(pluginInput: PluginInput): Promise<void> {
	const { $ } = pluginInput;
	const body = buildNotificationMessage(pluginInput);

	switch (process.platform) {
		case "darwin":
			await failSilentAsync(
				async () => $`osascript -e ${`display notification "${body}" with title "${TITLE}"`}`,
			);
			break;

		case "win32":
			await failSilentAsync(
				async () => $`powershell -Command ${`New-BurntToastNotification -Text '${TITLE}', '${body}'`}`,
			);
			break;

		case "linux":
			await failSilentAsync(async () => $`notify-send ${TITLE} ${body}`);
			break;

		default:
			break;
	}
}
