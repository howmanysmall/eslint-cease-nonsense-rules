import { dirname } from "node:path";
import { ResolverFactory } from "oxc-resolver";

type ResolveResult =
	| { readonly found: false }
	| {
			readonly found: true;
			readonly path: string;
	  };

const resolver = new ResolverFactory({
	extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".node"],
});

/**
 * Resolves a relative import to an absolute path.
 *
 * @param importSource - The import specifier (e.g., "./foo/bar").
 * @param sourceFile - The absolute path of the file containing the import.
 * @returns Resolution result with path if found.
 */
export function resolveRelativeImport(importSource: string, sourceFile: string): ResolveResult {
	if (!importSource.startsWith(".")) return { found: false };

	const { path } = resolver.sync(dirname(sourceFile), importSource);
	if (path === undefined || path === "") return { found: false };
	return { found: true, path };
}
