import { createRule } from "$utilities/create-rule";
import { getDefinedValue } from "$utilities/defined-utilities";
import { AST_NODE_TYPES, ESLintUtils } from "@typescript-eslint/utils";
import { regex } from "arktype";
import { IndexKind } from "typescript";

import type { TSESTree } from "@typescript-eslint/types";
import type { TSESLint } from "@typescript-eslint/utils";
import type { Except } from "type-fest";
import type { Type } from "typescript";

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

interface NoEmptyArrayLiteralAllowedContexts {
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

type Options = [NoEmptyArrayLiteralOptions];
type ParserServices = ReturnType<typeof ESLintUtils.getParserServices>;
type TypeAwareParserServices = Except<ParserServices, "program"> & {
	readonly program: NonNullable<ParserServices["program"]>;
};

type ResolvedOptions = Required<NoEmptyArrayLiteralOptions> & {
	readonly allowedEmptyArrayContexts: NoEmptyArrayLiteralContextDefaults;
};

const DEFAULT_OPTIONS: Except<Required<NoEmptyArrayLiteralOptions>, "allowedEmptyArrayContexts"> & {
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

	switch (parent.type) {
		case AST_NODE_TYPES.TSAsExpression:
			return parent;
		case AST_NODE_TYPES.TSNonNullExpression:
			return parent;
		case AST_NODE_TYPES.TSTypeAssertion:
			return parent;
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

function isArgumentOfExpressionCall(
	parent: TSESTree.CallExpression | TSESTree.NewExpression,
	expression: TSESTree.Expression,
): boolean {
	for (const argument of parent.arguments) {
		if (argument === expression) return true;
	}

	return false;
}

function getTypeAssertionAnnotation(expression: TSESTree.Expression): TSESTree.TypeNode | undefined {
	let current = expression;

	while (current.type === AST_NODE_TYPES.ChainExpression || current.type === AST_NODE_TYPES.TSNonNullExpression) {
		current = current.expression;
	}

	if (current.type === AST_NODE_TYPES.TSAsExpression || current.type === AST_NODE_TYPES.TSTypeAssertion) {
		return current.typeAnnotation;
	}

	return undefined;
}

function isAllowedTypeAssertionContext(
	expression: TSESTree.Expression,
	sourceCode: Readonly<TSESLint.SourceCode>,
	context: Readonly<TSESLint.RuleContext<MessageIds, Options>>,
): boolean {
	const typeAnnotation = getTypeAssertionAnnotation(expression);

	return (
		typeAnnotation !== undefined &&
		(isArrayTypeFromTypeNode(typeAnnotation, context) ||
			isArrayTypeNode(typeAnnotation, sourceCode, new Set<string>(), false))
	);
}

// oxlint-disable-next-line sonar/cognitive-complexity -- lol.
function isAllowedEmptyArrayContext(
	node: TSESTree.ArrayExpression,
	sourceCode: Readonly<TSESLint.SourceCode>,
	context: Readonly<TSESLint.RuleContext<MessageIds, Options>>,
	options: Readonly<ResolvedOptions>,
): boolean {
	const usageExpression = getOutermostUsageExpression(node);
	const { parent } = usageExpression;

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
		isAllowedTypeAssertionContext(usageExpression, sourceCode, context)
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
		parent.parent?.type === AST_NODE_TYPES.VariableDeclaration
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
		return isReadonlyArrayTypeFromChecker(node, context);
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

type TypeAliasScopeBody = TSESTree.BlockStatement["body"] | TSESTree.Program["body"];

function findTypeAliasDeclarationInBody(
	body: TypeAliasScopeBody,
	typeName: string,
): TSESTree.TSTypeAliasDeclaration | undefined {
	for (const statement of body) {
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

function getTypeAliasScopeBody(node: TSESTree.Node): TypeAliasScopeBody | undefined {
	switch (node.type) {
		case AST_NODE_TYPES.BlockStatement:
			return node.body;
		case AST_NODE_TYPES.Program:
			return node.body;
		case AST_NODE_TYPES.TSModuleBlock:
			return node.body;
		default:
			return undefined;
	}
}

function findTypeAliasDeclaration(
	typeNode: TSESTree.TypeNode,
	sourceCode: Readonly<TSESLint.SourceCode>,
	typeName: string,
): TSESTree.TSTypeAliasDeclaration | undefined {
	let currentNode: TSESTree.Node | null | undefined = typeNode;

	while (currentNode !== undefined && currentNode !== null) {
		const scopeBody = getTypeAliasScopeBody(currentNode);
		const declaration = scopeBody ? findTypeAliasDeclarationInBody(scopeBody, typeName) : undefined;
		if (declaration) return declaration;

		currentNode = currentNode.parent;
	}

	return findTypeAliasDeclarationInBody(sourceCode.ast.body, typeName);
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
			if (seenAliases.has(name)) return false;

			const aliasDeclaration = findTypeAliasDeclaration(typeNode, sourceCode, name);
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
	typeNode: TSESTree.TypeNode,
	sourceCode: Readonly<TSESLint.SourceCode>,
	seenAliases: Set<string>,
	allowDirectArray: boolean,
): boolean {
	switch (typeNode.type) {
		case AST_NODE_TYPES.TSTypeReference: {
			if (typeNode.typeName.type !== AST_NODE_TYPES.Identifier) return false;
			const { name } = typeNode.typeName;
			if (name === "ReadonlyArray") return true;
			if (name === "Array") return allowDirectArray;
			if (seenAliases.has(name)) return false;

			const aliasDeclaration = findTypeAliasDeclaration(typeNode, sourceCode, name);
			if (!aliasDeclaration) return false;

			seenAliases.add(name);
			return isArrayTypeNode(aliasDeclaration.typeAnnotation, sourceCode, seenAliases, true);
		}
		case AST_NODE_TYPES.TSTypeOperator: {
			return isArrayTypeNode(
				getDefinedValue(typeNode.typeAnnotation, "Expected type operator to include a type annotation."),
				sourceCode,
				seenAliases,
				allowDirectArray,
			);
		}
		default:
			return false;
	}
}

function isArrayTypeAnnotation(
	typeAnnotation: TSESTree.TSTypeAnnotation,
	sourceCode: Readonly<TSESLint.SourceCode>,
): boolean {
	return isArrayTypeNode(typeAnnotation.typeAnnotation, sourceCode, new Set<string>(), false);
}

function isDirectArrayTypeAnnotation(typeAnnotation: TSESTree.TSTypeAnnotation): boolean {
	const { typeAnnotation: annotationType } = typeAnnotation;
	return (
		annotationType.type === AST_NODE_TYPES.TSTypeReference &&
		annotationType.typeName.type === AST_NODE_TYPES.Identifier &&
		annotationType.typeName.name === "Array"
	);
}

function getTypeAwareParserServices(
	context: Readonly<TSESLint.RuleContext<MessageIds, Options>>,
): TypeAwareParserServices | undefined {
	const services = ESLintUtils.getParserServices(context, true);
	const { program } = services;
	if (!program) return undefined;

	return { ...services, program };
}

function isArrayTypeFromTypeNode(
	typeNode: TSESTree.TypeNode,
	context: Readonly<TSESLint.RuleContext<MessageIds, Options>>,
): boolean {
	const parserServices = getTypeAwareParserServices(context);
	if (!parserServices) return false;

	const { esTreeNodeToTSNodeMap } = parserServices;
	const tsNode = esTreeNodeToTSNodeMap.get(typeNode);
	const checker = parserServices.program.getTypeChecker();

	return checker.getIndexTypeOfType(checker.getTypeAtLocation(tsNode), IndexKind.Number) !== undefined;
}

function isArrayTypeFromChecker(
	typeAnnotation: TSESTree.TSTypeAnnotation,
	context: Readonly<TSESLint.RuleContext<MessageIds, Options>>,
): boolean {
	return isArrayTypeFromTypeNode(typeAnnotation.typeAnnotation, context);
}

function isDirectReadonlyArrayAnnotation(
	typeAnnotation: TSESTree.TSTypeAnnotation,
	sourceCode: Readonly<TSESLint.SourceCode>,
): boolean {
	return isReadonlyArrayTypeNode(typeAnnotation.typeAnnotation, sourceCode, new Set<string>());
}

function isReadonlyArrayTypeFromChecker(
	node: TSESTree.ArrayExpression,
	context: Readonly<TSESLint.RuleContext<MessageIds, Options>>,
): boolean {
	const parserServices = getTypeAwareParserServices(context);
	if (!parserServices) return false;

	const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);
	const checker = parserServices.program.getTypeChecker();

	function isReadonlyArrayLike(type: Type): boolean {
		const indexType = checker.getIndexTypeOfType(type, IndexKind.Number);
		return indexType !== undefined && checker.getPropertyOfType(type, "push") === undefined;
	}

	return isReadonlyArrayLike(checker.getContextualType(tsNode) ?? checker.getTypeAtLocation(tsNode));
}

function isReadonlyArrayConstInitializer(
	node: TSESTree.ArrayExpression,
	context: Readonly<TSESLint.RuleContext<MessageIds, Options>>,
): boolean {
	const usageExpression = getOutermostUsageExpression(node);
	const { parent } = usageExpression;
	if (!(parent.type === AST_NODE_TYPES.VariableDeclarator && parent.init === usageExpression)) return false;
	if (parent.parent.kind !== "const") return false;

	const typeAnnotation = getBindingTypeAnnotation(parent.id);
	if (!typeAnnotation) return false;
	if (isDirectReadonlyArrayAnnotation(typeAnnotation, context.sourceCode)) return true;

	return isReadonlyArrayTypeFromChecker(node, context);
}

function extractElementTypeFromTypeText(typeText: string): string {
	return typeText.startsWith("ReadonlyArray<") ? typeText.slice(14, -1) : typeText.slice(6, -1);
}

// oxlint-disable-next-line unicorn/prefer-string-raw -- naur
const IS_ANNOTATION = regex(":\\s*(?<typeText>Array<.+>|ReadonlyArray<.+>)\\s*=", "u");

function extractElementTypeFromAssignmentPatternText(assignmentText: string): string | undefined {
	const annotationMatch = IS_ANNOTATION.exec(assignmentText);
	if (!annotationMatch) return undefined;
	return extractElementTypeFromTypeText(annotationMatch.groups.typeText.trim());
}

function extractElementTypeFromGenericReference(
	typeNode: TSESTree.TypeNode,
	sourceCode: Readonly<TSESLint.SourceCode>,
): string | undefined {
	if (typeNode.type !== AST_NODE_TYPES.TSTypeReference) return undefined;
	if (typeNode.typeName.type !== AST_NODE_TYPES.Identifier) return undefined;
	if (typeNode.typeName.name !== "Array" && typeNode.typeName.name !== "ReadonlyArray") return undefined;
	if (typeNode.typeArguments?.params.length !== 1) return undefined;

	return sourceCode.getText(typeNode.typeArguments.params[0]);
}

function getBindingTypeAnnotation(bindingName: TSESTree.BindingName): TSESTree.TSTypeAnnotation | undefined {
	if (bindingName.type === AST_NODE_TYPES.Identifier) return bindingName.typeAnnotation;
	if (bindingName.type === AST_NODE_TYPES.ArrayPattern) return bindingName.typeAnnotation;
	return bindingName.typeAnnotation;
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
	const parserServices = getTypeAwareParserServices(context);
	if (!parserServices) return undefined;

	const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);
	const checker = parserServices.program.getTypeChecker();

	function getElementTypeTextForExpression(): string | undefined {
		const contextualType = checker.getContextualType(tsNode);
		if (contextualType) {
			const contextualElement = toElementTypeText(contextualType);
			if (contextualElement !== undefined && contextualElement.length > 0) return contextualElement;
		}

		return toElementTypeText(checker.getTypeAtLocation(tsNode));
	}

	function toElementTypeText(candidateType: Type): string | undefined {
		const elementType = checker.getIndexTypeOfType(candidateType, IndexKind.Number);
		return elementType ? checker.typeToString(elementType, tsNode) : undefined;
	}

	return getElementTypeTextForExpression();
}

function createReplacementText(
	elementType: string | undefined,
	options: Readonly<Required<NoEmptyArrayLiteralOptions>>,
): string {
	return options.requireExplicitGenericOnNewArray && elementType !== undefined && elementType.length > 0
		? `new Array<${elementType}>()`
		: "new Array()";
}

const noEmptyArrayLiteral = createRule<Options, MessageIds>({
	create(context) {
		const [userOptions] = context.options;
		const options: ResolvedOptions = {
			...DEFAULT_OPTIONS,
			...userOptions,
			allowedEmptyArrayContexts: {
				...DEFAULT_OPTIONS.allowedEmptyArrayContexts,
				...userOptions.allowedEmptyArrayContexts,
			},
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
	meta: {
		defaultOptions: [DEFAULT_OPTIONS],
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
