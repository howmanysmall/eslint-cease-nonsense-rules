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

// https://astro.build/config
const configuration = defineConfig({
	base: "/eslint-cease-nonsense-rules",
	integrations: [
		starlight({
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
		mdx(),
		react(),
		viewTransitions(),
		contextualMenuIntegration(),
	],
	site: "https://howmanysmall.github.io",
});

export default configuration;
