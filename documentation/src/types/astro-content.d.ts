declare module "astro:content" {
	export interface DocsEntry {
		id: string;
		collection: "docs";
		data: {
			title: string;
		};
		body: string;
	}

	export function getCollection(collection: "docs"): Promise<Array<DocsEntry>>;
	export function getEntry(collection: "docs", id: string): Promise<DocsEntry | undefined>;
}
