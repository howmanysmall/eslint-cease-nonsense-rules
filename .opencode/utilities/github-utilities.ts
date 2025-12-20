import { Octokit } from "@octokit/rest";
import { encode } from "@toon-format/toon";
import arkenv from "arkenv";
import { type } from "arktype";
import { stringifyINI, stringifyJSON5, stringifyTOML } from "confbox";
import { XMLBuilder } from "fast-xml-parser";
import type { ObjectToCamel } from "ts-case-convert";
import { objectToCamel } from "ts-case-convert";

const environment = arkenv(
	{
		"GITHUB_TOKEN?": "/^gh[pousr]_|^github_pat_/",
		"NODE_ENV?": "string",
	},
	Bun.env,
);

const IS_DEVELOPMENT = environment.NODE_ENV !== "production";

const github = new Octokit({
	auth: environment.GITHUB_TOKEN,
});
const xmlBuilder = new XMLBuilder();

const isBoolean = type("boolean");

type DeepReadonly<TObject> =
	TObject extends Array<infer ItemType>
		? ReadonlyArray<DeepReadonly<ItemType>>
		: TObject extends object
			? {
					readonly [Key in keyof TObject]: DeepReadonly<TObject[Key]>;
				}
			: TObject;

type GetGitHubData<TFn extends (...args: Array<never>) => Promise<{ data: unknown }>> =
	Awaited<ReturnType<TFn>> extends { data: infer TData }
		? TData extends object | null | undefined
			? DeepReadonly<ObjectToCamel<TData>>
			: never
		: never;

/**
 * Enumeration of supported serialization/file formats used by the GitHub utilities.
 *
 * Each member corresponds to a canonical format identifier used when reading,
 * writing, or normalizing content in the repository or interacting with APIs.
 *
 * Members:
 * - Ini ("ini") -- INI files: simple key/value configuration files with optional
 *   sections. Best for lightweight configuration where minimal syntax is desired.
 *
 * - Json ("json") -- Standard JSON (RFC 8259): strict, widely-supported structured
 *   data interchange format. Use when interoperability and strict parsing are required.
 *
 * - Json5 ("json5") -- JSON5: a relaxed superset of JSON that permits comments,
 *   trailing commas, unquoted object keys, and other developer-friendly syntax.
 *   Useful for configuration files that should be human-editable.
 *
 * - JsonCompact ("json-compact") -- Compact JSON: a minified JSON representation
 *   that removes insignificant whitespace to reduce size. Ideal for storage or
 *   transmission where human readability is not needed.
 *
 * - Raw ("raw") -- Raw text/blob: no parsing or serialization is applied; the
 *   content is treated as an uninterpreted string or byte sequence. Use when
 *   exact preservation of bytes is required.
 *
 * - Toml ("toml") -- TOML (Tom's Obvious, Minimal Language): a configuration
 *   format with clear typing and table semantics. Good for declarative config
 *   files that require explicit datatypes and nesting.
 *
 * - Toon ("toon") -- Token-Oriented Object Notation: a compact, human-readable
 *   encoding of the JSON data model that minimizes tokens and makes structure
 *   easy for models to follow. It's intended for LLM input as a drop-in,
 *   lossless representation of your existing JSON.
 *
 * - Xml ("xml") -- XML: a verbose, tag-based markup format supporting attributes,
 *   namespaces, and mixed content. Use when interacting with systems or APIs
 *   that require XML payloads.
 *
 * - Yaml ("yaml") -- YAML: a human-friendly superset of JSON that supports
 *   anchors, aliases, and multiple documents per stream. Preferred for complex
 *   configuration documents that benefit from readability and expressive syntax.
 *
 * Remarks:
 * - Choose the format that best matches the consumer's expectations (strict parsers
 *   vs. human-editable configs vs. binary/raw data).
 * - These identifiers are used as the canonical keys when selecting parser/serializer
 *   behavior in the utilities that consume this enum.
 */
export enum FormatType {
	/**
	 * INI is a simple, line-oriented configuration format consisting of
	 * key-value pairs grouped into named sections. Useful for lightweight,
	 * human-editable configs.
	 */
	Ini = "Ini",

	/**
	 * JSON (JavaScript Object Notation) is a widely-used, structured
	 * data format designed for interoperability and simplicity in both
	 * human and machine contexts.
	 */
	Json = "Json",

	/**
	 * JSON5 extends standard JSON with more human-friendly syntax --
	 * including comments, trailing commas, and unquoted keys -- while
	 * remaining fully compatible with the JSON data model.
	 */
	Json5 = "Json5",

	/**
	 * A space-efficient variant of JSON that removes unnecessary whitespace
	 * and formatting while keeping the structure and values identical.
	 * Ideal for compact storage or transmission.
	 */
	JsonCompact = "JsonCompact",

