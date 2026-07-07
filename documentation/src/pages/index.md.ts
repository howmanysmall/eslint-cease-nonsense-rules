import { createMarkdownResponseAsync } from "../utilities/create-markdown-response";

import type { APIRoute } from "astro";

const getMarkdownRouteAsync: APIRoute = async () => createMarkdownResponseAsync(undefined);

export { getMarkdownRouteAsync as GET };
