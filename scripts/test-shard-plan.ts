import { readdir } from "node:fs/promises";
import path from "node:path";
import { cwd } from "node:process";

async function walkDirectoryAsync(directory: string, results: Array<string>): Promise<void> {
	const entries = await readdir(directory, { withFileTypes: true });
	await Promise.all(
		entries.map(async (entry): Promise<void> => {
			const fullPath = path.resolve(directory, entry.name);
			if (entry.isDirectory()) {
				await walkDirectoryAsync(fullPath, results);
			} else if (entry.isFile() && entry.name.endsWith(".test.ts")) {
				results.push(path.relative(cwd(), fullPath));
			}
		}),
	);
}

export async function collectAllTestsAsync(rootDirectory: string): Promise<ReadonlyArray<string>> {
	const results = new Array<string>();
	await walkDirectoryAsync(path.resolve(rootDirectory), results);
	return results.toSorted();
}

export function getHeavyFiles(): ReadonlyArray<string> {
	return ["tests/upstream/prevent-abbreviations.test.ts"];
}

export async function selectNormalShardFilesAsync(
	shardIndex: number,
	totalShards: number,
): Promise<ReadonlyArray<string>> {
	const allFiles = await collectAllTestsAsync("tests");
	const heavySet = new Set(getHeavyFiles());
	const normalFiles = allFiles.filter((file) => !heavySet.has(file));
	return normalFiles.filter((_, index) => index % totalShards === shardIndex - 1);
}

export function verifyAssignment(
	allFiles: ReadonlyArray<string>,
	normalShardSets: ReadonlyArray<ReadonlyArray<string>>,
	heavyFiles: ReadonlyArray<string>,
): { readonly issues: ReadonlyArray<string>; readonly success: boolean } {
	const normalCovered = new Set<string>();
	const issues = new Array<string>();

	for (const shardFiles of normalShardSets) {
		for (const file of shardFiles) {
			if (normalCovered.has(file)) {
				issues.push(`Duplicate in normal shards: ${file}`);
			} else {
				normalCovered.add(file);
			}
		}
	}

	const heavySet = new Set(heavyFiles);

	for (const file of allFiles) {
		if (!(normalCovered.has(file) || heavySet.has(file))) {
			issues.push(`Unassigned: ${file}`);
		}
	}

	return { issues: issues.toSorted(), success: issues.length === 0 };
}
