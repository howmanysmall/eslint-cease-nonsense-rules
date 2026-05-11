declare module "astro:content" {
	export interface DocumentationEntry {
		body: string;
		collection: "docs";
		data: { title: string };
		id: string;
	}

	export function getCollection(collection: "docs"): Promise<Array<DocumentationEntry>>;
	export function getEntry(collection: "docs", id: string): Promise<DocumentationEntry | undefined>;
}
