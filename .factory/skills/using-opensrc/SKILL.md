---
name: using-opensrc
description: Fetch and index npm package or public GitHub repo source code into ./opensrc/ so coding agents can inspect implementation details (not just types/docs) when debugging, reasoning about behavior, or tracing internals.
license: Apache-2.0
compatibility: Requires Node.js + npm (or npx) and network access. Uses git under the hood to fetch repos/tags. Writes to ./opensrc/ in the current project.
metadata:
  tool: opensrc
  primary-command: "opensrc <package|repo> [--modify[=true|false]]"
  outputs:
    settings: "opensrc/settings.json"
    index: "opensrc/sources.json"
---

# opensrc skill

Use this skill when you need **implementation context** for an npm dependency or a public GitHub repo (e.g., to confirm runtime behavior, inspect edge cases, trace code paths, or validate assumptions that types/docs don't capture).

## Activation criteria (when to use)
Activate this skill if the task requires any of:
- Understanding **actual runtime behavior** beyond types/docs (e.g., default options, error paths, env-dependent branches).
- Investigating a suspected bug/regression in a dependency.
- Locating the exact code behind a public API method.
- Comparing behavior across versions.

Do **not** activate if:
- Types/docs answer the question directly.
- The target is a **private repo** or requires credentials you don't have.

## What this skill does (high-level)
- Fetches source for:
  - **npm packages** (auto-detect installed version via lockfile; or explicit `pkg@x.y.z`)
  - **public GitHub repos** (via `owner/repo`, `github:owner/repo`, or a GitHub URL; optional `@tag` or `#branch`)
- Stores source in:
  - `opensrc/<package-name>/` for packages
  - `opensrc/<owner--repo>/` for GitHub repos
- Maintains an index at `opensrc/sources.json` and preferences at `opensrc/settings.json`.

## Workflow (do this in order)

### 1) Check what's already fetched
- If `opensrc/sources.json` exists, read it to see whether the target is already available and at what version/path.

### 2) Decide the fetch target
- For npm deps:
  - Prefer `opensrc <name>` (lets opensrc match your installed version from lockfile).
  - Use `opensrc <name>@<version>` only if you explicitly need a specific version.
- For GitHub:
  - Use `opensrc owner/repo` (or URL) and optionally pin `@tag` or `#branch` when reproducibility matters.

### 3) Run opensrc
- Default:
  - `opensrc <target>`
- If you want to avoid interactive prompts in automation:
  - Allow modifications: `opensrc <target> --modify`
  - Deny modifications: `opensrc <target> --modify=false`

### 4) Confirm outputs
After completion, verify:
- `opensrc/sources.json` contains an entry for the target with name/version/path.
- The directory `opensrc/<...>/` exists and includes the expected source layout.

### 5) Use the fetched code
- When referencing implementation details, prefer quoting file paths + identifiers (file, function, lines if available in your environment).
- If multiple packages/repos were fetched, use `opensrc list` to confirm names and avoid ambiguity.

## Commands cheat sheet
### npm
- Fetch matching installed version: `opensrc zod`
- Fetch pinned version: `opensrc zod@3.22.0`
- Fetch multiple: `opensrc react react-dom next`

### GitHub
- `opensrc github:owner/repo`
- `opensrc owner/repo`
- `opensrc https://github.com/owner/repo`
- Pin tag/branch:
  - `opensrc owner/repo@v1.0.0`
  - `opensrc owner/repo#main`

### Manage
- List: `opensrc list`
- Remove: `opensrc remove zod` / `opensrc remove owner--repo`

## Edge cases and how to handle them
- **Repo URL missing or mismatched tags (npm):**
  - If opensrc can't map the package version to a git tag, fall back to fetching the repo default branch (`opensrc owner/repo#main`) and note that the code may not match the installed version.
- **Monorepos:**
  - Expect the package to live under `packages/*` or similar; search within `opensrc/<target>/` for the package name.
- **Lockfile not present:**
  - opensrc can't auto-detect; use an explicit `pkg@version` or fetch the GitHub repo directly.
- **Disk size / noise:**
  - Prefer removing unused sources via `opensrc remove ...` once investigation is complete.

## Safety / hygiene
- Treat fetched code as third-party content; do not modify dependency source under `opensrc/` unless you are intentionally patching for analysis.
- If `--modify` is enabled, opensrc may update `.gitignore`, `tsconfig.json`, and `AGENTS.md`; verify diffs are acceptable for the project.

## Minimal examples (agent-facing)
- "Behavior differs from types; fetch source for the installed dependency and inspect implementation." → `opensrc <dep>`
- "Need to confirm behavior in a specific tag." → `opensrc owner/repo@<tag>`
- "Update local cache to match current lockfile." → re-run `opensrc <dep>`