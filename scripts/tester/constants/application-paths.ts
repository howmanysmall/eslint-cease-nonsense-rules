import type { Paths } from "env-paths";
import envPaths from "env-paths";

import { name } from "./package-constants";

// oxlint-disable-next-line no-control-regex
const NULL_REGEXP = /[/\\\0]/g;
const WHITESPACE_REGEXP = /\s+/g;

const USE_UNNAMED = new Set(["", ".", ".."]);

function makeSafeFileName(name: string): string {
	const out = name.trim().replaceAll(NULL_REGEXP, "-").replaceAll(WHITESPACE_REGEXP, " ").trim();
	if (USE_UNNAMED.has(out) || out.includes("/") || out.includes("\\") || out.includes("\0")) return "unnamed";
	return out;
}

/**
 * Provides platform-specific paths for storing application data, configuration,
 * cache, log, and temporary files. Utilizes the `env-paths` package to generate
 * these paths based on the application's name.
 *
 * The returned `Paths` object contains properties such as `data`, `config`,
 * `cache`, `log`, and `temp`, which are resolved according to the current
 * operating system's conventions.
 * @example
 *
 * ```typescript
 * import applicationPaths from "./constants/application-paths";
 * console.log(applicationPaths.data); // Prints the path for application data storage
 * ```
 *
 * @see {@link https://www.npmjs.com/package/env-paths | env-paths documentation}
 */
const applicationPaths: Paths = envPaths(makeSafeFileName(name));

export default applicationPaths;
