import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { IndexKind } from "typescript";

import { createRule } from "../utilities/create-rule";

import type { TSESTree } from "@typescript-eslint/types";
import type { TSESLint } from "@typescript-eslint/utils";
import type { Expression, Type } from "typescript";

type MessageIds = "noEmptyArrayLiteral" | "suggestUseNewArray";

export interface NoEmptyArrayLiteralOptions {
	readonly allowedEmptyArrayContexts?: NoEmptyArrayLiteralAllowedContexts;
	readonly ignoreInferredNonEmptyLiterals?: boolean;
	readonly inferTypeForEmptyArrayFix?: boolean;
	readonly requireExplicitGenericOnNewArray?: boolean;
}

type NoEmptyArrayLiteralContextDefaults = {
	readonly [ContextKey in keyof NoEmptyArrayLiteralAllowedContexts]-?: boolean;
};

export interface NoEmptyArrayLiteralAllowedContexts {
	readonly arrowFunctionBody?: boolean;
	readonly assignmentExpressions?: boolean;
	readonly assignmentPatterns?: boolean;
	readonly callArguments?: boolean;
	readonly conditionalExpressions?: boolean;
	readonly forOfStatements?: boolean;
	readonly jsxAttributes?: boolean;
	readonly logicalExpressions?: boolean;
	readonly propertyValues?: boolean;
	readonly returnStatements?: boolean;
	readonly typeAssertions?: boolean;
}

type Options = [NoEmptyArrayLiteralOptions?];

type ResolvedOptions = Required<NoEmptyArrayLiteralOptions> & {
	readonly allowedEmptyArrayContexts: NoEmptyArrayLiteralContextDefaults;
};

const DEFAULT_OPTIONS: Omit<Required<NoEmptyArrayLiteralOptions>, "allowedEmptyArrayContexts"> & {
	readonly allowedEmptyArrayContexts: NoEmptyArrayLiteralContextDefaults;
} = {
	allowedEmptyArrayContexts: {
		arrowFunctionBody: true,
		assignmentExpressions: true,
		assignmentPatterns: true,
		callArguments: true,
		conditionalExpressions: true,
		forOfStatements: true,
		jsxAttributes: true,
		logicalExpressions: true,
		propertyValues: true,
		returnStatements: true,
		typeAssertions: true,
	},
	ignoreInferredNonEmptyLiterals: true,
	inferTypeForEmptyArrayFix: false,
	requireExplicitGenericOnNewArray: true,
};

const RULE_DOCS = {
	description: "Disallow empty array literals and require constructor form for empty arrays.",
	requiresTypeChecking: true,
};

function getTransparentParentExpression(expression: TSESTree.Expression): TSESTree.Expression | undefined {
	const { parent } = expression;
	if (!parent) return undefined;

	switch (parent.type) {
		case AST_NODE_TYPES.ChainExpression:
			return parent.expression === expression ? parent : undefined;
		case AST_NODE_TYPES.TSAsExpression:
			return parent.expression === expression ? parent : undefined;
		case AST_NODE_TYPES.TSNonNullExpression:
			return parent.expression === expression ? parent : undefined;
		case AST_NODE_TYPES.TSTypeAssertion:
			return parent.expression === expression ? parent : undefined;
		default:
			return undefined;
	}
}

function getOutermostUsageExpression(node: TSESTree.ArrayExpression): TSESTree.Expression {
	let currentExpression: TSESTree.Expression = node;
	let wrappedParentExpression = getTransparentParentExpression(currentExpression);

	while (wrappedParentExpression) {
		currentExpression = wrappedParentExpression;
		wrappedParentExpression = getTransparentParentExpression(currentExpression);
	}

	return currentExpression;
}

function getBooleanContextValue(value: boolean | undefined, fallback: boolean): boolean {
	if (value === undefined) return fallback;
	return value;
}

