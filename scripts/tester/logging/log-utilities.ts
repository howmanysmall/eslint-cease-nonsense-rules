import { memoryUsage } from "node:process";
import { nanoseconds } from "bun";
import type { ConsolaInstance } from "consola";
import prettyBytes from "pretty-bytes";
import log from "./log";

export interface Context {
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

/**
 * Measures the duration of a synchronous function and logs it.
 *
 * @param name - The name of the operation to measure.
 * @param callback - The function to execute.
 * @returns The result of the function.
 */
export function measure<Value>(name: string, callback: () => Value): Value {
	const start = nanoseconds();
	try {
		return callback();
	} finally {
		const duration = (nanoseconds() - start) / 1_000_000;
		log.info(`Performance measure: ${name}`, { performance: { duration, name } });
	}
}

/**
 * Measures the duration of an asynchronous function and logs it.
 *
 * @param name - The name of the operation to measure.
 * @param callback - The async function to execute.
 * @returns The result of the function.
 */
export async function measureAsync<Value>(name: string, callback: () => Promise<Value>): Promise<Value> {
	const start = nanoseconds();
	try {
		return await callback();
	} finally {
		const duration = (nanoseconds() - start) / 1_000_000;
		log.info(`Performance measure: ${name}`, { performance: { duration, name } });
	}
}

/**
 * Logs current system statistics (memory usage).
 */
export function logSystemStats(): void {
	const memory = memoryUsage();
	log.info("System Stats", {
		memory: {
			external: prettyBytes(memory.external),
			heapTotal: prettyBytes(memory.heapTotal),
			heapUsed: prettyBytes(memory.heapUsed),
			rss: prettyBytes(memory.rss),
		},
	});
}

/**
 * Attempts to force garbage collection if the environment allows it.
 * Useful for debugging memory leaks.
 */
export function tryGarbageCollection(): void {
	if (typeof globalThis.gc === "function") {
		globalThis.gc();
		log.debug("Garbage collection triggered manually");
	} else log.warn("Garbage collection is not exposed. Run with --expose-gc to enable.");
}
