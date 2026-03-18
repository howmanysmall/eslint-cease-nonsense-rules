export interface InspectOptions extends Record<string, unknown> {
	readonly breakLength?: number;
	readonly colors?: boolean;
	readonly compact?: boolean;
	readonly depth?: number | null;
}
export type InspectFunction = (value: unknown, options?: InspectOptions) => string;

interface BunLike {
	readonly inspect: InspectFunction;
}
interface DenoLike extends BunLike {
	readonly writeTextFile: (filePath: string, content: string) => Promise<void>;
}
interface InGlobalThis {
	readonly Bun?: BunLike;
	readonly Deno?: DenoLike;
}

export async function getInspectAsync(): Promise<InspectFunction> {
	const { Bun, Deno } = globalThis as typeof globalThis & InGlobalThis;
	if (Bun) return Bun.inspect;
	if (Deno !== undefined) {
		const { inspect } = Deno;
		if (typeof inspect === "function") return inspect;
	}

	const { inspect } = await import("node:util");
	return inspect;
}
