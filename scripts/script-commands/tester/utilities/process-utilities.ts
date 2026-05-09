import { spawn } from "node:child_process";

interface CommandOptions {
	readonly cwd?: string;
	readonly env?: NodeJS.ProcessEnv;
}

interface CommandResult {
	readonly exitCode: number | null;
	readonly stderr: string;
	readonly stdout: string;
}

function createCommandError(command: string, args: ReadonlyArray<string>, result: CommandResult): Error {
	const renderedCommand = [command, ...args].join(" ");
	const output = [result.stderr.trim(), result.stdout.trim()].filter(Boolean).join("\n");
	const message = output ? `${renderedCommand} failed.\n${output}` : `${renderedCommand} failed.`;
	return new Error(message);
}

export async function runCommandAsync(
	command: string,
	args: ReadonlyArray<string>,
	options: CommandOptions = {},
): Promise<CommandResult> {
	return new Promise((resolve, reject) => {
		const stdoutChunks: Array<Uint8Array> = [];
		const stderrChunks: Array<Uint8Array> = [];
		const childProcess = spawn(command, [...args], {
			cwd: options.cwd,
			env: options.env,
			stdio: ["ignore", "pipe", "pipe"],
		});

		childProcess.stdout.on("data", (chunk: Uint8Array) => {
			stdoutChunks.push(chunk);
		});

		childProcess.stderr.on("data", (chunk: Uint8Array) => {
			stderrChunks.push(chunk);
		});

		childProcess.on("error", reject);
		childProcess.on("close", (exitCode) => {
			const result = {
				exitCode,
				stderr: Buffer.concat(stderrChunks).toString("utf8"),
				stdout: Buffer.concat(stdoutChunks).toString("utf8"),
			};

			if (exitCode === 0) resolve(result);
			else reject(createCommandError(command, args, result));
		});
	});
}

export async function getCommandTextAsync(
	command: string,
	args: ReadonlyArray<string>,
	options?: CommandOptions,
): Promise<string> {
	const result = await runCommandAsync(command, args, options);
	return result.stdout;
}
