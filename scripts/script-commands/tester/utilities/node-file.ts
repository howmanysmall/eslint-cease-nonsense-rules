import { readFile, stat, unlink, writeFile } from "node:fs/promises";

import type { Stats } from "node:fs";

const textDecoder = new TextDecoder();

/**
 * A fully Node compatible reimplementation of the `BunFile` API from Bun.
 */
class NodeFile {
	public readonly name: string;

	public constructor(name: string) {
		this.name = name;
	}

	public async exists(): Promise<boolean> {
		try {
			const stats = await stat(this.name);
			return stats.isFile();
		} catch {
			return false;
		}
	}

	public async unlink(): Promise<void> {
		await unlink(this.name);
	}

	/**
	 * Deletes the file (same as unlink).
	 */
	public async delete(): Promise<void> {
		await unlink(this.name);
	}

	public async stat(): Promise<Stats> {
		return stat(this.name);
	}

	public async arrayBuffer(): Promise<ArrayBuffer> {
		await this.stat();
		const buffer = await readFile(this.name);
		return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
	}

	public async text(): Promise<string> {
		// Do NOT use `Bun` APIs dickhead.
		const buffer = await this.arrayBuffer();
		return textDecoder.decode(buffer);
	}

	public async json(): Promise<unknown> {
		return JSON.parse(await this.text());
	}

	public async write(
		data: string | ArrayBufferView | ArrayBuffer | SharedArrayBuffer | Request | Response | NodeFile,
		_options?: { highWaterMark?: number },
	): Promise<number> {
		// Convert input into Buffer so we can use Node's writeFile
		let buffer: Buffer;

		if (typeof data === "string") buffer = Buffer.from(data);
		else if (ArrayBuffer.isView(data)) buffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
		else if (data instanceof ArrayBuffer || data instanceof SharedArrayBuffer) buffer = Buffer.from(data);
		else if (data instanceof NodeFile) buffer = Buffer.from(await data.arrayBuffer());
		else if (typeof Request !== "undefined" && data instanceof Request) {
			if (data.body === null || data.body === undefined) buffer = Buffer.from("");
			else {
				const arrayBuffer = await new Response(data.body).arrayBuffer();
				buffer = Buffer.from(arrayBuffer);
			}
		} else if (typeof Response !== "undefined" && data instanceof Response) {
			buffer = Buffer.from(await data.arrayBuffer());
			// oxlint-disable-next-line typescript/no-base-to-string
		} else buffer = Buffer.from(String(data));

		await writeFile(this.name, buffer);
		return buffer.length;
	}
}

export function file(name: string): NodeFile {
	return new NodeFile(name);
}

export type { NodeFile };
