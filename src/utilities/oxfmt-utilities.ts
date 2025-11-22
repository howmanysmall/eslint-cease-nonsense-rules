import { format, formatEmbeddedCode } from "oxfmt";

export type JsFormatEmbeddedCb = (tagName: string, code: string) => Promise<string>;

/**
 * A wrapped NAPI entry point with better type support.
 *
 * JS side passes in:
 * 1. `args`: Command line arguments (process.argv.slice(2))
 * 2. `format_embedded_cb`: Callback to format embedded code in templates
 *
 * @param parameters - Command line arguments, typically `process.argv.slice(2)`.
 * @param formatEmbeddedCb - Callback to format embedded code in templates
 * @returns Returns `true` if formatting succeeded without errors, `false` otherwise.
 */
export async function formatAsync(
	parameters: ReadonlyArray<string>,
	formatEmbeddedCb: JsFormatEmbeddedCb,
): Promise<boolean> {
	return format([...parameters], formatEmbeddedCb);
}

/**
 * Format embedded code using Prettier (synchronous).
 * Note: Called from Rust via NAPI ThreadsafeFunction with FnArgs
 *
 * @param tagName - The template tag name (e.g., "css", "gql", "html")
 * @param code - The code to format
 * @returns Formatted code
 */
export async function formatEmbeddedCodeAsync(tagName: string, code: string): Promise<string> {
	return formatEmbeddedCode(tagName, code);
}
