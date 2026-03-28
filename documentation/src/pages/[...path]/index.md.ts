import { getCollection } from "astro:content";

import { createMarkdownResponse } from "../../utilities/create-markdown-response";

import type { APIRoute, GetStaticPaths } from "astro";
import type { CollectionEntry } from "astro:content";

export const GET: APIRoute = async ({ params }) => createMarkdownResponse(params.path);

export const getStaticPaths: GetStaticPaths = async () => {
	const docs: Array<CollectionEntry<"docs">> = await getCollection("docs");
	return docs
		.filter((doc) => doc.id !== "index")
		.map((doc) => ({
			params: { path: doc.id },
		}));
};