	/**
	 * Raw mode passes the underlying string directly with no parsing,
	 * transformation, or validation. Useful when you need full control
	 * over input/output data.
	 */
	Raw = "Raw",

	/**
	 * TOML (Tom's Obvious, Minimal Language) is a configuration format
	 * designed to be easy to read, with strong typing and a minimal,
	 * predictable syntax.
	 */
	Toml = "Toml",

	/**
	 * Token-Oriented Object Notation is a compact, human-readable encoding of
	 * the JSON data model that minimizes tokens and makes structure easy for
	 * models to follow. It's intended for LLM input as a drop-in, lossless
	 * representation of your existing JSON.
	 */
	Toon = "Toon",

	/**
	 * XML (eXtensible Markup Language) is a hierarchical, tag-based data
	 * format commonly used for document interchange, configuration, and
	 * systems requiring extensive metadata.
	 */
	Xml = "Xml",

	/**
	 * YAML (YAML Ain't Markup Language) is a flexible, indentation-based
	 * serialization format that emphasizes human readability, supporting
	 * complex data types with minimal syntax.
	 */
	Yaml = "Yaml",
}

export const isFormatType = type.valueOf(FormatType);
type NonRawFormatType = Exclude<FormatType, FormatType.Raw>;

function stringify(data: object, formatType: NonRawFormatType): string {
	switch (formatType) {
		case FormatType.Json:
			return JSON.stringify(data, undefined, 2);

		case FormatType.JsonCompact:
			return JSON.stringify(data);

		case FormatType.Toml:
			return stringifyTOML({ data });

		case FormatType.Toon:
			return encode(data, {});

		case FormatType.Xml:
			return xmlBuilder.build(data);

		case FormatType.Yaml:
			return Bun.YAML.stringify(data);

		case FormatType.Ini:
			return stringifyINI(data);

		case FormatType.Json5:
			return stringifyJSON5(data);
	}
}

export const isContentsQuery = type({
	"formatType?": isFormatType.describe("The format to encode the content as."),
	owner: type("string").describe("Repository owner (username or organization)"),
	"path?": type("string").describe("Path to file/directory (directories must end with a slash '/')"),
	"ref?": type("string").describe(
		"Accepts optional git refs such as `refs/tags/{tag}`, `refs/heads/{branch}` or `refs/pull/{pr_number}/head`",
	),
	repo: type("string").describe("Repository name"),
	"sha?": type("string").describe("Accepts optional commit SHA. If specified, it will be used instead of ref"),
}).readonly();
export type ContentsQuery = typeof isContentsQuery.infer;
export type GetContentData = GetGitHubData<typeof github.rest.repos.getContent>;

export async function getContentsAsync(
	contentsQuery: ContentsQuery,
	formatType?: FormatType.Raw,
): Promise<GetContentData>;
export async function getContentsAsync(contentsQuery: ContentsQuery, formatType: NonRawFormatType): Promise<string>;
export async function getContentsAsync(
	contentsQuery: ContentsQuery,
	formatType: FormatType = FormatType.Raw,
): Promise<GetContentData | string> {
	if (IS_DEVELOPMENT) {
		isContentsQuery.assert(contentsQuery);
		isFormatType.assert(formatType);
	}

	const { owner, path = "/", ref, repo, sha } = contentsQuery;
	const { data } = await github.repos.getContent({
		owner,
		path: path === "/" ? "" : path,
		repo,
		...(sha !== undefined && { sha }),
		...(ref !== undefined && sha === undefined && { ref }),
	});

	const resultingData = objectToCamel(data);
	return formatType === FormatType.Raw ? resultingData : stringify(resultingData, formatType);
}

export const isReadmeQuery = type({
	owner: type("string").describe("The account owner of the repository. The name is not case sensitive."),
	repo: type("string").describe(
		"The name of the repository without the .git extension. The name is not case sensitive.",
	),
}).readonly();
export type ReadmeQuery = typeof isReadmeQuery.infer;
export type GetReadmeData = GetGitHubData<typeof github.rest.repos.getReadme>;

export async function getReadmeAsync(readmeQuery: ReadmeQuery, decode?: true): Promise<string>;
export async function getReadmeAsync(readmeQuery: ReadmeQuery, decode: false): Promise<GetReadmeData>;
export async function getReadmeAsync(readmeQuery: ReadmeQuery, decode = true): Promise<GetReadmeData | string> {
	if (IS_DEVELOPMENT) {
		isReadmeQuery.assert(readmeQuery);
		isBoolean.assert(decode);
	}

	const { owner, repo } = readmeQuery;
	const { data } = await github.repos.getReadme({ owner, repo });

	if (!decode) return objectToCamel(data);

	if (data.encoding === "base64") return Buffer.from(data.content, "base64").toString("utf8");
	return data.content;
}

