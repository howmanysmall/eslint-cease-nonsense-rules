import { tool } from "@opencode-ai/plugin";
import { FormatType, getContentsAsync, searchCodeAsync, searchRepositoriesAsync } from "../utilities/github-utilities";

const isFormat = tool.schema
	.literal([
		FormatType.Ini,
		FormatType.Json,
		FormatType.Json5,
		FormatType.JsonCompact,
		FormatType.Toml,
		FormatType.Toon,
		FormatType.Xml,
		FormatType.Yaml,
	] as const)
	.optional()
	.default(FormatType.Json)
	.describe(
		[
			"The format to encode the content as.",
			" - Ini: Simple key-value configuration format using section headers.",
			" - Json: Standard structured data format for interoperability.",
			" - Json5: JSON with comments, trailing commas, and more human-friendly syntax.",
			" - JsonCompact: Minimized JSON without extra whitespace.",
			" - Toml: Minimal, strongly-typed configuration format designed for readability.",
			" - Toon: Token-Oriented Object Notation; compact, human-readable JSON designed for LLM input.",
			" - Xml: Tag-based hierarchical data format with explicit structure.",
			" - Yaml: Indentation-based, human-readable format supporting complex data types.",
		].join("\n"),
	);
const isOrder = tool.schema.enum(["asc", "desc"]).default("asc").describe("Sort order for results");
const isPage = tool.schema.int().min(1).default(1).describe("Page number for pagination (min 1)");
const isPerPage = tool.schema
	.int()
	.min(1)
	.max(100)
	.default(30)
	.describe("Results per page for pagination (min 1, max 100)");

export const getContents = tool({
	args: {
		format: isFormat,
		owner: tool.schema.string().describe("Repository owner (username or organization)"),
		path: tool.schema
			.string()
			.default("/")
			.describe("Path to file/directory (directories must end with a slash '/')"),
		ref: tool.schema
			.string()
			.optional()
			.describe(
				"Accepts optional git refs such as `refs/tags/{tag}`, `refs/heads/{branch}` or `refs/pull/{pr_number}/head`",
			),
		repo: tool.schema.string().describe("Repository name"),
		sha: tool.schema
			.string()
			.optional()
			.describe("Accepts optional commit SHA. If specified, it will be used instead of ref"),
	},
	description: "Get the contents of a file from a GitHub repository.",
	async execute({ format, owner, path, ref, repo, sha }): Promise<string> {
		return getContentsAsync({ owner, path, ref, repo, sha }, format);
	},
});

export const searchCode = tool({
	args: {
		format: isFormat,
		order: isOrder,
		page: isPage,
		perPage: isPerPage,
		query: tool.schema
			.string()
			.describe(
				"Search query using GitHub's powerful code search syntax. Examples: 'content:Skill language:Java org:github', 'NOT is:archived language:Python OR language:go', 'repo:github/github-mcp-server'. Supports exact matching, language filters, path filters, and more.",
			),
		sort: tool.schema.literal("indexed").optional().describe("Sort field ('indexed' only)"),
	},
	description:
		"Fast and precise code search across ALL GitHub repositories using GitHub's native search engine. Best for finding exact symbols, functions, classes, or specific code patterns.",
	async execute({ format, order, page, perPage, query, sort }): Promise<string> {
		return searchCodeAsync({ order, page, perPage, query, sort }, format);
	},
});

export const searchRepositories = tool({
	args: {
		format: isFormat,
		minimalOutput: tool.schema
			.boolean()
			.default(true)
			.describe(
				"Return minimal repository information (default: true). When false, returns full GitHub API repository objects.",
			),
		order: isOrder,
		page: isPage,
		perPage: isPerPage,
		query: tool.schema
			.string()
			.describe(
				"Repository search query. Examples: 'machine learning in:name stars:>1000 language:python', 'topic:react', 'user:facebook'. Supports advanced search syntax for precise filtering.",
			),
		sort: tool.schema
			.literal(["stars", "forks", "help-wanted-issues", "updated"] as const)
			.optional()
			.describe("Sort repositories by field, defaults to best match"),
	},
	description:
		"Find GitHub repositories by name, description, readme, topics, or other metadata. Perfect for discovering projects, finding examples, or locating specific repositories across GitHub.",
	async execute({ format, order, page, perPage, query, sort, minimalOutput }): Promise<string> {
		return searchRepositoriesAsync({ order, page, perPage, query, sort }, format, minimalOutput);
	},
});
