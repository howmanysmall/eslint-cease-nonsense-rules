import nodePath from "node:path";
import { getImportSpecifierName, unwrapExpression } from "$utilities/ast-utilities";
import { createRule } from "$utilities/create-rule";
import { discoverLocalComponent, inspectLocalComponentFile } from "$utilities/local-component-discovery";
import { resolveRelativeImport } from "$utilities/resolve-import";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";

import type { ReadonlyRecord } from "$types/utility-types";
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

type PaddingAttribute = TSESTree.JSXAttribute & {
	readonly value: Exclude<TSESTree.JSXAttribute["value"], null>;
};

interface PaddingAttributes {
	readonly paddingBottom: PaddingAttribute;
	readonly paddingLeft: PaddingAttribute;
	readonly paddingRight: PaddingAttribute;
	readonly paddingTop: PaddingAttribute;
}

interface ComponentInspection {
	readonly matches: boolean;
}

interface ComponentDiscoveryResult {
	readonly found: boolean;
}

interface PaddingChoice {
	readonly componentIdentifiers: ReadonlySet<string>;
	readonly discoveredComponent: ComponentDiscoveryResult;
	readonly messageId: MessageIds;
}

function isRecord(value: unknown): value is ReadonlyRecord<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unwrapComparableNode(node: TSESTree.Expression | TSESTree.Literal): TSESTree.Expression | TSESTree.Literal {
	if (node.type === AST_NODE_TYPES.Literal) return node;
	return unwrapExpression(node);
}

function hasAttributeValue(attribute: TSESTree.JSXAttribute): attribute is PaddingAttribute {
	return attribute.value !== null;
}

function areStructurallyEqual(left: unknown, right: unknown): boolean {
	if (Object.is(left, right)) return true;

	if (Array.isArray(left)) {
		return Array.isArray(right) && areArraysStructurallyEqual(left, right);
	}

	if (Array.isArray(right) || !isRecord(left) || !isRecord(right)) return false;
	return areRecordsStructurallyEqual(left, right);
}

function areArraysStructurallyEqual(left: ReadonlyArray<unknown>, right: ReadonlyArray<unknown>): boolean {
	if (left.length !== right.length) return false;

	let index = 0;
	for (const value of left) if (!areStructurallyEqual(value, right[index++])) return false;
	return true;
}