export const isSearchCodeQuery = type({
	"order?": "'asc' | 'desc'",
	"page?": "number % 1",
	"perPage?": "number % 1",
	query: "string",
	"sort?": "'indexed'",
}).readonly();
export type SearchCodeQuery = typeof isSearchCodeQuery.infer;
export type GetSearchCodeData = GetGitHubData<typeof github.rest.search.code>;

export async function searchCodeAsync(
	searchCodeQuery: SearchCodeQuery,
	formatType: FormatType.Raw,
): Promise<GetSearchCodeData>;
export async function searchCodeAsync(searchCodeQuery: SearchCodeQuery, formatType: NonRawFormatType): Promise<string>;
export async function searchCodeAsync(
	searchCodeQuery: SearchCodeQuery,
	formatType: FormatType = FormatType.Raw,
): Promise<GetSearchCodeData | string> {
	if (IS_DEVELOPMENT) {
		isSearchCodeQuery.assert(searchCodeQuery);
		isFormatType.assert(formatType);
	}

	const { data } = await github.rest.search.code({
		order: searchCodeQuery.order,
		page: searchCodeQuery.page,
		per_page: searchCodeQuery.perPage,
		// oxlint-disable-next-line id-length
		q: searchCodeQuery.query,
		sort: searchCodeQuery.sort,
	});

	const resultingData = objectToCamel(data);
	return formatType === FormatType.Raw ? resultingData : stringify(resultingData, formatType);
}

export const isSearchRepositoriesQuery = type({
	"order?": "'asc' | 'desc'",
	"page?": "number % 1",
	"perPage?": "number % 1",
	query: "string",
	"sort?": "'stars' | 'forks' | 'help-wanted-issues' | 'updated'",
}).readonly();
export type SearchRepositoriesQuery = typeof isSearchRepositoriesQuery.infer;
export type GetSearchRepositoriesData = GetGitHubData<typeof github.rest.search.repos>;
export type GetSearchRepositoriesMinimalData = Omit<GetSearchRepositoriesData, "items"> & {
	readonly items: ReadonlyArray<{
		readonly description: string | null;
		readonly forks: number;
		readonly language: string | null;
		readonly lastUpdated: string;
		readonly name: string;
		readonly owner?: string | undefined;
		readonly stars: number;
		readonly topics?: ReadonlyArray<string>;
		readonly url: string;
	}>;
};

export async function searchRepositoriesAsync(
	searchRepositoriesQuery: SearchRepositoriesQuery,
	formatType: FormatType.Raw,
	minimalOutput?: true,
): Promise<GetSearchRepositoriesData>;
export async function searchRepositoriesAsync(
	searchRepositoriesQuery: SearchRepositoriesQuery,
	formatType: FormatType.Raw,
	minimalOutput: false,
): Promise<GetSearchRepositoriesMinimalData>;
export async function searchRepositoriesAsync(
	searchRepositoriesQuery: SearchRepositoriesQuery,
	formatType: NonRawFormatType,
	minimalOutput?: boolean,
): Promise<string>;
export async function searchRepositoriesAsync(
	searchRepositoriesQuery: SearchRepositoriesQuery,
	formatType: FormatType = FormatType.Raw,
	minimalOutput = true,
): Promise<GetSearchRepositoriesData | GetSearchRepositoriesMinimalData | string> {
	if (IS_DEVELOPMENT) {
		isSearchRepositoriesQuery.assert(searchRepositoriesQuery);
		isFormatType.assert(formatType);
		isBoolean.assert(minimalOutput);
	}

	const { data } = await github.rest.search.repos({
		order: searchRepositoriesQuery.order,
		page: searchRepositoriesQuery.page,
		per_page: searchRepositoriesQuery.perPage,
		// oxlint-disable-next-line id-length
		q: searchRepositoriesQuery.query,
		sort: searchRepositoriesQuery.sort,
	});

	if (minimalOutput) {
		const resultingData: GetSearchRepositoriesMinimalData = {
			incompleteResults: data.incomplete_results,
			items: data.items.map((repo) => ({
				description: repo.description,
				forks: repo.forks_count,
				language: repo.language,
				lastUpdated: repo.updated_at,
				name: repo.name,
				owner: repo.owner?.login,
				stars: repo.stargazers_count,
				topics: repo.topics,
				url: repo.html_url,
			})),
			totalCount: data.total_count,
		};

		return formatType === FormatType.Raw ? resultingData : stringify(resultingData, formatType);
	}

	const resultingData = objectToCamel(data);
	return formatType === FormatType.Raw ? resultingData : stringify(resultingData, formatType);
}
