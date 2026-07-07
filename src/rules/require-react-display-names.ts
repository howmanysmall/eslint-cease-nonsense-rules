import { getReactSources, isReactImport } from "$constants/react-sources";
import { createRule } from "$utilities/create-rule";
import { isNamedReactHookCall } from "$utilities/react-hook-utilities";
import { TSESTree } from "@typescript-eslint/types";

import type { ReactEnvironmentOptions } from "$types/react-environment-options";
import type { Scope } from "@typescript-eslint/utils/ts-eslint";

export type RequireReactDisplayNamesOptions = ReactEnvironmentOptions;

type Options = [RequireReactDisplayNamesOptions?];
type MessageIds = "directContextExport" | "directMemoExport" | "missingContextDisplayName" | "missingMemoDisplayName";

const DEFAULT_OPTIONS: Required<RequireReactDisplayNamesOptions> = {
	environment: "roblox-ts",
};

interface TrackedVariable {
	readonly hasDisplayName: boolean;
	readonly isDefaultExported: boolean;
	readonly kind: "context" | "memo";
	readonly name: string;
	readonly node: TSESTree.VariableDeclarator;
}

type DisplayNameAssignmentExpression = TSESTree.AssignmentExpression & {
	readonly left: TSESTree.MemberExpression;
};

function isCreateContextCall(
	node: TSESTree.CallExpression,
	createContextIdentifiers: Set<string>,
	reactNamespaces: Set<string>,
): boolean {
	const { callee } = node;

	if (callee.type === TSESTree.AST_NODE_TYPES.Identifier) return createContextIdentifiers.has(callee.name);

	if (
		callee.type === TSESTree.AST_NODE_TYPES.MemberExpression &&
		callee.object.type === TSESTree.AST_NODE_TYPES.Identifier &&
		callee.property.type === TSESTree.AST_NODE_TYPES.Identifier
	) {
		return reactNamespaces.has(callee.object.name) && callee.property.name === "createContext";
	}

	return false;
}

function getVariableName(node: TSESTree.VariableDeclarator): string | undefined {
	if (node.id.type === TSESTree.AST_NODE_TYPES.Identifier) return node.id.name;
	return undefined;
}

function isNodeInExport(node: TSESTree.Node): boolean {
	let current: TSESTree.Node | undefined = node;
	while (current) {
		const { type } = current;
		if (type === TSESTree.AST_NODE_TYPES.ExportNamedDeclaration) return true;
		current = current.parent;
	}
	return false;
}

function isReferenceExported(reference: Scope.Reference): boolean {
	return isNodeInExport(reference.identifier);
}

