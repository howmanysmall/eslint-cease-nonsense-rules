import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import starlightCodeblockFullscreen from "starlight-codeblock-fullscreen";
import starlightContextualMenu from "starlight-contextual-menu";
import starlightHeadingBadges from "starlight-heading-badges";
import starlightLinksValidator from "starlight-links-validator";
import starlightScrollToTop from "starlight-scroll-to-top";
import starlightSiteGraph from "starlight-site-graph";

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			customCss: ["./src/styles/custom.css"],
			editLink: {
				baseUrl: "https://github.com/howmanysmall/eslint-cease-nonsense-rules/edit/main/documentation/",
			},
			plugins: [
				starlightCodeblockFullscreen({
					addToUntitledBlocks: true,
					enableEscapeKey: true,
					exitOnBrowserBack: true,
					fullscreenButtonTooltip: "View in fullscreen",
				}),
				starlightContextualMenu({}),
				starlightLinksValidator({}),
				starlightSiteGraph({}),
				starlightScrollToTop({
					smoothScroll: true,
				}),
				starlightHeadingBadges(),
			],
			sidebar: [
				{
					autogenerate: {
						directory: "rules",
					},
					label: "Rules",
				},
			],
			social: [
				{
					href: "https://github.com/howmanysmall/eslint-cease-nonsense-rules",
					icon: "github",
					label: "GitHub",
				},
			],
			title: "Cease Nonsense",
		}),
		mdx(),
		react(),
	],
	site: "https://howmanysmall.github.io/eslint-cease-nonsense-rules",
});