function isArgumentOfExpressionCall(
	parent: TSESTree.CallExpression | TSESTree.NewExpression,
	expression: TSESTree.Expression,
): boolean {
	for (const argument of parent.arguments) {
		if (argument === expression) return true;
	}

	return false;
}

function isAllowedEmptyArrayContext(
	node: TSESTree.ArrayExpression,
	sourceCode: Readonly<TSESLint.SourceCode>,
	context: Readonly<TSESLint.RuleContext<MessageIds, Options>>,
	options: Readonly<ResolvedOptions>,
): boolean {
	const usageExpression = getOutermostUsageExpression(node);
	const { parent } = usageExpression;
	if (!parent) return false;

	if (
		options.allowedEmptyArrayContexts.arrowFunctionBody &&
		parent.type === AST_NODE_TYPES.ArrowFunctionExpression &&
		parent.body === usageExpression
	) {
		return true;
	}

	if (
		options.allowedEmptyArrayContexts.returnStatements &&
		parent.type === AST_NODE_TYPES.ReturnStatement &&
		parent.argument === usageExpression
	) {
		return true;
	}

	if (
		options.allowedEmptyArrayContexts.propertyValues &&
		parent.type === AST_NODE_TYPES.Property &&
		parent.value === usageExpression
	) {
		return true;
	}

	if (
		options.allowedEmptyArrayContexts.assignmentExpressions &&
		parent.type === AST_NODE_TYPES.AssignmentExpression &&
		parent.right === usageExpression &&
		(parent.operator === "??=" || parent.operator === "=")
	) {
		return true;
	}

	if (
		options.allowedEmptyArrayContexts.assignmentPatterns &&
		parent.type === AST_NODE_TYPES.AssignmentPattern &&
		parent.right === usageExpression &&
		(parent.left.type === AST_NODE_TYPES.Identifier ||
			parent.left.type === AST_NODE_TYPES.ArrayPattern ||
			parent.left.type === AST_NODE_TYPES.ObjectPattern)
	) {
		const typeAnnotation = getBindingTypeAnnotation(parent.left);
		if (typeAnnotation && isArrayTypeAnnotation(typeAnnotation, sourceCode)) return true;
		if (
			typeAnnotation &&
			!isDirectArrayTypeAnnotation(typeAnnotation) &&
			isArrayTypeFromChecker(typeAnnotation, context)
		) {
			return true;
		}
		if (isReadonlyArrayTypeFromChecker(usageExpression, context)) return true;
	}

	if (
		options.allowedEmptyArrayContexts.logicalExpressions &&
		parent.type === AST_NODE_TYPES.LogicalExpression &&
		(parent.operator === "??" || parent.operator === "||") &&
		parent.right === usageExpression
	) {
		return true;
	}

	if (
		options.allowedEmptyArrayContexts.conditionalExpressions &&
		parent.type === AST_NODE_TYPES.ConditionalExpression &&
		(parent.consequent === usageExpression || parent.alternate === usageExpression)
	) {
		return true;
	}

	if (
		options.allowedEmptyArrayContexts.typeAssertions &&
		(usageExpression.type === AST_NODE_TYPES.TSAsExpression ||
			usageExpression.type === AST_NODE_TYPES.TSTypeAssertion) &&
		(isArrayTypeFromTypeNode(usageExpression.typeAnnotation, context) ||
			isArrayTypeNode(usageExpression.typeAnnotation, sourceCode, new Set<string>(), false))
	) {
		return true;
	}

	if (options.allowedEmptyArrayContexts.forOfStatements && parent.type === AST_NODE_TYPES.ForOfStatement) {
		return parent.right === usageExpression;
	}

	if (
		options.allowedEmptyArrayContexts.callArguments &&
		(parent.type === AST_NODE_TYPES.CallExpression || parent.type === AST_NODE_TYPES.NewExpression) &&
		isArgumentOfExpressionCall(parent, usageExpression)
	) {
		return true;
	}

	if (
		parent.type === AST_NODE_TYPES.VariableDeclarator &&
		parent.init === usageExpression &&
		(parent.parent?.type === AST_NODE_TYPES.VariableDeclaration ||
			parent.parent?.type === AST_NODE_TYPES.ForOfStatement)
	) {
		const typeAnnotation = getBindingTypeAnnotation(parent.id);
		if (typeAnnotation && isArrayTypeAnnotation(typeAnnotation, sourceCode)) return true;
		if (
			typeAnnotation &&
			!isDirectArrayTypeAnnotation(typeAnnotation) &&
			isArrayTypeFromChecker(typeAnnotation, context)
		) {
			return true;
		}
		return isReadonlyArrayTypeFromChecker(usageExpression, context);
	}

	if (
		options.allowedEmptyArrayContexts.jsxAttributes &&
		parent.type === AST_NODE_TYPES.JSXExpressionContainer &&
		parent.parent?.type === AST_NODE_TYPES.JSXAttribute
	) {
		return parent.parent.value === parent;
	}

	return false;
}

