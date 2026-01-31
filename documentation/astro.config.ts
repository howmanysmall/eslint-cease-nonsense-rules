import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import viewTransitions from "astro-vtbot";
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
					items: [
						{ label: "Introduction", link: "/" },
						{ label: "Installation", link: "/#quick-start" },
					],
					label: "Getting Started",
				},
				{
					items: [
						"rules/ban-react-fc",
						"rules/no-god-components",
						"rules/no-memo-children",
						"rules/no-useless-use-spring",
						"rules/react-hooks-strict-return",
						"rules/require-react-component-keys",
						"rules/require-react-display-names",
						"rules/strict-component-boundaries",
						"rules/use-exhaustive-dependencies",
						"rules/use-hook-at-top-level",
					],
					label: "React Rules",
				},
				{
					items: [
						"rules/ban-instances",
						"rules/enforce-ianitor-check-type",
						"rules/fast-format",
						"rules/misleading-lua-tuple-checks",
						"rules/no-color3-constructor",
						"rules/prefer-udim2-shorthand",
						"rules/require-module-level-instantiation",
						"rules/require-serialized-numeric-data-type",
					],
					label: "Roblox & Luau Rules",
				},
				{
					items: [
						"rules/naming-convention",
						"rules/no-shorthand-names",
						"rules/prefer-pascal-case-enums",
						"rules/prefer-singular-enums",
						"rules/prevent-abbreviations",
					],
					label: "Naming & Conventions",
				},
				{
					items: [
						"rules/no-async-constructor",
						"rules/no-commented-code",
						"rules/no-identity-map",
						"rules/no-instance-methods-without-this",
						"rules/no-print",
						"rules/no-unused-imports",
						"rules/no-warn",
						"rules/prefer-class-properties",
						"rules/prefer-early-return",
						"rules/prefer-enum-item",
						"rules/prefer-enum-member",
						"rules/prefer-module-scope-constants",
						"rules/prefer-pattern-replacements",
						"rules/prefer-read-only-props",
						"rules/prefer-sequence-overloads",
						"rules/prefer-single-world-query",
						"rules/require-named-effect-functions",
						"rules/require-paired-calls",
					],
					label: "General Logic & Style",
				},
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
	],
	site: "https://howmanysmall.github.io/eslint-cease-nonsense-rules",
});
