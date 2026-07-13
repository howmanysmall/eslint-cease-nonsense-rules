export type PageBadgeVariant = "note" | "danger" | "success" | "caution" | "tip" | "default";

export interface PageBadge {
	readonly text: string;
	readonly variant: PageBadgeVariant;
}

const badgeVariants = new Set<string>(["note", "danger", "success", "caution", "tip", "default"]);

function isPageBadgeVariant(value: string): value is PageBadgeVariant {
	return badgeVariants.has(value);
}

export function normalizePageBadgeVariant(value: string): PageBadgeVariant {
	return isPageBadgeVariant(value) ? value : "default";
}
