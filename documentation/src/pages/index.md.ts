import { createMarkdownResponse } from "../utilities/create-markdown-response";

import type { APIRoute } from "astro";

export const GET: APIRoute = async () => createMarkdownResponse(undefined);
