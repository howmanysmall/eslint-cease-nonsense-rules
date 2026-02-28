interface BaseOutput<TArguments> {
	readonly args: TArguments;
}

export type BashOutput = BaseOutput<{
	command: string;
	description: string;
	timeout?: number;
	workdir?: string;
}>;
export function isBashOutput(input: string, _output: unknown): _output is BashOutput {
	return input === "bash";
}

export type ReadOutput = BaseOutput<{
	filePath: string;
	offset?: number;
	limit?: number;
}>;
export function isReadOutput(input: string, _output: unknown): _output is ReadOutput {
	return input === "read";
}

export type GlobOutput = BaseOutput<{
	pattern: string;
	path?: string;
}>;
export function isGlobOutput(input: string, _output: unknown): _output is GlobOutput {
	return input === "glob";
}

export type GrepOutput = BaseOutput<{
	pattern: string;
	path?: string;
	include?: string;
}>;
export function isGrepOutput(input: string, _output: unknown): _output is GrepOutput {
	return input === "grep";
}

export type EditOutput = BaseOutput<{
	filePath: string;
	oldString: string;
	newString: string;
	replaceAll?: boolean;
}>;
export function isEditOutput(input: string, _output: unknown): _output is EditOutput {
	return input === "edit";
}

export type WriteOutput = BaseOutput<{
	content: string;
	filePath: string;
}>;
export function isWriteOutput(input: string, _output: unknown): _output is WriteOutput {
	return input === "write";
}

export type QuestionOutput = BaseOutput<{
	questions: ReadonlyArray<{
		question: string;
		header: string;
		options: ReadonlyArray<{
			label: string;
			description: string;
		}>;
		multiple: boolean;
	}>;
}>;
export function isQuestionOutput(input: string, _output: unknown): _output is QuestionOutput {
	return input === "question";
}

export type TaskOutput = BaseOutput<{
	description: string;
	prompt: string;
	subagent_type: string;
	task_id?: string;
	command?: string;
}>;
export function isTaskOutput(input: string, _output: unknown): _output is TaskOutput {
	return input === "task";
}

export type WebFetchOutput = BaseOutput<{
	url: string;
	format?: "text" | "markdown" | "html";
	timeout?: number;
}>;
export function isWebFetchOutput(input: string, _output: unknown): _output is WebFetchOutput {
	return input === "webfetch";
}

export type TodoWriteOutput = BaseOutput<{
	todos: ReadonlyArray<{
		content: string;
		status: string;
		priority: string;
	}>;
}>;
export function isTodoWriteOutput(input: string, _output: unknown): _output is TodoWriteOutput {
	return input === "todowrite";
}

export type SkillOutput = BaseOutput<{
	name: string;
}>;
export function isSkillOutput(input: string, _output: unknown): _output is SkillOutput {
	return input === "skill";
}

export type LspOutput = BaseOutput<{
	operation:
		| "goToDefinition"
		| "findReferences"
		| "hover"
		| "documentSymbol"
		| "workspaceSymbol"
		| "goToImplementation"
		| "prepareCallHierarchy"
		| "incomingCalls"
		| "outgoingCalls";
	filePath: string;
	line: number;
	character: number;
}>;
export function isLspOutput(input: string, _output: unknown): _output is LspOutput {
	return input === "lsp";
}

export type BatchOutput = BaseOutput<{
	tool_calls: ReadonlyArray<{
		tool: string;
		parameters: Record<string, unknown>;
	}>;
}>;
export function isBatchOutput(input: string, _output: unknown): _output is BatchOutput {
	return input === "batch";
}

export type GoogleSearchOutput = BaseOutput<{
	query: string;
	urls?: ReadonlyArray<string>;
	thinking: boolean;
}>;
export function isGoogleSearchOutput(input: string, _output: unknown): _output is GoogleSearchOutput {
	return input === "google_search";
}

export interface InputToOutputMap {
	readonly bash: BashOutput;
	readonly batch: BatchOutput;
	readonly edit: EditOutput;
	readonly glob: GlobOutput;
	readonly google_search: GoogleSearchOutput;
	readonly grep: GrepOutput;
	readonly lsp: LspOutput;
	readonly question: QuestionOutput;
	readonly read: ReadOutput;
	readonly skill: SkillOutput;
	readonly task: TaskOutput;
	readonly todowrite: TodoWriteOutput;
	readonly webfetch: WebFetchOutput;
	readonly write: WriteOutput;
}
