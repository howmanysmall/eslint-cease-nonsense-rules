import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

type MessageIds = "noReachingIntoComponent";

interface Options {
	readonly allow?: ReadonlyArray<string>;
	readonly maxDepth?: number;
}

const PASCAL_CASE = /^[A-Z][a-zA-Z0-9]*$/;
function isPascalCase(segment: string): boolean {
	if (segment.includes(".")) return false;
	return PASCAL_CASE.test(segment);
}

function isInComponent(filename: string): boolean {
	const parts = filename.split("/");
	parts.pop();
	return parts.some((part) => isPascalCase(part));
}

function parseImportSegments(importSource: string): ReadonlyArray<string> {
	return importSource.split("/").filter((segment) => segment !== "." && segment !== "..");
}

const strictComponentBoundaries: TSESLint.RuleModuleWithMetaDocs<MessageIds, [Options?]> = {
	create(context) {
		const [{ allow = [], maxDepth = 1 } = {}] = context.options;
		const allowPatterns = allow.map((pattern) => new RegExp(pattern, "i"));

		return {
			ImportDeclaration(node: TSESTree.ImportDeclaration): void {
				const importSource = node.source.value;
				if (typeof importSource !== "string") return;
				if (!importSource.startsWith(".")) return;
				if (allowPatterns.some((regexp) => regexp.test(importSource))) return;

				const segments = parseImportSegments(importSource);
				if (segments.length === 0) return;

				const fixturesIndex = segments.indexOf("fixtures");
				const firstPascalIndex = segments.findIndex((segment) => isPascalCase(segment));

				if (fixturesIndex !== -1 && (firstPascalIndex === -1 || fixturesIndex < firstPascalIndex)) return;
				if (firstPascalIndex === -1) return;

				const filename = context.filename ?? "";
				if (!filename) return;
				const inComponent = isInComponent(filename);

				if (inComponent) {
					const segmentsAfterPascal = segments.slice(firstPascalIndex + 1);
					if (segmentsAfterPascal.length > 0) {
						context.report({
							messageId: "noReachingIntoComponent",
							node,
						});
					}
				} else if (segments.length > maxDepth) {
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
};

export default strictComponentBoundaries;