const requireReactDisplayNames = createRule<Options, MessageIds>({
	create(context) {
		const options: Required<RequireReactDisplayNamesOptions> = {
			...DEFAULT_OPTIONS,
			...context.options[0],
		};

		const reactSources = getReactSources(options.environment);
		const memoIdentifiers = new Set<string>();
		const createContextIdentifiers = new Set<string>();
		const reactNamespaces = new Set<string>();
		const trackedVariables = new Map<string, TrackedVariable>();
		const displayNameAssignments = new Set<string>();

		return {
			"AssignmentExpression[left.type='MemberExpression'][left.property.name='displayName']"(
				node: DisplayNameAssignmentExpression,
			): void {
				const { left } = node;

				if (left.object.type === TSESTree.AST_NODE_TYPES.Identifier) {
					displayNameAssignments.add(left.object.name);
				}
			},

			ExportDefaultDeclaration(node): void {
				const { declaration } = node;

				if (declaration.type === TSESTree.AST_NODE_TYPES.CallExpression) {
					if (
						isNamedReactHookCall(declaration, "memo", memoIdentifiers, reactNamespaces, {
							allowComputedIdentifierProperty: true,
						})
					) {
						context.report({
							messageId: "directMemoExport",
							node,
						});
						return;
					}

					if (isCreateContextCall(declaration, createContextIdentifiers, reactNamespaces)) {
						context.report({
							messageId: "directContextExport",
							node,
						});
						return;
					}
				}

				if (declaration.type === TSESTree.AST_NODE_TYPES.Identifier) {
					const tracked = trackedVariables.get(declaration.name);
					if (tracked) {
						trackedVariables.set(declaration.name, {
							...tracked,
							isDefaultExported: true,
						});
					}
				}
			},

			ExportNamedDeclaration(node): void {
				for (const specifier of node.specifiers) {
					const localName =
						specifier.local.type === TSESTree.AST_NODE_TYPES.Identifier
							? specifier.local.name
							: specifier.local.value;

					const exportedName =
						specifier.exported.type === TSESTree.AST_NODE_TYPES.Identifier
							? specifier.exported.name
							: specifier.exported.value;

					if (exportedName === "default") {
						const tracked = trackedVariables.get(localName);
						if (tracked !== undefined) {
							trackedVariables.set(localName, {
								...tracked,
								isDefaultExported: true,
							});
						}
					}
				}
			},
			ImportDeclaration(node): void {
				if (!isReactImport(node, reactSources)) return;

				for (const specifier of node.specifiers) {
					if (
						specifier.type === TSESTree.AST_NODE_TYPES.ImportDefaultSpecifier ||
						specifier.type === TSESTree.AST_NODE_TYPES.ImportNamespaceSpecifier
					) {
						reactNamespaces.add(specifier.local.name);
					} else {
						const importedName =
							specifier.imported.type === TSESTree.AST_NODE_TYPES.Identifier
								? specifier.imported.name
								: specifier.imported.value;

						if (importedName === "memo") memoIdentifiers.add(specifier.local.name);
						else if (importedName === "createContext") createContextIdentifiers.add(specifier.local.name);
					}
				}
			},

			"Program:exit"(): void {
				for (const [name, tracked] of trackedVariables) {
					const hasDisplayName = displayNameAssignments.has(name);
					if (hasDisplayName) continue;

					let isExported = tracked.isDefaultExported;

					for (const variable of context.sourceCode.getDeclaredVariables(tracked.node)) {
						isExported ||= variable.references.some(isReferenceExported);
					}

					const declarationParent = tracked.node.parent;
					if (declarationParent?.parent?.type === TSESTree.AST_NODE_TYPES.ExportNamedDeclaration) {
						isExported = true;
					}

					if (isExported) {
						context.report({
							data: { name },
							messageId: tracked.kind === "memo" ? "missingMemoDisplayName" : "missingContextDisplayName",
							node: tracked.node,
						});
					}
				}
			},

			VariableDeclarator(node): void {
				if (node.init === null || node.init.type !== TSESTree.AST_NODE_TYPES.CallExpression) return;

				const name = getVariableName(node);
				if (name === undefined) return;

				if (
					isNamedReactHookCall(node.init, "memo", memoIdentifiers, reactNamespaces, {
						allowComputedIdentifierProperty: true,
					})
				) {
					trackedVariables.set(name, {
						hasDisplayName: false,
						isDefaultExported: false,
						kind: "memo",
						name,
						node,
					});
				} else if (isCreateContextCall(node.init, createContextIdentifiers, reactNamespaces)) {
					trackedVariables.set(name, {
						hasDisplayName: false,
						isDefaultExported: false,
						kind: "context",
						name,
						node,
					});
				}
			},
		};
	},
	meta: {
		defaultOptions: [DEFAULT_OPTIONS],
		docs: {
			description:
				"Require displayName property on exported React.memo components and React.createContext contexts for better debugging.",
		},
		messages: {
			directContextExport:
				"Do not export createContext result directly. Assign to a variable, set displayName, then export.",
			directMemoExport:
				"Do not export memo result directly. Assign to a variable, set displayName, then export both named and default.",
			missingContextDisplayName:
				"Exported Context '{{name}}' is missing displayName. Add `{{name}}.displayName = \"{{name}}\";` before exporting.",
			missingMemoDisplayName:
				"Exported memoized component '{{name}}' is missing displayName. Add `{{name}}.displayName = \"{{name}}\";` before exporting.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					environment: {
						default: "roblox-ts",
						description: "The React environment: 'roblox-ts' uses @rbxts/react, 'standard' uses react.",
						enum: ["roblox-ts", "standard"],
						type: "string",
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
	name: "require-react-display-names",
});

export default requireReactDisplayNames;
