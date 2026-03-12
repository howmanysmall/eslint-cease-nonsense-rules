import { extname } from "node:path";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";

import { createRule } from "../utilities/create-rule";
import { discoverLocalComponent, inspectLocalComponentFile } from "../utilities/local-component-discovery";
import { resolveRelativeImport } from "../utilities/resolve-import";

import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

type MessageIds = "preferDirectionalPadding" | "preferEqualPadding";
type Options = [];

const DIRECTIONAL_PADDING_COMPONENT = {
	componentName: "DirectionalPadding",
	fileNames: ["directional-padding"],
	markers: ["horizontal", "vertical"],
} as const;
const EQUAL_PADDING_COMPONENT = {
	componentName: "EqualPadding",
	fileNames: ["equal-padding"],
	markers: ["padding"],
} as const;
const IGNORED_COMPARISON_KEYS = new Set(["end", "loc", "parent", "range", "start"]);
const JSX_EXTENSIONS = new Set([".jsx", ".tsx"]);
const PADDING_ATTRIBUTE_NAMES = new Set(["PaddingBottom", "PaddingLeft", "PaddingRight", "PaddingTop"]);

interface PaddingAttributes {
	readonly paddingBottom: TSESTree.JSXAttribute;
	readonly paddingLeft: TSESTree.JSXAttribute;
	readonly paddingRight: TSESTree.JSXAttribute;
	readonly paddingTop: TSESTree.JSXAttribute;
}

function unwrapComparableNode(node: TSESTree.Expression | TSESTree.Literal): TSESTree.Expression | TSESTree.Literal {
	let current: TSESTree.Expression | TSESTree.Literal = node;

	while (true) {
		if (current.type === AST_NODE_TYPES.TSAsExpression || current.type === AST_NODE_TYPES.TSSatisfiesExpression) {
			current = current.expression;
			continue;
		}

		if (current.type === AST_NODE_TYPES.TSNonNullExpression) {
			current = current.expression;
			continue;
		}

		if (current.type === AST_NODE_TYPES.TSTypeAssertion) {
			current = current.expression;
			continue;
		}

		if (current.type === AST_NODE_TYPES.ChainExpression) {
			current = current.expression;
			continue;
		}

		return current;
	}
}

function areStructurallyEqual(left: unknown, right: unknown): boolean {
	if (Object.is(left, right)) return true;
	if (left === null || right === null) return false;

	if (Array.isArray(left)) {
		if (!Array.isArray(right)) return false;
		if (left.length !== right.length) return false;

		let index = 0;
		for (const value of left) if (!areStructurallyEqual(value, right[index++])) return false;
		return true;
	}

	if (Array.isArray(right)) return false;

	if (typeof left !== "object" || typeof right !== "object") return false;

	const leftEntries = Object.entries(left).filter(([key]) => !IGNORED_COMPARISON_KEYS.has(key));
	const rightEntries = Object.entries(right).filter(([key]) => !IGNORED_COMPARISON_KEYS.has(key));
	if (leftEntries.length !== rightEntries.length) return false;

	const rightRecord = right as Record<string, unknown>;
	for (const [key, value] of leftEntries) {
		if (!(key in rightRecord)) return false;
		if (!areStructurallyEqual(value, rightRecord[key])) return false;
	}

	return true;
}

function hasMeaningfulChildren(node: TSESTree.JSXElement): boolean {
	for (const child of node.children) {
		if (child.type === AST_NODE_TYPES.JSXText && child.value.trim() === "") continue;
		if (
			child.type === AST_NODE_TYPES.JSXExpressionContainer &&
			child.expression.type === AST_NODE_TYPES.JSXEmptyExpression
		) {
			continue;
		}

		return true;
	}

	return false;
}

function getComparableAttributeNode(
	attribute: TSESTree.JSXAttribute,
): TSESTree.Expression | TSESTree.Literal | undefined {
	const { value } = attribute;
	if (value === null) return undefined;

	if (value.type === AST_NODE_TYPES.Literal) return value;
	if (value.type !== AST_NODE_TYPES.JSXExpressionContainer) return undefined;
	if (value.expression.type === AST_NODE_TYPES.JSXEmptyExpression) return undefined;

	return unwrapComparableNode(value.expression);
}

function collectPaddingAttributes(node: TSESTree.JSXOpeningElement): PaddingAttributes | undefined {
	const attributes = new Map<string, TSESTree.JSXAttribute>();

	for (const attribute of node.attributes) {
		if (attribute.type === AST_NODE_TYPES.JSXSpreadAttribute) return undefined;
		if (attribute.name.type !== AST_NODE_TYPES.JSXIdentifier) return undefined;

		const attributeName = attribute.name.name;
		if (!PADDING_ATTRIBUTE_NAMES.has(attributeName)) return undefined;
		if (attributes.has(attributeName)) return undefined;
		if (attribute.value === null) return undefined;

		attributes.set(attributeName, attribute);
	}

	const paddingBottom = attributes.get("PaddingBottom");
	const paddingLeft = attributes.get("PaddingLeft");
	const paddingRight = attributes.get("PaddingRight");
	const paddingTop = attributes.get("PaddingTop");
	if (
		paddingBottom === undefined ||
		paddingLeft === undefined ||
		paddingRight === undefined ||
		paddingTop === undefined
	) {
		return undefined;
	}

	return { paddingBottom, paddingLeft, paddingRight, paddingTop };
}

function getImportedName(specifier: TSESTree.ImportSpecifier): string | undefined {
	if (specifier.imported.type === AST_NODE_TYPES.Identifier) return specifier.imported.name;
	if (typeof specifier.imported.value === "string") return specifier.imported.value;
	return undefined;
}