function findTypeAliasDeclaration(
	sourceCode: Readonly<TSESLint.SourceCode>,
	typeName: string,
): TSESTree.TSTypeAliasDeclaration | undefined {
	for (const statement of sourceCode.ast.body) {
		if (statement.type === AST_NODE_TYPES.TSTypeAliasDeclaration && statement.id.name === typeName) {
			return statement;
		}

		if (statement.type !== AST_NODE_TYPES.ExportNamedDeclaration || !statement.declaration) continue;
		const { declaration } = statement;
		if (declaration.type === AST_NODE_TYPES.TSTypeAliasDeclaration && declaration.id.name === typeName) {
			return declaration;
		}
	}

	return undefined;
}

function isReadonlyArrayTypeNode(
	typeNode: TSESTree.TypeNode,
	sourceCode: Readonly<TSESLint.SourceCode>,
	seenAliases: Set<string>,
): boolean {
	switch (typeNode.type) {
		case AST_NODE_TYPES.TSTypeReference: {
			if (typeNode.typeName.type !== AST_NODE_TYPES.Identifier) return false;
			const { name } = typeNode.typeName;
			if (name === "ReadonlyArray") return true;
			if (name === "Array") return false;
			if (seenAliases.has(name)) return false;

			const aliasDeclaration = findTypeAliasDeclaration(sourceCode, name);
			if (!aliasDeclaration) return false;

			seenAliases.add(name);
			return isReadonlyArrayTypeNode(aliasDeclaration.typeAnnotation, sourceCode, seenAliases);
		}
		case AST_NODE_TYPES.TSTypeOperator:
			return typeNode.operator === "readonly";
		default:
			return false;
	}
}

function isArrayTypeNode(
	typeNode: TSESTree.TypeNode | undefined,
	sourceCode: Readonly<TSESLint.SourceCode>,
	seenAliases: Set<string>,
	allowDirectArray: boolean,
): boolean {
	if (!typeNode) return false;

	switch (typeNode.type) {
		case AST_NODE_TYPES.TSTypeReference: {
			if (typeNode.typeName.type !== AST_NODE_TYPES.Identifier) return false;
			const { name } = typeNode.typeName;
			if (name === "ReadonlyArray") return true;
			if (name === "Array") return allowDirectArray;
			if (seenAliases.has(name)) return false;

			const aliasDeclaration = findTypeAliasDeclaration(sourceCode, name);
			if (!aliasDeclaration) return false;

			seenAliases.add(name);
			return isArrayTypeNode(aliasDeclaration.typeAnnotation, sourceCode, seenAliases, true);
		}
		case AST_NODE_TYPES.TSTypeOperator:
			return isArrayTypeNode(typeNode.typeAnnotation, sourceCode, seenAliases, allowDirectArray);
		default:
			return false;
	}
}

function isArrayTypeAnnotation(
	typeAnnotation: TSESTree.TSTypeAnnotation | undefined,
	sourceCode: Readonly<TSESLint.SourceCode>,
): boolean {
	if (!typeAnnotation) return false;
	return isArrayTypeNode(typeAnnotation.typeAnnotation, sourceCode, new Set<string>(), false);
}

