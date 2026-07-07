import { getCollection } from "astro:content";

import { createMarkdownResponseAsync } from "../../utilities/create-markdown-response";

import type { APIRoute, GetStaticPaths } from "astro";

const getMarkdownRouteAsync: APIRoute = async ({ params: parameters }) => createMarkdownResponseAsync(parameters.path);

const getMarkdownStaticPathsAsync: GetStaticPaths = async () => {
	const documentation = await getCollection("docs");
	const staticPaths = new Array<{ readonly params: { readonly path: string } }>();
	let size = 0;

	for (const { id } of documentation) {
		if (id === "index") continue;
		staticPaths[size++] = { params: { path: id } };
	}

	return staticPaths;
};

export { getMarkdownRouteAsync as GET, getMarkdownStaticPathsAsync as getStaticPaths };
