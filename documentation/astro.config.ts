import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			customCss: ["./src/styles/custom.css"],
			editLink: {
				baseUrl: "https://github.com/howmanysmall/eslint-cease-nonsense-rules/edit/main/documentation/",
			},
			sidebar: [
				{
					autogenerate: {
						directory: "rules",
					},
					label: "Rules",
				},
			],
			social: {
				github: "https://github.com/howmanysmall/eslint-cease-nonsense-rules",
			},
			title: "Cease Nonsense",
		}),
	],
	site: "https://howmanysmall.github.io/eslint-cease-nonsense-rules",
});
