export function normalizeDeclarationSupportPaths(paths: ReadonlyArray<string>): ReadonlyArray<string> {
	return [...new Set(paths)].toSorted();
}

export function getStaleDeclarationSupportPaths(
	previousPaths: ReadonlyArray<string>,
	nextPaths: ReadonlyArray<string>,
): ReadonlyArray<string> {
	const nextPathSet = new Set(nextPaths);
	return previousPaths.filter((path) => !nextPathSet.has(path)).toSorted();
}