function getAttributeValueText(attribute: TSESTree.JSXAttribute, sourceCode: TSESLint.SourceCode): string | undefined {
	const { value } = attribute;
	if (value === null) return undefined;
	if (value.type !== AST_NODE_TYPES.JSXExpressionContainer && value.type !== AST_NODE_TYPES.Literal) return undefined;
	return sourceCode.getText(value);
}

function getPaddingReplacement(
	componentName: string,
	kind: MessageIds,
	attributes: PaddingAttributes,
	sourceCode: TSESLint.SourceCode,
): string | undefined {
	const topValue = getAttributeValueText(attributes.paddingTop, sourceCode);
	if (topValue === undefined) return undefined;

	if (kind === "preferEqualPadding") return `<${componentName} padding=${topValue} />`;

	const leftValue = getAttributeValueText(attributes.paddingLeft, sourceCode);
	if (leftValue === undefined) return undefined;

	return `<${componentName} horizontal=${topValue} vertical=${leftValue} />`;
}

const preferPaddingComponents = createRule<Options, MessageIds>({
	create(context) {
		const filename = context.filename ?? "";
		const discoveredDirectionalPadding =
			filename === ""
				? { found: false as const }
				: discoverLocalComponent(filename, DIRECTIONAL_PADDING_COMPONENT);
		const discoveredEqualPadding =
			filename === "" ? { found: false as const } : discoverLocalComponent(filename, EQUAL_PADDING_COMPONENT);
		const directionalPaddingIdentifiers = new Set<string>();
		const equalPaddingIdentifiers = new Set<string>();

		return {
			ImportDeclaration(node): void {
				const importSource = node.source.value;
				if (typeof importSource !== "string" || !importSource.startsWith(".") || filename === "") return;

				const resolved = resolveRelativeImport(importSource, filename);
				if (!resolved.found) return;

				const directionalInspection = inspectLocalComponentFile(resolved.path, DIRECTIONAL_PADDING_COMPONENT);
				const equalInspection = inspectLocalComponentFile(resolved.path, EQUAL_PADDING_COMPONENT);

				for (const specifier of node.specifiers) {
					if (specifier.type === AST_NODE_TYPES.ImportDefaultSpecifier) {
						if (directionalInspection.matches) directionalPaddingIdentifiers.add(specifier.local.name);
						if (equalInspection.matches) equalPaddingIdentifiers.add(specifier.local.name);
						continue;
					}

					if (specifier.type !== AST_NODE_TYPES.ImportSpecifier) continue;

					const importedName = getImportedName(specifier);
					if (directionalInspection.matches && importedName === "DirectionalPadding") {
						directionalPaddingIdentifiers.add(specifier.local.name);
					}

					if (equalInspection.matches && importedName === "EqualPadding") {
						equalPaddingIdentifiers.add(specifier.local.name);
					}
				}
			},

			JSXElement(node): void {
				if (hasMeaningfulChildren(node)) return;

				const { openingElement } = node;
				if (openingElement.name.type !== AST_NODE_TYPES.JSXIdentifier) return;
				if (openingElement.name.name !== "uipadding") return;

				const attributes = collectPaddingAttributes(openingElement);
				if (attributes === undefined) return;

				const bottom = getComparableAttributeNode(attributes.paddingBottom);
				const left = getComparableAttributeNode(attributes.paddingLeft);
				const right = getComparableAttributeNode(attributes.paddingRight);
				const top = getComparableAttributeNode(attributes.paddingTop);
				if (bottom === undefined || left === undefined || right === undefined || top === undefined) return;

				const allEqual =
					areStructurallyEqual(top, bottom) &&
					areStructurallyEqual(top, left) &&
					areStructurallyEqual(top, right);
				const horizontalEqual = areStructurallyEqual(top, bottom);
				const verticalEqual = areStructurallyEqual(left, right);

				let componentIdentifiers: ReadonlySet<string>;
				let discoveredComponent: { readonly found: boolean };
				let messageId: MessageIds;

				if (allEqual) {
					componentIdentifiers = equalPaddingIdentifiers;
					discoveredComponent = discoveredEqualPadding;
					messageId = "preferEqualPadding";
				} else if (horizontalEqual && verticalEqual) {
					componentIdentifiers = directionalPaddingIdentifiers;
					discoveredComponent = discoveredDirectionalPadding;
					messageId = "preferDirectionalPadding";
				} else return;

				if (componentIdentifiers.size === 0 && !discoveredComponent.found) return;

				const canFix = JSX_EXTENSIONS.has(extname(filename)) && componentIdentifiers.size === 1;
				const [componentIdentifier] = [...componentIdentifiers];
				const replacement =
					canFix && componentIdentifier !== undefined
						? getPaddingReplacement(componentIdentifier, messageId, attributes, context.sourceCode)
						: undefined;

				if (replacement !== undefined) {
					context.report({
						fix: (fixer) => fixer.replaceText(node, replacement),
						messageId,
						node,
					});
					return;
				}

				context.report({
					messageId,
					node,
				});
			},
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description:
				"Prefer local EqualPadding and DirectionalPadding components over matching <uipadding /> declarations.",
		},
		fixable: "code",
		messages: {
			preferDirectionalPadding:
				"Use the local `DirectionalPadding` component when horizontal and vertical padding already match.",
			preferEqualPadding: "Use the local `EqualPadding` component when all four padding values already match.",
		},
		schema: [],
		type: "suggestion",
	},
	name: "prefer-padding-components",
});

export default preferPaddingComponents;
