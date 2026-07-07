import { getEntry } from "astro:content";

const markdownHeaders = {
	"content-type": "text/markdown; charset=utf-8",
};

export async function createMarkdownResponseAsync(path?: string): Promise<Response> {
	const entryId = path === undefined || path.length === 0 ? "index" : path;
	const document = await getEntry("docs", entryId);

	if (document === undefined) {
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