function isDirectArrayTypeAnnotation(typeAnnotation: TSESTree.TSTypeAnnotation | undefined): boolean {
	if (!typeAnnotation) return false;

	const { typeAnnotation: annotationType } = typeAnnotation;
	return (
		annotationType.type === AST_NODE_TYPES.TSTypeReference &&
		annotationType.typeName.type === AST_NODE_TYPES.Identifier &&
		annotationType.typeName.name === "Array"
	);
}

function isArrayTypeFromTypeNode(
	typeNode: TSESTree.TypeNode | undefined,
	context: Readonly<TSESLint.RuleContext<MessageIds, Options>>,
): boolean {
	const { parserServices } = context.sourceCode;
	if (!(parserServices && "program" in parserServices && parserServices.program)) return false;
	if (!("esTreeNodeToTSNodeMap" in parserServices)) return false;
	if (!typeNode) return false;

	const { esTreeNodeToTSNodeMap } = parserServices;
	const tsNode = esTreeNodeToTSNodeMap.get(typeNode);
	const checker = parserServices.program.getTypeChecker();

	let resolvedType: Type;
	try {
		resolvedType = checker.getTypeFromTypeNode(tsNode as never);
	} catch {
		return false;
	}

	return checker.getIndexTypeOfType(resolvedType, IndexKind.Number) !== undefined;
}

function isArrayTypeFromChecker(
	typeAnnotation: TSESTree.TSTypeAnnotation | undefined,
	context: Readonly<TSESLint.RuleContext<MessageIds, Options>>,
): boolean {
	if (!typeAnnotation) return false;
	return isArrayTypeFromTypeNode(typeAnnotation.typeAnnotation, context);
}

function isDirectReadonlyArrayAnnotation(
	typeAnnotation: TSESTree.TSTypeAnnotation | undefined,
	sourceCode: Readonly<TSESLint.SourceCode>,
): boolean {
	if (!typeAnnotation) return false;
	return isReadonlyArrayTypeNode(typeAnnotation.typeAnnotation, sourceCode, new Set<string>());
}

function isReadonlyArrayTypeFromChecker(
	node: TSESTree.Expression,
	context: Readonly<TSESLint.RuleContext<MessageIds, Options>>,
): boolean {
	const { parserServices } = context.sourceCode;
	if (!(parserServices && "program" in parserServices && parserServices.program)) return false;
	if (!("esTreeNodeToTSNodeMap" in parserServices)) return false;

	const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);
	const checker = parserServices.program.getTypeChecker();
	const resolvedType = checker.getTypeAtLocation(tsNode);
	const contextualType = checker.getContextualType(tsNode as Expression);

	function isReadonlyArrayLike(type: Type): boolean {
		const indexType = checker.getIndexTypeOfType(type, IndexKind.Number);
		return indexType !== undefined && checker.getPropertyOfType(type, "push") === undefined;
	}

	if (contextualType && isReadonlyArrayLike(contextualType)) return true;
	return isReadonlyArrayLike(resolvedType);
}

function isReadonlyArrayConstInitializer(
	node: TSESTree.ArrayExpression,
	context: Readonly<TSESLint.RuleContext<MessageIds, Options>>,
): boolean {
	const usageExpression = getOutermostUsageExpression(node);
	const { parent } = usageExpression;
	if (!(parent && parent.type === AST_NODE_TYPES.VariableDeclarator && parent.init === usageExpression)) return false;
	if (!(parent.parent && parent.parent.type === AST_NODE_TYPES.VariableDeclaration)) return false;
	if (parent.parent.kind !== "const") return false;

	const typeAnnotation = getBindingTypeAnnotation(parent.id);
	if (isDirectReadonlyArrayAnnotation(typeAnnotation, context.sourceCode)) return true;
	if (!typeAnnotation) return false;

	return isReadonlyArrayTypeFromChecker(usageExpression, context);
}

