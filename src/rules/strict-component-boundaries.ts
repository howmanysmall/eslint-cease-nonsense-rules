import { basename, extname, relative } from "node:path";
import type { TSESTree } from "@typescript-eslint/utils";
import { toPascalCase } from "../utilities/casing-utilities";
import { createRule } from "../utilities/create-rule";
import { resolveRelativeImport } from "../utilities/resolve-import";

interface Options {
	readonly allow?: ReadonlyArray<string>;
	readonly maxDepth?: number;
}

function toRegExp(pattern: string): RegExp {
	return new RegExp(pattern, "i");
}

function pathSegmentsFromSource(source: string): ReadonlyArray<string> {
	return source.split("/").filter((part) => !part.startsWith("."));
}

function countParentTraversals(pathDiff: string): number {
	return pathDiff.split("/").filter((part) => part === "..").length;
}

function hasAnotherComponentInPath(pathParts: ReadonlyArray<string>): boolean {
	return pathParts.some((part) => part === toPascalCase(part) && !part.includes("."));
}

function hasDirectoryInPath(pathParts: ReadonlyArray<string>, directory: string): boolean {
	return pathParts.includes(directory);
}

function isIndexFile(filePath: string): boolean {
	return basename(filePath, extname(filePath)) === "index";
}

function isValidFixtureImport(pathParts: ReadonlyArray<string>): boolean {
	if (!hasDirectoryInPath(pathParts, "fixtures")) return false;

	const fixtureIndex = pathParts.indexOf("fixtures");
	const partsBeforeFixture = pathParts.slice(0, fixtureIndex);

	return !hasAnotherComponentInPath(partsBeforeFixture);
}

export default createRule<[Options], "noReachingIntoComponent">({
	create(context) {
		const [{ allow = [], maxDepth = 1 } = {}] = context.options;
		// oxlint-disable-next-line no-array-callback-reference
		const allowPatterns = allow.map(toRegExp);

		return {
			ImportDeclaration(node: TSESTree.ImportDeclaration): void {
				const importSource = node.source.value;
				if (typeof importSource !== "string" || !importSource.startsWith(".")) return;
				if (allowPatterns.some((regexp) => regexp.test(importSource))) return;

				const filename = context.filename ?? "";
				if (filename === "") return;

				const resolved = resolveRelativeImport(importSource, filename);
				if (!resolved.found) return;

				const pathDifference = relative(filename, resolved.path);
				const pathParts = pathSegmentsFromSource(pathDifference);
				const traversals = countParentTraversals(pathDifference);

				const isDescendingOnly = traversals <= 1;
				const hasComponentsDir = hasDirectoryInPath(pathParts, "components");

				if (
					(!isDescendingOnly || hasComponentsDir) &&
					hasAnotherComponentInPath(pathParts) &&
					pathParts.length > maxDepth &&
					!isIndexFile(pathDifference) &&
					!isValidFixtureImport(pathParts)
				) {
					context.report({
						messageId: "noReachingIntoComponent",
						node,
					});
					return;
				}

				if (
					hasDirectoryInPath(pathParts, "components") &&
					pathParts.length > maxDepth + 1 &&
					!isValidFixtureImport(pathParts)
				) {
					context.report({
						messageId: "noReachingIntoComponent",
						node,
					});
				}
			},
		};
	},
	defaultOptions: [{}],
	meta: {
		docs: {
			description: "Prevent module imports between components.",
		},
		messages: {
			noReachingIntoComponent:
				"Do not reach into an individual component's folder for nested modules. Import from the closest shared components folder instead.",
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
	name: "strict-component-boundaries",
});
