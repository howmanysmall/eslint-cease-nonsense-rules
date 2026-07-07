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
	if (displayPath.length > 0) parts.push(displayPath);
	if (project.vcs === "git" && project.vcsDir !== undefined && project.vcsDir.length > 0) {
		parts.push(`repo: ${project.vcsDir}`);
	}

	return parts.join(" · ") || "Session completed.";
}

const TITLE = "opencode — Session Complete";

export async function sendNotificationAsync(pluginInput: PluginInput): Promise<void> {
	const { $ } = pluginInput;
	const body = buildNotificationMessage(pluginInput);

	switch (process.platform) {
		case "darwin": {
			const script = `display notification "${body}" with title "${TITLE}"`;
			await failSilentAsync(async () => $`osascript -e ${script}`);
			break;
		}

		case "win32": {
			const command = `New-BurntToastNotification -Text '${TITLE}', '${body}'`;
			await failSilentAsync(async () => $`powershell -Command ${command}`);
			break;
		}

		case "linux": {
			await failSilentAsync(async () => $`notify-send ${TITLE} ${body}`);
			break;
		}

		default:
			break;
	}
}
