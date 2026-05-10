import { getCollection } from "astro:content";

import { createMarkdownResponse } from "../../utilities/create-markdown-response";

import type { APIRoute, GetStaticPaths } from "astro";

export const GET: APIRoute = async ({ params: parameters }) => createMarkdownResponse(parameters.path);

export const getStaticPaths: GetStaticPaths = async () => {
	const documentation = await getCollection("docs");
	const staticPaths = new Array<{ readonly params: { readonly path: string } }>();
	let size = 0;

	for (const { id } of documentation) {
		if (id === "index") continue;
		staticPaths[size++] = { params: { path: id } };
	}

	return staticPaths;
};
