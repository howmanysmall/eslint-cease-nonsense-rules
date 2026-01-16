#!/usr/bin/env bun

import { cp, mkdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { exit } from "node:process";
import { Command } from "@jsr/cliffy__command";
import { CompletionsCommand } from "@jsr/cliffy__command/completions";

const SKIP_PATTERNS = new Set([
	".git",
	"node_modules",
	"dist",
	"build",
	"out",
	".next",
	".turbo",
	".cache",
	".parcel-cache",
	".vite",
	"coverage",
	".nyc_output",
]);

function shouldSkip(relativePath: string): boolean {
	const segments = relativePath.split("/");

	for (const segment of segments) {
		if (SKIP_PATTERNS.has(segment) || segment === ".DS_Store" || segment.endsWith(".log")) return true;
	}

	return false;
}

async function findMainWorktreeAsync(): Promise<string | undefined> {
	const output = await Bun.$`git worktree list --porcelain`.text();
	const lines = output.split("\n");

	for (const line of lines) {
		if (!line.startsWith("worktree ")) continue;

		const worktreePath = line.slice(9).trim();
		const gitPath = join(worktreePath, ".git");

		try {
			// oxlint-disable-next-line no-await-in-loop -- Sequential check needed to return early on first match
			const stats = await stat(gitPath);
			if (stats.isDirectory()) return worktreePath;
		} catch {
			// .git doesn't exist or isn't accessible, skip
		}
	}

	return undefined;
}

async function fileExistsAsync(path: string): Promise<boolean> {
	try {
		const stats = await stat(path);
		return stats.isFile();
	} catch {
		return false;
	}
}

async function isRepositoryAsync(): Promise<boolean> {
	try {
		const output = await Bun.$`git rev-parse --is-inside-work-tree`.text();
		return output.trim() === "true";
	} catch {
		return false;
	}
}

const command = new Command()
	.name("clone-ignored-from-main")
	.description(
		"Copies gitignored files from the repo's MAIN worktree into the CURRENT worktree, excluding common junk (node_modules, dist/build/out, caches, .git, etc).",
	)
	.version("1.0.0")
	.option("--dry-run", "Print what would be copied.", { default: false })
	.option("--overwrite", "Overwrite existing files in destination.", { default: false })
	.action(async ({ dryRun, overwrite }) => {
		const isRepository = await isRepositoryAsync();
		if (!isRepository) {
			console.error("Not inside a Git worktree.");
			exit(1);
		}

		const destRootRaw = await Bun.$`git rev-parse --show-toplevel`.text();
		const destRoot = destRootRaw.trim();

		const mainRoot = await findMainWorktreeAsync();
		if (!mainRoot) {
			console.error("Could not determine main worktree path.");
			exit(1);
		}

		if (mainRoot === destRoot) {
			console.error("You are in the main worktree already; nothing to copy.");
			exit(1);
		}

		const ignoredOutput = await Bun.$`git -C ${mainRoot} ls-files -z -o -i --exclude-standard`.text();
		const ignoredFiles = ignoredOutput.split("\0").filter(Boolean);

		if (ignoredFiles.length === 0) {
			console.info("No ignored files found in main worktree.");
			return;
		}

		const filesToCopy = ignoredFiles.filter((file) => !shouldSkip(file));

		if (filesToCopy.length === 0) {
			console.info("Ignored files exist in main worktree, but all were excluded by filters.");
			return;
		}

		console.info(`SRC (main worktree): ${mainRoot}`);
		console.info(`DEST (current):      ${destRoot}`);
		console.info(`Paths selected:      ${filesToCopy.length}`);
		console.info(
			`Mode:                ${dryRun ? "dry-run" : "copy"}, ${overwrite ? "overwrite" : "no-overwrite"}`,
		);

		let copied = 0;
		let skipped = 0;

		for (const relativePath of filesToCopy) {
			const src = join(mainRoot, relativePath);
			const dst = join(destRoot, relativePath);

			// oxlint-disable-next-line no-await-in-loop -- Sequential file operations are safer
			if (!overwrite && (await fileExistsAsync(dst))) {
				skipped += 1;
				continue;
			}

			if (dryRun) {
				console.info(`Would copy: ${relativePath}`);
				copied += 1;
				continue;
			}

			// oxlint-disable-next-line no-await-in-loop -- Sequential file operations are safer
			await mkdir(dirname(dst), { recursive: true });
			// oxlint-disable-next-line no-await-in-loop -- Sequential file operations are safer
			await cp(src, dst);
			copied += 1;
		}

		if (dryRun) console.info(`Would copy ${copied} files (${skipped} skipped, already exist).`);
		else console.info(`Copied ${copied} files (${skipped} skipped, already exist).`);
	})
	.command("completions", new CompletionsCommand());

await command.parse(Bun.argv.slice(2));
