import { extname } from "node:path";
import { DefinitionType } from "@typescript-eslint/scope-manager";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";

import { createRule } from "../utilities/create-rule";
import { discoverLocalComponent, inspectLocalComponentFile } from "../utilities/local-component-discovery";
import { resolveRelativeImport } from "../utilities/resolve-import";

import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

type MessageIds = "preferPortalComponent";
type Options = [];

const PORTAL_COMPONENT = {
	componentName: "Portal",
	fileNames: ["portal"],
	markers: ["target"],
} as const;

const PORTAL_SOURCES = new Set(["@rbxts/react-roblox", "react-dom"]);
const JSX_EXTENSIONS = new Set([".jsx", ".tsx"]);

function findVariable(
	context: TSESLint.RuleContext<MessageIds, Options>,
	identifier: TSESTree.Identifier,
): TSESLint.Scope.Variable | undefined {
	let scope = context.sourceCode.getScope(identifier) as TSESLint.Scope.Scope | undefined;
	while (scope !== undefined) {
		const variable = scope.set.get(identifier.name);
		if (variable !== undefined) return variable;
		scope = scope.upper ?? undefined;
	}

	return undefined;
}

function getImportedName(specifier: TSESTree.ImportSpecifier): string | undefined {
	if (specifier.imported.type === AST_NODE_TYPES.Identifier) return specifier.imported.name;
	if (typeof specifier.imported.value === "string") return specifier.imported.value;
	return undefined;
}

function isCreatePortalImport(variable: TSESLint.Scope.Variable | undefined): boolean {
	if (variable === undefined) return false;

	for (const definition of variable.defs) {
		if (definition.type !== DefinitionType.ImportBinding) continue;
		if (definition.node.type !== AST_NODE_TYPES.ImportSpecifier) continue;
		if (definition.parent?.type !== AST_NODE_TYPES.ImportDeclaration) continue;
		if (!PORTAL_SOURCES.has(definition.parent.source.value)) continue;

		if (getImportedName(definition.node) === "createPortal") return true;
	}

	return false;
}

function isPortalNamespaceImport(variable: TSESLint.Scope.Variable | undefined): boolean {
	if (variable === undefined) return false;

	for (const definition of variable.defs) {
		if (definition.type !== DefinitionType.ImportBinding) continue;
		if (definition.node.type !== AST_NODE_TYPES.ImportNamespaceSpecifier) continue;
		if (definition.parent?.type !== AST_NODE_TYPES.ImportDeclaration) continue;
		if (PORTAL_SOURCES.has(definition.parent.source.value)) return true;
	}

	return false;
}

function isPortalFactoryCall(
	context: TSESLint.RuleContext<MessageIds, Options>,
	node: TSESTree.CallExpression,
): boolean {
	const { callee } = node;

	if (callee.type === AST_NODE_TYPES.Identifier) {
		return isCreatePortalImport(findVariable(context, callee));
	}

	if (callee.type !== AST_NODE_TYPES.MemberExpression) return false;
	if (callee.computed) return false;
	if (callee.object.type !== AST_NODE_TYPES.Identifier) return false;
	if (callee.property.type !== AST_NODE_TYPES.Identifier) return false;
	if (callee.property.name !== "createPortal") return false;

	return isPortalNamespaceImport(findVariable(context, callee.object));
}

function renderPortalChild(argument: TSESTree.CallExpressionArgument, sourceCode: TSESLint.SourceCode): string {
	if (argument.type === AST_NODE_TYPES.JSXElement || argument.type === AST_NODE_TYPES.JSXFragment) {
		return sourceCode.getText(argument);
	}

	return `{${sourceCode.getText(argument)}}`;
}

function getPortalReplacement(
	componentName: string,
	node: TSESTree.CallExpression,
	sourceCode: TSESLint.SourceCode,
): string | undefined {
	if (node.arguments.length !== 2) return undefined;

	const [childrenArgument, targetArgument] = node.arguments;
	if (childrenArgument === undefined || targetArgument === undefined) return undefined;

	const children = renderPortalChild(childrenArgument, sourceCode);
	const target = sourceCode.getText(targetArgument);

	return `<${componentName} target={${target}}>${children}</${componentName}>`;
}

const preferLocalPortalComponent = createRule<Options, MessageIds>({
	create(context) {
		const filename = context.filename ?? "";
		const discoveredPortal =
			filename === "" ? { found: false as const } : discoverLocalComponent(filename, PORTAL_COMPONENT);
		const availablePortalIdentifiers = new Set<string>();

		return {
			CallExpression(node): void {
				if (!isPortalFactoryCall(context, node)) return;
				if (node.arguments.length !== 2) return;

				const hasAvailablePortal = availablePortalIdentifiers.size > 0 || discoveredPortal.found;
				if (!hasAvailablePortal) return;

				const canFix = JSX_EXTENSIONS.has(extname(filename)) && availablePortalIdentifiers.size === 1;
				const [portalIdentifier] = [...availablePortalIdentifiers];
				const replacement =
					canFix && portalIdentifier !== undefined
						? getPortalReplacement(portalIdentifier, node, context.sourceCode)
						: undefined;

				if (replacement !== undefined) {
					context.report({
						fix: (fixer) => fixer.replaceText(node, replacement),
						messageId: "preferPortalComponent",
						node,
					});
					return;
				}

				context.report({
					messageId: "preferPortalComponent",
					node,
				});
			},

			ImportDeclaration(node): void {
				const importSource = node.source.value;
				if (typeof importSource !== "string" || !importSource.startsWith(".") || filename === "") return;

				const resolved = resolveRelativeImport(importSource, filename);
				if (!resolved.found) return;

				const inspection = inspectLocalComponentFile(resolved.path, PORTAL_COMPONENT);
				if (!inspection.matches) return;

				for (const specifier of node.specifiers) {
					if (specifier.type === AST_NODE_TYPES.ImportDefaultSpecifier) {
						availablePortalIdentifiers.add(specifier.local.name);
						continue;
					}

					if (specifier.type !== AST_NODE_TYPES.ImportSpecifier) continue;
					if (getImportedName(specifier) !== "Portal") continue;

					availablePortalIdentifiers.add(specifier.local.name);
				}
			},
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description:
				"Prefer a local Portal component over direct createPortal calls when the project already defines one.",
		},
		fixable: "code",
		messages: {
			preferPortalComponent: "Use the local `Portal` component instead of calling `createPortal` directly.",
		},
		schema: [],
		type: "suggestion",
	},
	name: "prefer-local-portal-component",
});

export default preferLocalPortalComponent;
