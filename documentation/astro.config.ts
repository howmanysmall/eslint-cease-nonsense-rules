import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import starlight from "@astrojs/starlight";
import viewTransitions from "astro-vtbot";
import { defineConfig } from "astro/config";
import starlightCodeblockFullscreen from "starlight-codeblock-fullscreen";
import starlightHeadingBadges from "starlight-heading-badges";
import starlightLinksValidator from "starlight-links-validator";
import starlightScrollToTop from "starlight-scroll-to-top";

import { ruleSidebarGroups } from "./src/data/rule-stats";
import contextualMenuIntegration from "./src/integrations/contextual-menu";

import type { AstroIntegration } from "astro";

function isAstroIntegration(value: unknown): value is AstroIntegration {
	if (typeof value !== "object" || value === null) return false;
	if (!("name" in value) || typeof value.name !== "string") return false;
	return "hooks" in value;
}

function ensureAstroIntegration(value: unknown, integrationName: string): AstroIntegration {
	if (isAstroIntegration(value)) return value;

	const error = new Error(`The ${integrationName} Astro integration did not return a valid integration object.`);
	Error.captureStackTrace(error, ensureAstroIntegration);
	throw error;
}

// https://astro.build/config
const configuration = defineConfig({
	base: "/eslint-cease-nonsense-rules",
	integrations: [
		ensureAstroIntegration(
			starlight({
				components: {
					PageTitle: "./src/components/page-title.astro",
				},
				customCss: ["./src/styles/custom.css"],
				editLink: {
					baseUrl: "https://github.com/howmanysmall/eslint-cease-nonsense-rules/edit/main/documentation/",
				},
				expressiveCode: {
					styleOverrides: {
						borderColor: "var(--glass-border)",
						borderRadius: "0.5rem",
						borderWidth: "1px",
					},
					themes: ["github-light", "dracula"],
				},
				favicon: "/favicon.svg",
				logo: {
					alt: "Cease Nonsense",
					replacesTitle: false,
					src: "./src/assets/new-logo.webp",
				},
				plugins: [
					starlightCodeblockFullscreen({
						addToUntitledBlocks: true,
						enableEscapeKey: true,
						exitOnBrowserBack: true,
						fullscreenButtonTooltip: "View in fullscreen",
					}),
					starlightLinksValidator(),
					starlightScrollToTop({
						smoothScroll: true,
					}),
					starlightHeadingBadges(),
				],
				sidebar: [
					{
						items: [
							{ label: "Home", slug: "" },
							{ label: "Introduction", slug: "introduction" },
							{ label: "Quick Start", slug: "quick-start" },
							{ label: "Configuration", slug: "configuration" },
							{ label: "Changelog", slug: "changelog" },
						],
						label: "Getting Started",
					},
					...ruleSidebarGroups,
				],
				social: [
					{
						href: "https://github.com/howmanysmall/eslint-cease-nonsense-rules",
						icon: "github",
						label: "GitHub",
					},
					{
						href: "https://www.npmjs.com/package/eslint-plugin-cease-nonsense",
						icon: "external",
						label: "NPM Package",
					},
				],
				title: "Cease Nonsense",
			}),
			"starlight",
		),
		ensureAstroIntegration(mdx(), "@astrojs/mdx"),
		ensureAstroIntegration(react(), "@astrojs/react"),
		ensureAstroIntegration(viewTransitions(), "astro-vtbot"),
		ensureAstroIntegration(contextualMenuIntegration(), "contextual-menu"),
	],
	site: "https://howmanysmall.github.io",
	vite: {
		build: {
			rolldownOptions: {
				output: {
					// Consistent hashing for long-term caching
					assetFileNames: "_astro/[name].[hash][extname]",
					chunkFileNames: "_astro/[name].[hash].js",
					entryFileNames: "_astro/[name].[hash].js",
				},
			},
		},
	},
});

export default configuration;
