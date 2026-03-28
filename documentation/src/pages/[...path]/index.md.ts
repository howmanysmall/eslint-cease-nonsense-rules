import { getCollection } from "astro:content";

import { createMarkdownResponse } from "../../utilities/create-markdown-response";

import type { APIRoute, GetStaticPaths } from "astro";

export const GET: APIRoute = async ({ params }) => createMarkdownResponse(params.path);

export const getStaticPaths: GetStaticPaths = async () => {
	const docs = await getCollection("docs");
	const staticPaths = new Array<{ readonly params: { readonly path: string } }>();
	let size = 0;

	for (const docsEntry of docs) {
		if (docsEntry.id === "index") continue;
		staticPaths[size++] = { params: { path: docsEntry.id } };
	}

	return staticPaths;
};
