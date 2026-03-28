import { getCollection } from "astro:content";

import { createMarkdownResponse } from "../../utilities/create-markdown-response";

import type { APIRoute, GetStaticPaths } from "astro";

export const GET: APIRoute = async ({ params }) => createMarkdownResponse(params.path);

export const getStaticPaths: GetStaticPaths = async () => {
	const docs = await getCollection("docs");
	return docs
		.filter((doc) => doc.id !== "index")
		.map((doc) => ({
			params: { path: doc.id },
		}));
};
