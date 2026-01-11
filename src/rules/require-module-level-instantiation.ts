import { ScopeType } from "@typescript-eslint/scope-manager";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import Typebox from "typebox";
import { Compile } from "typebox/compile";
import type { ReadonlyRecord } from "../types/utility-types";
import { createRule } from "../utilities/create-rule";

/**
 * Configuration for classes that must be instantiated at module level.
 *
 * Maps class names to their expected import sources.
 *
 * @example
 * ```typescript
 * {
 *   classes: {
 *     "Log": "@rbxts/rbxts-sleitnick-log",
 *     "Server": "@rbxts/net"
 *   }
 * }
 * ```
 */
export interface RequireModuleLevelInstantiationOptions {
	readonly classes: ReadonlyRecord<string, string>;
}

type Options = [RequireModuleLevelInstantiationOptions?];
type MessageIds = "mustBeModuleLevel";

const isOptionsObject = Compile(
	Typebox.Object({
		classes: Typebox.Record(Typebox.String(), Typebox.String()),
	}),
);

interface TrackedImport {
	readonly className: string;
	readonly source: string;
}

interface NormalizedConfig {
	readonly trackedImports: ReadonlyMap<string, TrackedImport>;
}

function normalizeConfig(options: unknown): NormalizedConfig {
	if (!isOptionsObject.Check(options)) return { trackedImports: new Map() };

	const { classes } = options;
	const trackedImports = new Map<string, TrackedImport>();

	for (const [className, source] of Object.entries(classes)) {
		trackedImports.set(className, { className, source });
	}

	return { trackedImports };
}

function isTopScope(scope: TSESLint.Scope.Scope): boolean {
	const { type } = scope;
	return type === ScopeType.module || type === ScopeType.global;
}

export default createRule<Options, MessageIds>({
	create(context) {
		const config = normalizeConfig(context.options[0]);

		if (config.trackedImports.size === 0) return {};

		// Map of local binding names to their tracked import info
		const localBindings = new Map<string, TrackedImport>();

		return {
			ImportDeclaration(node: TSESTree.ImportDeclaration): void {
				const source = node.source.value;

				for (const specifier of node.specifiers) {
					// Check if the import source matches any of our tracked classes
					for (const [className, tracked] of config.trackedImports) {
						if (tracked.source !== source) continue;

						// Default import: import Log from "..."
						if (
							specifier.type === AST_NODE_TYPES.ImportDefaultSpecifier &&
							specifier.local.name === className
						) {
							localBindings.set(specifier.local.name, tracked);
						}

						// Named import: import { Log } from "..." or import { Log as Logger } from "..."
						if (specifier.type === AST_NODE_TYPES.ImportSpecifier) {
							const importedName =
								specifier.imported.type === AST_NODE_TYPES.Identifier
									? specifier.imported.name
									: specifier.imported.value;

							if (importedName === className) {
								localBindings.set(specifier.local.name, tracked);
							}
						}

						// Namespace import: import * as Lib from "..." - track if accessing Lib.ClassName
						// We'll handle this in NewExpression by checking member expressions
					}
				}
			},

			NewExpression(node: TSESTree.NewExpression): void {
				let trackedInfo: TrackedImport | undefined;
				let calleeName: string | undefined;

				// Direct identifier: new Log()
				if (node.callee.type === AST_NODE_TYPES.Identifier) {
					calleeName = node.callee.name;
					trackedInfo = localBindings.get(calleeName);
				}

				// Member expression: new Lib.Log() for namespace imports
				if (node.callee.type === AST_NODE_TYPES.MemberExpression) {
					const { property } = node.callee;
					if (property.type === AST_NODE_TYPES.Identifier) {
						calleeName = property.name;
						// Check if this class name is in our config (for namespace imports)
						trackedInfo = config.trackedImports.get(calleeName);
					}
				}

				if (!(trackedInfo && calleeName)) return;

				// Check if we're at module scope
				const scope = context.sourceCode.getScope(node);
				if (isTopScope(scope)) return;

				context.report({
					data: {
						className: trackedInfo.className,
						source: trackedInfo.source,
					},
					messageId: "mustBeModuleLevel",
					node,
				});
			},
		};
	},
	defaultOptions: [{ classes: {} }],
	meta: {
		docs: {
			description:
				"Require certain classes to be instantiated at module level rather than inside functions. Classes like Log should be instantiated once at module scope, not recreated on every function call.",
		},
		messages: {
			mustBeModuleLevel:
				"'{{className}}' from '{{source}}' must be instantiated at module level, not inside a function. Move `new {{className}}()` to the top of the file outside any function body. Instantiating inside functions recreates the object on every call, which wastes resources and may cause unexpected behavior.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					classes: {
						additionalProperties: { type: "string" },
						description:
							"Map of class names to their import sources. Classes imported from these sources must be instantiated at module level.",
						type: "object",
					},
				},
				required: ["classes"],
				type: "object",
			},
		],
		type: "problem",
	},
	name: "require-module-level-instantiation",
});
