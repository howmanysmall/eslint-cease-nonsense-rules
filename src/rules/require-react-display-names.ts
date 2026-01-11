import { TSESTree } from "@typescript-eslint/types";
import type { Scope } from "@typescript-eslint/utils/ts-eslint";
import { getReactSources, isReactImport } from "../constants/react-sources";
import type { EnvironmentMode } from "../types/environment-mode";
import { createRule } from "../utilities/create-rule";

export interface RequireReactDisplayNamesOptions {
	readonly environment?: EnvironmentMode;
}

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

function isMemoCall(
	node: TSESTree.CallExpression,
	memoIdentifiers: Set<string>,
	reactNamespaces: Set<string>,
): boolean {
	const { callee } = node;

	if (callee.type === TSESTree.AST_NODE_TYPES.Identifier) return memoIdentifiers.has(callee.name);

	if (
		callee.type === TSESTree.AST_NODE_TYPES.MemberExpression &&
		callee.object.type === TSESTree.AST_NODE_TYPES.Identifier &&
		callee.property.type === TSESTree.AST_NODE_TYPES.Identifier
	) {
		return reactNamespaces.has(callee.object.name) && callee.property.name === "memo";
	}

	return false;
}

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
		if (type === TSESTree.AST_NODE_TYPES.ExportDefaultDeclaration) return true;
		current = current.parent;
	}
	return false;
}

function isReferenceExported(reference: Scope.Reference): boolean {
	return isNodeInExport(reference.identifier);
}

export default createRule<Options, MessageIds>({
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
				node: TSESTree.AssignmentExpression,
			): void {
				const left = node.left as TSESTree.MemberExpression;
				if (left.object.type === TSESTree.AST_NODE_TYPES.Identifier) {
					displayNameAssignments.add(left.object.name);
				}
			},

			ExportDefaultDeclaration(node): void {
				const { declaration } = node;

				if (declaration.type === TSESTree.AST_NODE_TYPES.CallExpression) {
					if (isMemoCall(declaration, memoIdentifiers, reactNamespaces)) {
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
				if (!node.specifiers) return;

				for (const specifier of node.specifiers) {
					if (specifier.type !== TSESTree.AST_NODE_TYPES.ExportSpecifier) continue;

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
						if (tracked) {
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
					} else if (specifier.type === TSESTree.AST_NODE_TYPES.ImportSpecifier) {
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

					const declaredVariables = context.sourceCode.getDeclaredVariables(tracked.node);
					const variable = declaredVariables.find((declared) => declared.name === name);

					let isExported = tracked.isDefaultExported;

					if (variable) isExported ||= variable.references.some(isReferenceExported);

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
				if (!node.init || node.init.type !== TSESTree.AST_NODE_TYPES.CallExpression) return;

				const name = getVariableName(node);
				if (!name) return;

				if (isMemoCall(node.init, memoIdentifiers, reactNamespaces)) {
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
	defaultOptions: [DEFAULT_OPTIONS],
	meta: {
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