function areRecordsStructurallyEqual(
	left: ReadonlyRecord<string, unknown>,
	right: ReadonlyRecord<string, unknown>,
): boolean {
	const leftEntries = Object.entries(left).filter(([key]) => !IGNORED_COMPARISON_KEYS.has(key));
	const rightEntries = Object.entries(right).filter(([key]) => !IGNORED_COMPARISON_KEYS.has(key));
	if (leftEntries.length !== rightEntries.length) return false;

	for (const [key, value] of leftEntries) {
		if (!(Object.hasOwn(right, key) && areStructurallyEqual(value, right[key]))) return false;
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

function getComparableAttributeNode(attribute: PaddingAttribute): TSESTree.Expression | TSESTree.Literal | undefined {
	const { value } = attribute;

	if (value.type === AST_NODE_TYPES.Literal) return value;
	if (value.type !== AST_NODE_TYPES.JSXExpressionContainer) return undefined;
	if (value.expression.type === AST_NODE_TYPES.JSXEmptyExpression) return undefined;

	return unwrapComparableNode(value.expression);
}

function collectPaddingAttributes(node: TSESTree.JSXOpeningElement): PaddingAttributes | undefined {
	const attributes = new Map<string, PaddingAttribute>();

	for (const attribute of node.attributes) {
		if (attribute.type === AST_NODE_TYPES.JSXSpreadAttribute) return undefined;
		if (attribute.name.type !== AST_NODE_TYPES.JSXIdentifier) return undefined;

		const attributeName = attribute.name.name;
		if (!PADDING_ATTRIBUTE_NAMES.has(attributeName)) return undefined;
		if (attributes.has(attributeName)) return undefined;
		if (!hasAttributeValue(attribute)) return undefined;

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

function getAttributeValueText(attribute: PaddingAttribute, sourceCode: TSESLint.SourceCode): string {
	const { value } = attribute;
	return sourceCode.getText(value);
}

function getPaddingReplacement(
	componentName: string,
	kind: MessageIds,
	attributes: PaddingAttributes,
	sourceCode: TSESLint.SourceCode,
): string {
	const topValue = getAttributeValueText(attributes.paddingTop, sourceCode);

	if (kind === "preferEqualPadding") return `<${componentName} padding=${topValue} />`;

	const leftValue = getAttributeValueText(attributes.paddingLeft, sourceCode);

	return `<${componentName} horizontal=${topValue} vertical=${leftValue} />`;
}

function addMatchingImportSpecifiers(
	specifiers: ReadonlyArray<TSESTree.ImportClause>,
	directionalInspection: ComponentInspection,
	equalInspection: ComponentInspection,
	directionalPaddingIdentifiers: Set<string>,
	equalPaddingIdentifiers: Set<string>,
): void {
	for (const specifier of specifiers) {
		if (specifier.type === AST_NODE_TYPES.ImportDefaultSpecifier) {
			addDefaultPaddingImport(
				specifier,
				directionalInspection,
				equalInspection,
				directionalPaddingIdentifiers,
				equalPaddingIdentifiers,
			);
			continue;
		}

		if (specifier.type !== AST_NODE_TYPES.ImportSpecifier) continue;
		addNamedPaddingImport(
			specifier,
			directionalInspection,
			equalInspection,
			directionalPaddingIdentifiers,
			equalPaddingIdentifiers,
		);
	}
}

function addDefaultPaddingImport(
	specifier: TSESTree.ImportDefaultSpecifier,
	directionalInspection: ComponentInspection,
	equalInspection: ComponentInspection,
	directionalPaddingIdentifiers: Set<string>,
	equalPaddingIdentifiers: Set<string>,
): void {
	if (directionalInspection.matches) directionalPaddingIdentifiers.add(specifier.local.name);
	if (equalInspection.matches) equalPaddingIdentifiers.add(specifier.local.name);
}

function addNamedPaddingImport(
	specifier: TSESTree.ImportSpecifier,
	directionalInspection: ComponentInspection,
	equalInspection: ComponentInspection,
	directionalPaddingIdentifiers: Set<string>,
	equalPaddingIdentifiers: Set<string>,
): void {
	const importedName = getImportSpecifierName(specifier);
	if (directionalInspection.matches && importedName === "DirectionalPadding") {
		directionalPaddingIdentifiers.add(specifier.local.name);
	}

	if (equalInspection.matches && importedName === "EqualPadding") {
		equalPaddingIdentifiers.add(specifier.local.name);
	}
}

function choosePaddingComponent(
	attributes: PaddingAttributes,
	equalPaddingIdentifiers: ReadonlySet<string>,
	directionalPaddingIdentifiers: ReadonlySet<string>,
	discoveredEqualPadding: ComponentDiscoveryResult,
	discoveredDirectionalPadding: ComponentDiscoveryResult,
): PaddingChoice | undefined {
	const bottom = getComparableAttributeNode(attributes.paddingBottom);
	const left = getComparableAttributeNode(attributes.paddingLeft);
	const right = getComparableAttributeNode(attributes.paddingRight);
	const top = getComparableAttributeNode(attributes.paddingTop);
	if (bottom === undefined || left === undefined || right === undefined || top === undefined) return undefined;

	const horizontalEqual = areStructurallyEqual(top, bottom);
	const verticalEqual = areStructurallyEqual(left, right);
	if (!(horizontalEqual && verticalEqual)) return undefined;

	if (areStructurallyEqual(top, left) && areStructurallyEqual(top, right)) {
		return {
			componentIdentifiers: equalPaddingIdentifiers,
			discoveredComponent: discoveredEqualPadding,
			messageId: "preferEqualPadding",
		};
	}

	return {
		componentIdentifiers: directionalPaddingIdentifiers,
		discoveredComponent: discoveredDirectionalPadding,
		messageId: "preferDirectionalPadding",
	};
}

const preferPaddingComponents = createRule<Options, MessageIds>({
	create(context) {
		const { filename } = context;
		const discoveredDirectionalPadding = discoverLocalComponent(filename, DIRECTIONAL_PADDING_COMPONENT);
		const discoveredEqualPadding = discoverLocalComponent(filename, EQUAL_PADDING_COMPONENT);
		const directionalPaddingIdentifiers = new Set<string>();
		const equalPaddingIdentifiers = new Set<string>();

		return {
			ImportDeclaration(node): void {
				const importSource = node.source.value;
				if (typeof importSource !== "string" || !importSource.startsWith(".")) return;

				const resolved = resolveRelativeImport(importSource, filename);
				if (!resolved.found) return;

				const directionalInspection = inspectLocalComponentFile(resolved.path, DIRECTIONAL_PADDING_COMPONENT);
				const equalInspection = inspectLocalComponentFile(resolved.path, EQUAL_PADDING_COMPONENT);

				addMatchingImportSpecifiers(
					node.specifiers,
					directionalInspection,
					equalInspection,
					directionalPaddingIdentifiers,
					equalPaddingIdentifiers,
				);
			},

			JSXElement(node): void {
				if (hasMeaningfulChildren(node)) return;

				const { openingElement } = node;
				if (openingElement.name.type !== AST_NODE_TYPES.JSXIdentifier) return;
				if (openingElement.name.name !== "uipadding") return;

				const attributes = collectPaddingAttributes(openingElement);
				if (attributes === undefined) return;

				const choice = choosePaddingComponent(
					attributes,
					equalPaddingIdentifiers,
					directionalPaddingIdentifiers,
					discoveredEqualPadding,
					discoveredDirectionalPadding,
				);
				if (choice === undefined) return;
				if (choice.componentIdentifiers.size === 0 && !choice.discoveredComponent.found) return;

				const canFix = JSX_EXTENSIONS.has(nodePath.extname(filename)) && choice.componentIdentifiers.size === 1;
				const [componentIdentifier] = [...choice.componentIdentifiers];
				const replacement =
					canFix && componentIdentifier !== undefined
						? getPaddingReplacement(componentIdentifier, choice.messageId, attributes, context.sourceCode)
						: undefined;

				if (replacement !== undefined) {
					context.report({
						fix: (fixer) => fixer.replaceText(node, replacement),
						messageId: choice.messageId,
						node,
					});
					return;
				}

				context.report({
					messageId: choice.messageId,
					node,
				});
			},
		};
	},
	meta: {
		defaultOptions: [],
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
