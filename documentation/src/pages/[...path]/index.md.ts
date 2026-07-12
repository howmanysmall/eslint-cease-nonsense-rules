import { getCollection } from "astro:content";

import { createMarkdownResponseAsync, isDocumentationEntry } from "../../utilities/create-markdown-response";

import type { APIRoute, GetStaticPaths } from "astro";

const getMarkdownRouteAsync: APIRoute = async ({ params: parameters }) => createMarkdownResponseAsync(parameters.path);

const getMarkdownStaticPathsAsync: GetStaticPaths = async () => {
	const documentation: unknown = await getCollection("docs");
	const staticPaths = new Array<{ readonly params: { readonly path: string } }>();
	let size = 0;

	if (!Array.isArray(documentation)) return staticPaths;

	for (const entry of documentation) {
		if (!isDocumentationEntry(entry)) continue;
		const { id } = entry;
		if (id === "index") continue;
		staticPaths[size++] = { params: { path: id } };
	}

	return staticPaths;
};

export { getMarkdownRouteAsync as GET, getMarkdownStaticPathsAsync as getStaticPaths };
