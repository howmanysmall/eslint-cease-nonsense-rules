import { getEntry } from "astro:content";

import type { DocumentationEntry } from "astro:content";

const markdownHeaders = {
	"content-type": "text/markdown; charset=utf-8",
};

export function isDocumentationEntry(value: unknown): value is DocumentationEntry {
	if (typeof value !== "object" || value === null) return false;
	if (!("body" in value) || typeof value.body !== "string") return false;
	if (!("id" in value) || typeof value.id !== "string") return false;
	if (!("data" in value) || typeof value.data !== "object" || value.data === null) return false;

	return "title" in value.data && typeof value.data.title === "string";
}

export async function createMarkdownResponseAsync(path?: string): Promise<Response> {
	const entryId = path === undefined || path.length === 0 ? "index" : path;
	const document: unknown = await getEntry("docs", entryId);

	if (!isDocumentationEntry(document)) {
		return new Response("Not found", {
			headers: markdownHeaders,
			status: 404,
		});
	}

	const markdown = `# ${document.data.title}\n\n${document.body}`;
	return new Response(markdown, {
		headers: markdownHeaders,
	});
}
