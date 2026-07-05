import { spawnSync } from "node:child_process";
import process from "node:process";

type JsonRecord = Readonly<Record<string, unknown>>;

const lintableExtensionPattern = /\.(?:[cm]?[jt]sx?|jsonc?|mdx?)$/u;
const leadingDotSlashPattern = /^\.\//u;
const quotedPathBoundaryPattern = /^["']|["']$/gu;
const patchPathPattern = /^\*\*\* (?:Add|Update) File: (?<filePath>.+)$/gmu;
const skippedPathPrefixes = ["dist/", "node_modules/", ".opencode/node_modules/"];
const shellPath = "/bin/zsh";

async function mainAsync(): Promise<void> {
	const input = parseHookInput(await readStdinAsync());
	const files = getRelevantEditedFiles(input);

	if (files.length === 0) return;

	const result = spawnSync(shellPath, ["-lc", 'command nr lint "$@"', "nr", ...files], {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	});

	if (result.status === 0) return;

	process.stderr.write(`\nEdited-file lint reported issues for: ${files.join(", ")}\n`);
	if (result.stdout.length > 0) process.stderr.write(result.stdout);
	if (result.stderr.length > 0) process.stderr.write(result.stderr);
	process.stderr.write("\nFix these if they are related to the edit you just made.\n");
}

async function readStdinAsync(): Promise<string> {
	let data = "";
	process.stdin.setEncoding("utf8");

	for await (const chunk of process.stdin) data += chunk;

	return data;
}

function parseHookInput(value: string): JsonRecord {
	if (value.trim().length === 0) return {};

	try {
		const parsed: unknown = JSON.parse(value);
		if (!isJsonRecord(parsed)) return {};
		return parsed;
	} catch {
		return {};
	}
}

function isJsonRecord(value: unknown): value is JsonRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getRelevantEditedFiles(input: JsonRecord): ReadonlyArray<string> {
	if (input.hook_event_name !== "PostToolUse") return [];
	if (typeof input.tool_name !== "string") return [];

	const toolInput = isJsonRecord(input.tool_input) ? input.tool_input : {};
	const editedFiles = getEditedFiles(input.tool_name, toolInput);
	const relevantFiles = editedFiles.filter(isRelevantLintTarget);

	return [...new Set(relevantFiles)].toSorted();
}

function getEditedFiles(toolName: string, toolInput: JsonRecord): ReadonlyArray<string> {
	if (toolName === "apply_patch") return getPatchEditedFiles(getCommand(toolInput));
	if (toolName === "Edit" || toolName === "Write") return getFilePath(toolInput);
	return [];
}

function getCommand(toolInput: JsonRecord): string {
	const { command } = toolInput;
	if (typeof command === "string") return command;

	const { cmd } = toolInput;
	return typeof cmd === "string" ? cmd : "";
}

function getFilePath(toolInput: JsonRecord): ReadonlyArray<string> {
	const { file_path: filePath } = toolInput;
	if (typeof filePath !== "string") return [];

	return [normalizeRepoPath(filePath)];
}

function getPatchEditedFiles(patch: string): ReadonlyArray<string> {
	const editedFiles = new Array<string>();

	for (const match of patch.matchAll(patchPathPattern)) {
		const [, filePath] = match;
		if (typeof filePath === "string") editedFiles.push(normalizeRepoPath(filePath));
	}

	return editedFiles;
}

function normalizeRepoPath(filePath: string): string {
	return filePath.replaceAll(quotedPathBoundaryPattern, "").replace(leadingDotSlashPattern, "");
}

function isRelevantLintTarget(filePath: string): boolean {
	if (!lintableExtensionPattern.test(filePath)) return false;
	return !skippedPathPrefixes.some((prefix) => filePath.startsWith(prefix));
}

await mainAsync();
