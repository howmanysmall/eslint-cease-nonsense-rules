const simpleGitHooks = {
	"commit-msg": 'bun x --bun commitlint --edit "$1"',
	"post-merge": "bun install",
	"pre-commit": "bun run lint-staged",

	// simulate `ci.yaml`
	"pre-push": [
		"time bun add -D oxlint-tsgolint@latest",
		"bun run lint",
		"bun run biome:ci",
		"bun run knip",
		"bun run type-check",
		// "bun run test --bail",
		"bun run build",
	],
};

export default simpleGitHooks;
