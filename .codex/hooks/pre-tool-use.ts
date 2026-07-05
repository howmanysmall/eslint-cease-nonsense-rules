import nodeProcess from "node:process";

type JsonRecord = Readonly<Record<string, unknown>>;
type Quote = '"' | "'" | "";

const protectedConfigFiles = new Set([".oxlintrc.json", "biome.jsonc", ".oxfmtrc.json"]);
const leadingDotSlashPattern = /^\.\//u;
const shellWhitespacePattern = /\s/u;

async function mainAsync(): Promise<void> {
	const input = parseHookInput(await readStdinAsync());
	const denial = getDenialReason(input);

	if (denial.length === 0) return;

	nodeProcess.stderr.write(`${denial}\n`);
	nodeProcess.stdout.write(
		JSON.stringify({
			hookSpecificOutput: {
				hookEventName: "PreToolUse",
				permissionDecision: "deny",
				permissionDecisionReason: denial,
			},
		}),
	);
	nodeProcess.stdout.write("\n");
	nodeProcess.exitCode = 2;
}

async function readStdinAsync(): Promise<string> {
	let data = "";
	nodeProcess.stdin.setEncoding("utf8");

	for await (const chunk of nodeProcess.stdin) data += chunk;

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

function getDenialReason(input: JsonRecord): string {
	if (input.hook_event_name !== "PreToolUse") return "";
	if (typeof input.tool_name !== "string") return "";

	const toolInput = isJsonRecord(input.tool_input) ? input.tool_input : {};
	const editedPaths = getEditedPaths(input.tool_name, toolInput);
	const blockedPaths = editedPaths.filter((path) => protectedConfigFiles.has(path));

	if (blockedPaths.length === 0) return "";

	return `Do not edit protected lint/format config files: ${blockedPaths.join(", ")}.`;
}

function getEditedPaths(toolName: string, toolInput: JsonRecord): ReadonlyArray<string> {
	if (toolName === "apply_patch") return getPatchEditedPaths(getCommand(toolInput));
	if (toolName === "Edit" || toolName === "Write") return getFilePath(toolInput);
	if (toolName === "Bash") return getShellWriteTargets(getCommand(toolInput));
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

const PATCH_PATH_REGEXP = /^\*\*\* (?:Add|Update|Delete) File: (?<filePath>.+)$/gmu;
function getPatchEditedPaths(patch: string): ReadonlyArray<string> {
	const editedPaths = new Set<string>();

	for (const match of patch.matchAll(PATCH_PATH_REGEXP)) {
		const [, filePath] = match;
		if (typeof filePath === "string") editedPaths.add(normalizeRepoPath(filePath));
	}

	return [...editedPaths];
}

function getShellWriteTargets(command: string): ReadonlyArray<string> {
	const targets = new Set<string>();
	const words = parseShellWords(command);

	for (let index = 0; index < words.length; index += 1) {
		const word = words[index];
		const nextWord = words[index + 1];
		const nextWordReal = nextWord !== undefined && nextWord.length > 0;

		if ((word === ">" || word === ">>") && nextWordReal) targets.add(normalizeRepoPath(nextWord));
		if ((word === "tee" || word === "sed" || word === "perl") && nextWordReal) {
			for (const target of words.slice(index + 1)) targets.add(normalizeRepoPath(target));
		}
	}

	return [...targets];
}

function normalizeRepoPath(filePath: string): string {
	return filePath.replaceAll(/^["']|["']$/gu, "").replace(leadingDotSlashPattern, "");
}

function parseShellWords(command: string): ReadonlyArray<string> {
	const words = new Array<string>();
	let current = "";
	let quote: Quote = "";

	for (const character of command) {
		const quotedCharacter = readQuotedCharacter({ character, current, quote });
		if (quotedCharacter !== undefined) {
			({ current, quote } = quotedCharacter);
		} else if (isQuote(character)) {
			quote = character;
		} else if (shellWhitespacePattern.test(character)) {
			current = pushCurrentWord(words, current);
		} else if (character === ">") {
			if (current.length > 0) {
				words.push(current);
				current = "";
			}
			words.push(character);
		} else {
			current += character;
		}
	}

	pushCurrentWord(words, current);

	return words;
}

interface QuotedCharacterState {
	readonly character: string;
	readonly current: string;
	readonly quote: Quote;
}

interface QuotedCharacterResult {
	readonly current: string;
	readonly quote: Quote;
}

function readQuotedCharacter({ character, current, quote }: QuotedCharacterState): QuotedCharacterResult | undefined {
	if (quote.length === 0) return undefined;

	if (character === quote) {
		return {
			current,
			quote: "",
		};
	}

	return {
		current: `${current}${character}`,
		quote,
	};
}

function isQuote(character: string): character is Exclude<Quote, ""> {
	return character === '"' || character === "'";
}

function pushCurrentWord(words: Array<string>, current: string): string {
	if (current.length > 0) words.push(current);
	return "";
}

await mainAsync();
