import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { normalizePageBadgeVariant } from "../utilities/page-badge";

import type { PageBadge, PageBadgeVariant } from "../utilities/page-badge";

export interface RuleFrontmatterBadge {
	readonly text: string;
	readonly variant: PageBadgeVariant;
}

export interface RuleFrontmatterMeta {
	readonly badges: ReadonlyArray<RuleFrontmatterBadge>;
	readonly description?: string;
	readonly title?: string;
}

const badgesBlockPattern = /(?:^|\n)badges:\n(?<block>(?:[ \t].+\n?)*)/u;
const badgeItemPattern = /-\s*text:\s*["']?(?<text>[^"'\n]+)["']?\s*(?:\n[ \t]+variant:\s*(?<variant>\w+))?/gu;
const singularBadgePattern =
	/(?:^|\n)badge:\n[ \t]+text:\s*["']?(?<text>[^"'\n]+)["']?\s*(?:\n[ \t]+variant:\s*(?<variant>\w+))?/u;

function resolveRulesDirectory(): string {
	const candidates = [
		path.join(process.cwd(), "documentation/src/content/docs/rules"),
		path.join(process.cwd(), "src/content/docs/rules"),
	];

	for (const candidate of candidates) {
		if (existsSync(candidate)) {
			return candidate;
		}
	}

	const tried = candidates.map((candidate) => `  - ${candidate}`).join("\n");
	const error = new Error(`Could not locate rules MDX directory. Tried:\n${tried}`);
	Error.captureStackTrace(error, resolveRulesDirectory);
	throw error;
}

const rulesDirectory = resolveRulesDirectory();

function extractFrontmatterBlock(source: string): string | undefined {
	if (!source.startsWith("---")) {
		return undefined;
	}

	const endIndex = source.indexOf("\n---", 3);
	if (endIndex === -1) {
		return undefined;
	}

	return source.slice(3, endIndex).trim();
}

function parseBadgeList(frontmatter: string): Array<RuleFrontmatterBadge> {
	const badges: Array<RuleFrontmatterBadge> = [];

	const badgesBlockMatch = badgesBlockPattern.exec(frontmatter);
	if (badgesBlockMatch?.groups?.block !== undefined) {
		const { block } = badgesBlockMatch.groups;
		for (const match of block.matchAll(badgeItemPattern)) {
			const text = match.groups?.text?.trim();
			if (text === undefined || text.length === 0) {
				continue;
			}
			const variantRaw = match.groups?.variant?.trim() ?? "default";
			badges.push({
				text,
				variant: normalizePageBadgeVariant(variantRaw),
			});
		}
	}

	if (badges.length > 0) {
		return badges;
	}

	const singularMatch = singularBadgePattern.exec(frontmatter);
	if (singularMatch?.groups?.text !== undefined) {
		const text = singularMatch.groups.text.trim();
		if (text.length > 0) {
			const variantRaw = singularMatch.groups.variant?.trim() ?? "default";
			badges.push({
				text,
				variant: normalizePageBadgeVariant(variantRaw),
			});
		}
	}

	return badges;
}

function parseScalar(frontmatter: string, key: string): string | undefined {
	const pattern = new RegExp(`(?:^|\\n)${key}:\\s*["']?(?<value>[^"\\n]+)["']?`, "u");
	const match = pattern.exec(frontmatter);
	const value = match?.groups?.value?.trim();
	return value !== undefined && value.length > 0 ? value : undefined;
}

export function loadRuleFrontmatter(ruleSlugLeaf: string): RuleFrontmatterMeta {
	const filePath = path.join(rulesDirectory, `${ruleSlugLeaf}.mdx`);
	const source = readFileSync(filePath, "utf8");
	const frontmatter = extractFrontmatterBlock(source);
	if (frontmatter === undefined) {
		return { badges: [] };
	}

	const description = parseScalar(frontmatter, "description");
	const title = parseScalar(frontmatter, "title");
	const result: RuleFrontmatterMeta = {
		badges: parseBadgeList(frontmatter),
	};

	if (description !== undefined && title !== undefined) {
		return { ...result, description, title };
	}
	if (description !== undefined) {
		return { ...result, description };
	}
	if (title !== undefined) {
		return { ...result, title };
	}
	return result;
}

export function pickSidebarBadge(
	badges: ReadonlyArray<RuleFrontmatterBadge | PageBadge>,
): RuleFrontmatterBadge | undefined {
	const texts = new Set(badges.map((badge) => badge.text.toLowerCase()));

	if (texts.has("error")) {
		return { text: "error", variant: "danger" };
	}
	if (texts.has("type-aware")) {
		return { text: "TS", variant: "note" };
	}
	if (texts.has("experimental")) {
		return { text: "exp", variant: "caution" };
	}
	if (texts.has("fixable")) {
		return { text: "fix", variant: "success" };
	}
	return undefined;
}

export function rulePathToSlugLeaf(rulePath: string): string {
	const parts = rulePath.split("/");
	const leaf = parts.at(-1);
	if (leaf === undefined || leaf.length === 0) {
		const error = new Error(`Invalid rule path: ${rulePath}`);
		Error.captureStackTrace(error, rulePathToSlugLeaf);
		throw error;
	}
	return leaf;
}
