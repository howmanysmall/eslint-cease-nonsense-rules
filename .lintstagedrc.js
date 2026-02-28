/** @type {import("lint-staged").Configuration} */
const configuration = {
	"*.{css,html,json,jsonc,grit,code-workspace}": ["bun run biome:check --write --no-errors-on-unmatched"],
	"*.{js,jsx,ts,tsx}": [
		"bun run oxc --fix",
		"bun run biome:check --write --no-errors-on-unmatched",
		"bun run format",
	],
	"*.{json5,mdx}": ["bun run format"],
	"*.md": ["rumdl check --fix", "rumdl fmt"],
	"*.toml": ["tombi lint", "tombi format"],
};

// oxlint-disable-next-line import/no-default-export
export default configuration;