function extractElementTypeFromTypeText(typeText: string): string | undefined {
	if (typeText.startsWith("Array<") && typeText.endsWith(">")) return typeText.slice(6, -1);
	if (typeText.startsWith("ReadonlyArray<") && typeText.endsWith(">")) return typeText.slice(14, -1);
	return undefined;
}

const IS_ANNOTATION = /:\s*(Array<.+>|ReadonlyArray<.+>)\s*=/u;

function extractElementTypeFromAssignmentPatternText(assignmentText: string): string | undefined {
	const annotationMatch = IS_ANNOTATION.exec(assignmentText);
	if (!annotationMatch) return undefined;

	const [, typeText] = annotationMatch;
	if (!typeText) return undefined;

	return extractElementTypeFromTypeText(typeText.trim());
}

function extractElementTypeFromGenericReference(
	typeNode: TSESTree.TypeNode,
	sourceCode: Readonly<TSESLint.SourceCode>,
): string | undefined {
	if (typeNode.type !== AST_NODE_TYPES.TSTypeReference) return undefined;
	if (typeNode.typeName.type !== AST_NODE_TYPES.Identifier) return undefined;
	if (typeNode.typeName.name !== "Array" && typeNode.typeName.name !== "ReadonlyArray") return undefined;
	if (!typeNode.typeArguments || typeNode.typeArguments.params.length !== 1) return undefined;

	const [elementType] = typeNode.typeArguments.params;
	if (!elementType) return undefined;
	return sourceCode.getText(elementType);
}

function getBindingTypeAnnotation(bindingName: TSESTree.BindingName): TSESTree.TSTypeAnnotation | undefined {
	if (bindingName.type === AST_NODE_TYPES.Identifier) return bindingName.typeAnnotation;
	if (bindingName.type === AST_NODE_TYPES.ArrayPattern) return bindingName.typeAnnotation;
	if (bindingName.type === AST_NODE_TYPES.ObjectPattern) return bindingName.typeAnnotation;
	return undefined;
}

function getExplicitElementTypeFromContext(
	node: TSESTree.ArrayExpression,
	sourceCode: Readonly<TSESLint.SourceCode>,
): string | undefined {
	const directParent = node.parent;
	if (directParent?.type === AST_NODE_TYPES.TSAsExpression && directParent.expression === node) {
		return extractElementTypeFromGenericReference(directParent.typeAnnotation, sourceCode);
	}

	if (directParent?.type === AST_NODE_TYPES.TSTypeAssertion && directParent.expression === node) {
		return extractElementTypeFromGenericReference(directParent.typeAnnotation, sourceCode);
	}

	const usageExpression = getOutermostUsageExpression(node);
	const { parent } = usageExpression;
	if (!parent) return undefined;

	if (parent.type === AST_NODE_TYPES.VariableDeclarator && parent.init === usageExpression) {
		const typeAnnotation = getBindingTypeAnnotation(parent.id);
		return typeAnnotation
			? extractElementTypeFromGenericReference(typeAnnotation.typeAnnotation, sourceCode)
			: undefined;
	}

	if (parent.type === AST_NODE_TYPES.AssignmentPattern && parent.right === usageExpression) {
		return extractElementTypeFromAssignmentPatternText(sourceCode.getText(parent));
	}

	if (
		parent.type === AST_NODE_TYPES.PropertyDefinition &&
		parent.value === usageExpression &&
		parent.typeAnnotation
	) {
		return extractElementTypeFromGenericReference(parent.typeAnnotation.typeAnnotation, sourceCode);
	}

	return undefined;
}

