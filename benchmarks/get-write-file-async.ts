export type WriteFileAsync = (filePath: string, content: string | Uint8Array) => Promise<void>;

interface DenoLike {
	readonly writeTextFile: (filePath: string, content: string) => Promise<void>;
}

export default async function getWriteFileAsync(): Promise<WriteFileAsync> {
	// oxlint-disable-next-line typescript/no-unnecessary-condition
	if (globalThis.Bun) {
		return async function writeFileAsync(path: string, content: string | Uint8Array): Promise<void> {
			await Bun.write(path, content);
		};
	}

	const { Deno } = globalThis as typeof globalThis & { Deno?: DenoLike };
	if (Deno !== undefined) {
		return async function writeFileAsync(path: string, content: string | Uint8Array): Promise<void> {
			await Deno.writeTextFile(path, typeof content === "string" ? content : new TextDecoder().decode(content));
		};
	}

	const fs = await import("node:fs/promises");
	return async function writeFileAsync(path: string, content: string | Uint8Array): Promise<void> {
		await fs.writeFile(path, content);
	};
}
