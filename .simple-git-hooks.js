const simpleGitHooks = {
	"commit-msg": 'bun x --bun commitlint --edit "$1"',
	"post-merge": "bun install",
	"pre-commit": "bun run lint-staged",
	"pre-push": "bash ./scripts/pre-push.sh",
};

export default simpleGitHooks;
