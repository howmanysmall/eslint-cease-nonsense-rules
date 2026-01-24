import { stat } from "node:fs/promises";

export async function isDirectorySimpleAsync(path: string): Promise<boolean> {
	try {
		const stats = await stat(path);
		return stats.isDirectory();
	} catch {
		return false;
	}
}
