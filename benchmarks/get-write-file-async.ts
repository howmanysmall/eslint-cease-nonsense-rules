import { writeFile } from "node:fs/promises";

export type WriteFileAsync = (filePath: string, content: string | Uint8Array) => Promise<void>;

export default function getWriteFileAsync(): WriteFileAsync {
	return async function writeFileAsync(path: string, content: string | Uint8Array): Promise<void> {
		await writeFile(path, content);
	};
}
