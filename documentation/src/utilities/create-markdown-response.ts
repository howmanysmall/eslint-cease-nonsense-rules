import { getEntry } from "astro:content";

const markdownHeaders = {
	"content-type": "text/markdown; charset=utf-8",
};

export async function createMarkdownResponse(path: string | undefined): Promise<Response> {
	const entryId = path === undefined || path.length === 0 ? "index" : path;
	const doc = await getEntry("docs", entryId);

	if (doc === undefined) {
		return new Response("Not found", {
			headers: markdownHeaders,
			status: 404,
		});
	}

	const markdown = `# ${doc.data.title}\n\n${doc.body}`;
	return new Response(markdown, {
		headers: markdownHeaders,
	});
}
