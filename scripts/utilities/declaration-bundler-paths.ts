import { parseTsconfig } from "get-tsconfig";

export function readDeclarationBundlerPaths(
	tsconfigPathsFilePath: string,
	sourceDirectoryName: string,
): Record<string, Array<string>> {
	try {
		const tsconfig = parseTsconfig(tsconfigPathsFilePath);
		const paths = tsconfig.compilerOptions?.paths;
		if (paths === undefined) return {};

		const mappedPaths: Record<string, Array<string>> = {};
		for (const [alias, targets] of Object.entries(paths)) {
			mappedPaths[alias] = targets.map((target) => convertPathTarget(target, sourceDirectoryName));
		}

		return mappedPaths;
	} catch {
		return {};
	}
}

function convertPathTarget(target: string, sourceDirectoryName: string): string {
	const normalizedTarget = target.startsWith("./") ? target.slice(2) : target;
	const sourceDirectoryPrefix = `${sourceDirectoryName}/`;
	const relativeTarget = normalizedTarget.startsWith(sourceDirectoryPrefix)
		? normalizedTarget.slice(sourceDirectoryPrefix.length)
		: normalizedTarget;

	if (relativeTarget.endsWith(".d.ts")) return relativeTarget;
	if (relativeTarget.endsWith(".tsx")) return `${relativeTarget.slice(0, -4)}.d.ts`;
	if (relativeTarget.endsWith(".ts")) return `${relativeTarget.slice(0, -3)}.d.ts`;
	return relativeTarget;
}
