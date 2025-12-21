import type { Rule } from "eslint";

interface Options {
	readonly allow?: ReadonlyArray<string>;
	readonly maxDepth?: number;
}

// PascalCase: starts with uppercase, followed by lowercase/digits, then optionally more PascalCase segments
// Excludes files (anything with a dot)
const PASCAL_CASE = /^[A-Z][a-zA-Z0-9]*$/;

/**
 * Checks if a path segment is PascalCase (component folder).
 * Returns false for files (segments containing dots).
 * @param segment - The path segment to check
 * @returns True if the segment is PascalCase
 */
function isPascalCase(segment: string): boolean {
	if (segment.includes(".")) return false;
	return PASCAL_CASE.test(segment);
}

/**
 * Checks if the current file is inside a component folder.
 * A component folder is any PascalCase directory in the file's path.
 * @param filename - The file path to check
 * @returns True if the file is inside a component folder
 */
function isInComponent(filename: string): boolean {
	const parts = filename.split("/");
	parts.pop();
	return parts.some((part) => isPascalCase(part));
}

/**
 * Parses an import path into segments, filtering out `.` and `..`.
 * @param importSource - The import source path
 * @returns Array of path segments
 */
function parseImportSegments(importSource: string): Array<string> {
	return importSource.split("/").filter((segment) => segment !== "." && segment !== "..");
}

const strictComponentBoundaries: Rule.RuleModule = {
	create(context) {
		const options = (context.options[0] as Options | undefined) ?? {};
		const allowPatterns = (options.allow ?? []).map((pattern) => new RegExp(pattern, "i"));
		const maxDepth = options.maxDepth ?? 1;

		return {
			ImportDeclaration(node): void {
				const importSource = node.source.value;
				if (typeof importSource !== "string") return;

				// Skip non-relative imports (packages, aliases, etc.)
				if (!importSource.startsWith(".")) return;

				// Skip if matches any allow pattern
				if (allowPatterns.some((re) => re.test(importSource))) return;

				const segments = parseImportSegments(importSource);
				if (segments.length === 0) return;

				// Find indices of key segments
				const fixturesIndex = segments.indexOf("fixtures");
				const firstPascalIndex = segments.findIndex((segment) => isPascalCase(segment));

				// If fixtures appears before any PascalCase component, it's a valid fixture import
				if (fixturesIndex !== -1 && (firstPascalIndex === -1 || fixturesIndex < firstPascalIndex)) {
					return;
				}

				// If no PascalCase in the path, it's valid
				if (firstPascalIndex === -1) return;

				const filename = context.filename ?? "";
				if (!filename) return;
				const inComponent = isInComponent(filename);

				if (inComponent) {
					// When inside a component, allow sibling component imports
					// But flag if we go into another component and deeper
					const segmentsAfterPascal = segments.slice(firstPascalIndex + 1);
					if (segmentsAfterPascal.length > 0) {
						context.report({
							message: `Do not reach into an individual component's folder for nested modules. Import from the closest shared components folder instead.`,
							node,
						});
					}
				} else if (segments.length > maxDepth) {
					// When not in a component, check depth
					context.report({
						message: `Do not reach into an individual component's folder for nested modules. Import from the closest shared components folder instead.`,
						node,
					});
				}
			},
		};
	},
	meta: {
		docs: {
			description: "Prevent module imports between components.",
			recommended: false,
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					allow: {
						items: { type: "string" },
						type: "array",
					},
					maxDepth: {
						type: "integer",
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
};

export default strictComponentBoundaries;
