/**
 * @type {import('simple-git-hooks').SimpleGitHooks}
 */
const simpleGitHooks = {
	"commit-msg": 'bun x --bun commitlint --edit "$1"',
	"post-merge": "bun install",
	"pre-commit": "bun run lint-staged",
	"pre-push": "bun run type-check && bun run lint",
};

export default simpleGitHooks;
