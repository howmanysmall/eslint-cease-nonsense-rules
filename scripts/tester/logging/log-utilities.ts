import type { ConsolaInstance } from "consola";
import log from "./log";

interface Context {
	readonly namespace?: string;
	readonly scope?: string;
	readonly tag?: string;
}

/**
 * Creates a child logger bound to the provided context.
 *
 * @param context - Key-value pairs to attach to every log emitted by this logger.
 * @returns A Consola Logger instance with the bound context.
 */
export function withContext(context: Context): ConsolaInstance {
	let instance = log;

	if (typeof context.namespace === "string") instance = instance.withTag(context.namespace);
	if (typeof context.scope === "string") instance = instance.withTag(context.scope);
	if (typeof context.tag === "string") instance = instance.withTag(context.tag);

	return instance;
}