function getElementTypeFromTypeChecker(
	node: TSESTree.ArrayExpression,
	context: Readonly<TSESLint.RuleContext<MessageIds, Options>>,
): string | undefined {
	const { parserServices } = context.sourceCode;
	if (!(parserServices && "program" in parserServices && parserServices.program)) return undefined;
	if (!("esTreeNodeToTSNodeMap" in parserServices)) return undefined;

	const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);
	const checker = parserServices.program.getTypeChecker();

	function toElementTypeText(candidateType: Type): string | undefined {
		const elementType = checker.getIndexTypeOfType(candidateType, IndexKind.Number);
		return elementType ? checker.typeToString(elementType, tsNode) : undefined;
	}

	const contextualType = checker.getContextualType(tsNode);
	if (contextualType) {
		const contextualElement = toElementTypeText(contextualType);
		if (contextualElement) return contextualElement;
	}

	const fallbackType = checker.getTypeAtLocation(tsNode);
	return toElementTypeText(fallbackType);
}

function createReplacementText(
	elementType: string | undefined,
	options: Readonly<Required<NoEmptyArrayLiteralOptions>>,
): string {
	if (options.requireExplicitGenericOnNewArray && elementType) return `new Array<${elementType}>()`;
	return "new Array()";
}

const noEmptyArrayLiteral = createRule<Options, MessageIds>({
	create(context) {
		const userOptions = context.options[0] ?? {};
		const allowedContexts = userOptions.allowedEmptyArrayContexts;
		const resolvedContexts: Required<NoEmptyArrayLiteralAllowedContexts> = {
			arrowFunctionBody: getBooleanContextValue(
				allowedContexts?.arrowFunctionBody,
				DEFAULT_OPTIONS.allowedEmptyArrayContexts.arrowFunctionBody,
			),
			assignmentExpressions: getBooleanContextValue(
				allowedContexts?.assignmentExpressions,
				DEFAULT_OPTIONS.allowedEmptyArrayContexts.assignmentExpressions,
			),
			assignmentPatterns: getBooleanContextValue(
				allowedContexts?.assignmentPatterns,
				DEFAULT_OPTIONS.allowedEmptyArrayContexts.assignmentPatterns,
			),
			callArguments: getBooleanContextValue(
				allowedContexts?.callArguments,
				DEFAULT_OPTIONS.allowedEmptyArrayContexts.callArguments,
			),
			conditionalExpressions: getBooleanContextValue(
				allowedContexts?.conditionalExpressions,
				DEFAULT_OPTIONS.allowedEmptyArrayContexts.conditionalExpressions,
			),
			forOfStatements: getBooleanContextValue(
				allowedContexts?.forOfStatements,
				DEFAULT_OPTIONS.allowedEmptyArrayContexts.forOfStatements,
			),
			jsxAttributes: getBooleanContextValue(
				allowedContexts?.jsxAttributes,
				DEFAULT_OPTIONS.allowedEmptyArrayContexts.jsxAttributes,
			),
			logicalExpressions: getBooleanContextValue(
				allowedContexts?.logicalExpressions,
				DEFAULT_OPTIONS.allowedEmptyArrayContexts.logicalExpressions,
			),
			propertyValues: getBooleanContextValue(
				allowedContexts?.propertyValues,
				DEFAULT_OPTIONS.allowedEmptyArrayContexts.propertyValues,
			),
			returnStatements: getBooleanContextValue(
				allowedContexts?.returnStatements,
				DEFAULT_OPTIONS.allowedEmptyArrayContexts.returnStatements,
			),
			typeAssertions: getBooleanContextValue(
				allowedContexts?.typeAssertions,
				DEFAULT_OPTIONS.allowedEmptyArrayContexts.typeAssertions,
			),
		};
		const options: ResolvedOptions = {
			allowedEmptyArrayContexts: resolvedContexts,
			ignoreInferredNonEmptyLiterals:
				userOptions.ignoreInferredNonEmptyLiterals ?? DEFAULT_OPTIONS.ignoreInferredNonEmptyLiterals,
			inferTypeForEmptyArrayFix:
				userOptions.inferTypeForEmptyArrayFix ?? DEFAULT_OPTIONS.inferTypeForEmptyArrayFix,
			requireExplicitGenericOnNewArray:
				userOptions.requireExplicitGenericOnNewArray ?? DEFAULT_OPTIONS.requireExplicitGenericOnNewArray,
		};
		const { sourceCode } = context;

		return {
			ArrayExpression(node): void {
				if (node.elements.length > 0) return;
				if (isAllowedEmptyArrayContext(node, sourceCode, context, options)) return;
				if (isReadonlyArrayConstInitializer(node, context)) return;

				const explicitElementType = getExplicitElementTypeFromContext(node, sourceCode);
				const inferredElementType = options.inferTypeForEmptyArrayFix
					? getElementTypeFromTypeChecker(node, context)
					: undefined;
				const resolvedElementType = explicitElementType ?? inferredElementType;

				const hasAutoFix =
					explicitElementType !== undefined ||
					(options.inferTypeForEmptyArrayFix && inferredElementType !== undefined);

				const replacementText = createReplacementText(resolvedElementType, options);

				if (hasAutoFix) {
					context.report({
						fix: (fixer) => fixer.replaceText(node, replacementText),
						messageId: "noEmptyArrayLiteral",
						node,
					});
					return;
				}

				context.report({
					messageId: "noEmptyArrayLiteral",
					node,
					suggest: [
						{
							fix: (fixer): TSESLint.RuleFix => fixer.replaceText(node, "new Array()"),
							messageId: "suggestUseNewArray",
						},
					],
				});
			},
		};
	},
	defaultOptions: [DEFAULT_OPTIONS],
	meta: {
		docs: RULE_DOCS,
		fixable: "code",
		hasSuggestions: true,
		messages: {
			noEmptyArrayLiteral: "Empty array literals are not allowed. Use new Array<T>() or new Array() instead.",
			suggestUseNewArray: "Replace [] with new Array().",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					allowedEmptyArrayContexts: {
						additionalProperties: false,
						description: "Fine-grained control for exempt empty-array usage contexts.",
						properties: {
							arrowFunctionBody: {
								default: true,
								description: "Allow [] as the direct body of arrow functions.",
								type: "boolean",
							},
							assignmentExpressions: {
								default: true,
								description: "Allow [] on assignment expression right-hand sides.",
								type: "boolean",
							},
							assignmentPatterns: {
								default: true,
								description:
									"Allow [] in assignment defaults when inference/type annotation indicates readonly arrays.",
								type: "boolean",
							},
							callArguments: {
								default: true,
								description: "Allow [] as a call or constructor argument.",
								type: "boolean",
							},
							conditionalExpressions: {
								default: true,
								description: "Allow [] in conditional expression branches.",
								type: "boolean",
							},
							forOfStatements: {
								default: true,
								description: "Allow [] used as the iterable in for-of.",
								type: "boolean",
							},
							jsxAttributes: {
								default: true,
								description: "Allow [] as a JSX attribute value.",
								type: "boolean",
							},
							logicalExpressions: {
								default: true,
								description: "Allow [] on the right side of ?? and ||.",
								type: "boolean",
							},
							propertyValues: {
								default: true,
								description: "Allow [] as object property values.",
								type: "boolean",
							},
							returnStatements: {
								default: true,
								description: "Allow [] in return statements.",
								type: "boolean",
							},
							typeAssertions: {
								default: true,
								description:
									"Allow [] in TypeScript type assertion/cast expressions for readonly arrays.",
								type: "boolean",
							},
						},
						type: "object",
					},
					ignoreInferredNonEmptyLiterals: {
						default: true,
						description:
							"When false this option is accepted but intentionally does not change behavior. Non-empty literals remain allowed.",
						type: "boolean",
					},
					inferTypeForEmptyArrayFix: {
						default: false,
						description:
							"When true, uses TypeScript parser services to infer a contextual element type for empty array fixes.",
						type: "boolean",
					},
					requireExplicitGenericOnNewArray: {
						default: true,
						description:
							"When true, auto-fixes include explicit generic type arguments when an element type is known.",
						type: "boolean",
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
	name: "no-empty-array-literal",
});

export default noEmptyArrayLiteral;
