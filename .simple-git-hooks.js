const simpleGitHooks = {
	"commit-msg": 'bun x --bun commitlint --edit "$1"',
	"post-merge": "bun install",
	"pre-commit": "bun run lint-staged",

	// Simulate `ci.yaml`
	"pre-push": [
		"bun add -D oxlint-tsgolint@latest",
		"bun run biome:ci",
		"bun run oxc .",
		"bun run type-check",
		"bun run knip",
		"bun run build",
	],
};

export default simpleGitHooks;
