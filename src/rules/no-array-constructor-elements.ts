import { AST_NODE_TYPES } from "@typescript-eslint/utils";

import { createRule } from "../utilities/create-rule";

import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

import type { EnvironmentMode } from "../types/environment-mode";

type MessageIds =
	| "avoidConstructorEnumeration"
	| "avoidLengthConstructorInStandard"
	| "avoidSingleArgumentConstructor"
	| "collapseArrayPushInitialization"
	| "requireExplicitGenericOnNewArray"
	| "suggestArrayFromLength"
	| "suggestArrayLiteral"
	| "suggestCollapseArrayPushInitialization";

export interface NoArrayConstructorElementsOptions {
	readonly environment?: EnvironmentMode;
	readonly requireExplicitGenericOnNewArray?: boolean;
}

type Options = [NoArrayConstructorElementsOptions?];

const DEFAULT_OPTIONS: Required<NoArrayConstructorElementsOptions> = {
	environment: "roblox-ts",
	requireExplicitGenericOnNewArray: true,
};

function unwrapExpression(expression: TSESTree.Expression): TSESTree.Expression {
	if (expression.type === AST_NODE_TYPES.ChainExpression) return unwrapExpression(expression.expression);
	if (expression.type === AST_NODE_TYPES.TSAsExpression) return unwrapExpression(expression.expression);
	if (expression.type === AST_NODE_TYPES.TSInstantiationExpression) return unwrapExpression(expression.expression);
	if (expression.type === AST_NODE_TYPES.TSNonNullExpression) return unwrapExpression(expression.expression);
	if (expression.type === AST_NODE_TYPES.TSTypeAssertion) return unwrapExpression(expression.expression);
	return expression;
}

function getMemberPropertyName(memberExpression: TSESTree.MemberExpression): string | undefined {
	if (!memberExpression.computed) {
		if (memberExpression.property.type === AST_NODE_TYPES.Identifier) return memberExpression.property.name;
		return undefined;
	}

	if (memberExpression.property.type !== AST_NODE_TYPES.Literal) return undefined;
	return typeof memberExpression.property.value === "string" ? memberExpression.property.value : undefined;
}

function hasShadowedBinding(
	context: Readonly<TSESLint.RuleContext<MessageIds, Options>>,
	node: TSESTree.Node,
	name: string,
): boolean {
	let scope: TSESLint.Scope.Scope | undefined = context.sourceCode.getScope(node);

	while (scope !== undefined) {
		const variable = scope.set.get(name);
		if (variable !== undefined && variable.defs.length > 0) return true;
		scope = scope.upper ?? undefined;
	}

	return false;
}

function isGlobalArrayConstructor(
	context: Readonly<TSESLint.RuleContext<MessageIds, Options>>,
	node: TSESTree.NewExpression,
): boolean {
	const callee = unwrapExpression(node.callee);
	if (callee.type !== AST_NODE_TYPES.Identifier || callee.name !== "Array") return false;
	return !hasShadowedBinding(context, callee, "Array");
}

function extractElementTypeFromArrayAnnotation(
	typeNode: TSESTree.TypeNode,
	sourceCode: Readonly<TSESLint.SourceCode>,
): string | undefined {
	if (typeNode.type !== AST_NODE_TYPES.TSTypeReference) return undefined;
	if (typeNode.typeName.type !== AST_NODE_TYPES.Identifier) return undefined;
	if (typeNode.typeName.name !== "Array" && typeNode.typeName.name !== "ReadonlyArray") return undefined;
	if (!typeNode.typeArguments || typeNode.typeArguments.params.length !== 1) return undefined;

	const [elementType] = typeNode.typeArguments.params;
	return elementType ? sourceCode.getText(elementType) : undefined;
}

const IS_ANNOTATION = /:\s*(Array<.+>|ReadonlyArray<.+>)\s*=/u;

function hasArrayAnnotationInAssignmentPatternText(assignmentText: string): boolean {
	const annotationMatch = IS_ANNOTATION.exec(assignmentText);
	return Boolean(annotationMatch);
}

function getBindingTypeAnnotation(bindingName: TSESTree.BindingName): TSESTree.TSTypeAnnotation | undefined {
	if (bindingName.type === AST_NODE_TYPES.Identifier) return bindingName.typeAnnotation;
	if (bindingName.type === AST_NODE_TYPES.ArrayPattern) return bindingName.typeAnnotation;
	if (bindingName.type === AST_NODE_TYPES.ObjectPattern) return bindingName.typeAnnotation;
	return undefined;
}

function hasContextualArrayAnnotation(
	node: TSESTree.NewExpression,
	sourceCode: Readonly<TSESLint.SourceCode>,
): boolean {
	const { parent } = node;
	if (!parent) return false;

	if (parent.type === AST_NODE_TYPES.VariableDeclarator && parent.init === node) {
		const typeAnnotation = getBindingTypeAnnotation(parent.id);
		if (!typeAnnotation) return false;
		return extractElementTypeFromArrayAnnotation(typeAnnotation.typeAnnotation, sourceCode) !== undefined;
	}

	if (parent.type === AST_NODE_TYPES.AssignmentPattern && parent.right === node) {
		return hasArrayAnnotationInAssignmentPatternText(sourceCode.getText(parent));
	}

	if (parent.type === AST_NODE_TYPES.PropertyDefinition && parent.value === node && parent.typeAnnotation) {
		return extractElementTypeFromArrayAnnotation(parent.typeAnnotation.typeAnnotation, sourceCode) !== undefined;
	}

	if (parent.type === AST_NODE_TYPES.TSAsExpression && parent.expression === node) {
		return extractElementTypeFromArrayAnnotation(parent.typeAnnotation, sourceCode) !== undefined;
	}

	if (parent.type === AST_NODE_TYPES.TSTypeAssertion && parent.expression === node) {
		return extractElementTypeFromArrayAnnotation(parent.typeAnnotation, sourceCode) !== undefined;
	}

	return false;
}

function isReadonlyArrayAnnotation(typeAnnotation: TSESTree.TSTypeAnnotation | undefined): boolean {
	if (!typeAnnotation) return false;
	const { typeAnnotation: annotationType } = typeAnnotation;
	if (annotationType.type !== AST_NODE_TYPES.TSTypeReference) return false;
	if (annotationType.typeName.type !== AST_NODE_TYPES.Identifier) return false;
	return annotationType.typeName.name === "ReadonlyArray";
}

function isDefinitelyNonNumericExpression(expression: TSESTree.Expression): boolean {
	const unwrapped = unwrapExpression(expression);

	switch (unwrapped.type) {
		case AST_NODE_TYPES.Literal:
			return typeof unwrapped.value !== "number";

		case AST_NODE_TYPES.ArrayExpression:
		case AST_NODE_TYPES.ObjectExpression:
		case AST_NODE_TYPES.ArrowFunctionExpression:
		case AST_NODE_TYPES.FunctionExpression:
		case AST_NODE_TYPES.ClassExpression:
			return true;

		case AST_NODE_TYPES.TemplateLiteral:
			return unwrapped.expressions.length === 0;

		case AST_NODE_TYPES.UnaryExpression:
			return unwrapped.operator === "void" || (unwrapped.operator === "typeof" && !unwrapped.prefix);

		default:
			return false;
	}
}

function isObjectPropertyValueExpression(value: TSESTree.Node): value is TSESTree.Expression {
	return (
		value.type !== AST_NODE_TYPES.ArrayPattern &&
		value.type !== AST_NODE_TYPES.AssignmentPattern &&
		value.type !== AST_NODE_TYPES.ObjectPattern
	);
}

function isExpressionSideEffectSafe(expression: TSESTree.Expression): boolean {
	const unwrapped = unwrapExpression(expression);

	switch (unwrapped.type) {
		case AST_NODE_TYPES.Identifier:
		case AST_NODE_TYPES.Literal:
		case AST_NODE_TYPES.ThisExpression:
			return true;

		case AST_NODE_TYPES.MemberExpression:
			if (unwrapped.optional || unwrapped.object.type === AST_NODE_TYPES.Super) return false;
			if (!isExpressionSideEffectSafe(unwrapped.object)) return false;
			if (!unwrapped.computed) return true;
			return isExpressionSideEffectSafe(unwrapped.property);

		case AST_NODE_TYPES.UnaryExpression:
			if (unwrapped.operator === "delete") return false;
			return isExpressionSideEffectSafe(unwrapped.argument);

		case AST_NODE_TYPES.BinaryExpression:
		case AST_NODE_TYPES.LogicalExpression:
			if (unwrapped.left.type === AST_NODE_TYPES.PrivateIdentifier) return false;
			return isExpressionSideEffectSafe(unwrapped.left) && isExpressionSideEffectSafe(unwrapped.right);

		case AST_NODE_TYPES.ConditionalExpression:
			return (
				isExpressionSideEffectSafe(unwrapped.test) &&
				isExpressionSideEffectSafe(unwrapped.consequent) &&
				isExpressionSideEffectSafe(unwrapped.alternate)
			);

		case AST_NODE_TYPES.TemplateLiteral:
			for (const part of unwrapped.expressions) if (!isExpressionSideEffectSafe(part)) return false;
			return true;

		case AST_NODE_TYPES.ArrayExpression:
			for (const element of unwrapped.elements) {
				if (!element) continue;
				if (element.type === AST_NODE_TYPES.SpreadElement) return false;
				if (!isExpressionSideEffectSafe(element)) return false;
			}
			return true;

		case AST_NODE_TYPES.ObjectExpression:
			for (const property of unwrapped.properties) {
				if (property.type === AST_NODE_TYPES.SpreadElement) return false;
				if (property.type !== AST_NODE_TYPES.Property) return false;
				if (property.kind !== "init" || property.method) return false;
				if (property.computed && !isExpressionSideEffectSafe(property.key)) return false;
				if (!isObjectPropertyValueExpression(property.value)) return false;
				if (!isExpressionSideEffectSafe(property.value)) return false;
			}
			return true;

		case AST_NODE_TYPES.SequenceExpression:
			return unwrapped.expressions.every(isExpressionSideEffectSafe);

		case AST_NODE_TYPES.AwaitExpression:
		case AST_NODE_TYPES.YieldExpression:
		case AST_NODE_TYPES.AssignmentExpression:
		case AST_NODE_TYPES.UpdateExpression:
		case AST_NODE_TYPES.CallExpression:
		case AST_NODE_TYPES.NewExpression:
		case AST_NODE_TYPES.ImportExpression:
		case AST_NODE_TYPES.TaggedTemplateExpression:
		case AST_NODE_TYPES.ChainExpression:
			return false;

		default:
			return false;
	}
}

function getPushCallForIdentifier(
	expression: TSESTree.Expression,
	identifierName: string,
): TSESTree.CallExpression | undefined {
	const unwrapped = unwrapExpression(expression);
	if (unwrapped.type !== AST_NODE_TYPES.CallExpression || unwrapped.optional) return undefined;
	if (unwrapped.callee.type !== AST_NODE_TYPES.MemberExpression || unwrapped.callee.optional) return undefined;
	if (unwrapped.callee.object.type !== AST_NODE_TYPES.Identifier || unwrapped.callee.object.name !== identifierName) {
		return undefined;
	}

	const propertyName = getMemberPropertyName(unwrapped.callee);
	if (propertyName !== "push") return undefined;
	return unwrapped;
}

function containsLaterPushCall(
	statements: ReadonlyArray<TSESTree.ProgramStatement>,
	startIndex: number,
	identifierName: string,
): boolean {
	for (let index = startIndex; index < statements.length; index += 1) {
		const statement = statements[index];
		if (statement?.type !== AST_NODE_TYPES.ExpressionStatement) continue;
		if (getPushCallForIdentifier(statement.expression, identifierName)) return true;
	}

	return false;
}

function buildArrayLiteralFromArguments(
	argumentsList: ReadonlyArray<TSESTree.CallExpressionArgument>,
	sourceCode: Readonly<TSESLint.SourceCode>,
): string {
	const parts = new Array<string>();

	for (const argument of argumentsList) {
		if (argument.type === AST_NODE_TYPES.SpreadElement) {
			parts.push(`...${sourceCode.getText(argument.argument)}`);
			continue;
		}

		parts.push(sourceCode.getText(argument));
	}

	return `[${parts.join(", ")}]`;
}

function createCollapseFixes(
	fixer: TSESLint.RuleFixer,
	sourceCode: Readonly<TSESLint.SourceCode>,
	declarator: TSESTree.VariableDeclarator,
	pushStatements: ReadonlyArray<TSESTree.ExpressionStatement>,
	arrayLiteralText: string,
): ReadonlyArray<TSESLint.RuleFix> {
	if (!declarator.init || pushStatements.length === 0) return [];

	const [firstPush] = pushStatements;
	const lastPush = pushStatements.at(-1);
	if (!(firstPush && lastPush)) return [];

	const [initialCollapseStart] = firstPush.range;
	let collapseStart = initialCollapseStart;
	while (collapseStart > 0) {
		const previousCharacter = sourceCode.text[collapseStart - 1];
		if (previousCharacter === " " || previousCharacter === "\t") {
			collapseStart -= 1;
			continue;
		}

		if (previousCharacter === "\n") collapseStart -= 1;
		break;
	}

	return [
		fixer.replaceText(declarator.init, arrayLiteralText),
		fixer.removeRange([collapseStart, lastPush.range[1]]),
	];
}

export default createRule<Options, MessageIds>({
	create(context) {
		const options: Required<NoArrayConstructorElementsOptions> = {
			...DEFAULT_OPTIONS,
			...context.options[0],
		};
		const { sourceCode } = context;

		function inspectPushCollapse(statements: ReadonlyArray<TSESTree.ProgramStatement>): void {
			for (let index = 0; index < statements.length; index += 1) {
				const statement = statements[index];
				if (!statement || statement.type !== AST_NODE_TYPES.VariableDeclaration) continue;
				if (statement.kind !== "const" && statement.kind !== "let") continue;
				if (statement.declarations.length !== 1) continue;

				const [declarator] = statement.declarations;
				if (!declarator) continue;
				if (declarator.id.type !== AST_NODE_TYPES.Identifier) continue;
				if (!declarator.init || declarator.init.type !== AST_NODE_TYPES.NewExpression) continue;
				if (!isGlobalArrayConstructor(context, declarator.init)) continue;
				if (declarator.init.arguments.length > 0) continue;
				if (isReadonlyArrayAnnotation(getBindingTypeAnnotation(declarator.id))) continue;
				const arrayIdentifierName = declarator.id.name;

				const pushStatements = new Array<TSESTree.ExpressionStatement>();
				const collapsedArgumentParts = new Array<string>();
				let hasSpreadArgument = false;
				let scanIndex = index + 1;

				while (scanIndex < statements.length) {
					const nextStatement = statements[scanIndex];
					if (!nextStatement || nextStatement.type !== AST_NODE_TYPES.ExpressionStatement) break;

					const pushCall = getPushCallForIdentifier(nextStatement.expression, arrayIdentifierName);
					if (!pushCall || pushCall.arguments.length === 0) break;

					pushStatements.push(nextStatement);
					for (const argument of pushCall.arguments) {
						if (argument.type === AST_NODE_TYPES.SpreadElement) {
							hasSpreadArgument = true;
							collapsedArgumentParts.push(`...${sourceCode.getText(argument.argument)}`);
							continue;
						}

						collapsedArgumentParts.push(sourceCode.getText(argument));
					}

					scanIndex += 1;
				}

				if (pushStatements.length === 0) continue;
				if (containsLaterPushCall(statements, scanIndex, arrayIdentifierName)) continue;

				const literalText = `[${collapsedArgumentParts.join(", ")}]`;

				const hasUnsafeArgument =
					hasSpreadArgument ||
					pushStatements.some((pushStatement) => {
						const callExpression = getPushCallForIdentifier(pushStatement.expression, arrayIdentifierName);
						if (!callExpression) return true;

						for (const argument of callExpression.arguments) {
							if (argument.type === AST_NODE_TYPES.SpreadElement) return true;
							if (!isExpressionSideEffectSafe(argument)) return true;
						}

						return false;
					});

				if (!hasUnsafeArgument) {
					context.report({
						fix: (fixer) => createCollapseFixes(fixer, sourceCode, declarator, pushStatements, literalText),
						messageId: "collapseArrayPushInitialization",
						node: statement,
					});
					continue;
				}

				context.report({
					messageId: "collapseArrayPushInitialization",
					node: statement,
					suggest: [
						{
							fix: (fixer): ReadonlyArray<TSESLint.RuleFix> =>
								createCollapseFixes(fixer, sourceCode, declarator, pushStatements, literalText),
							messageId: "suggestCollapseArrayPushInitialization",
						},
					],
				});
			}
		}

		return {
			BlockStatement(node): void {
				inspectPushCollapse(node.body);
			},

			NewExpression(node): void {
				if (!isGlobalArrayConstructor(context, node)) return;

				if (node.arguments.length === 0) {
					if (!options.requireExplicitGenericOnNewArray) return;

					const hasTypeArguments = Boolean(node.typeArguments && node.typeArguments.params.length > 0);
					if (hasTypeArguments || hasContextualArrayAnnotation(node, sourceCode)) return;

					context.report({
						messageId: "requireExplicitGenericOnNewArray",
						node,
					});
					return;
				}

				if (node.arguments.length > 1) {
					const [firstArgument] = node.arguments;
					if (
						firstArgument &&
						firstArgument.type !== AST_NODE_TYPES.SpreadElement &&
						options.environment === "roblox-ts" &&
						!isDefinitelyNonNumericExpression(firstArgument)
					) {
						return;
					}

					if (firstArgument === undefined) return;

					const literalText = buildArrayLiteralFromArguments(node.arguments, sourceCode);
					const hasSpread = node.arguments.some((argument) => argument.type === AST_NODE_TYPES.SpreadElement);

					if (!hasSpread) {
						context.report({
							fix: (fixer) => fixer.replaceText(node, literalText),
							messageId: "avoidConstructorEnumeration",
							node,
						});
						return;
					}

					context.report({
						messageId: "avoidConstructorEnumeration",
						node,
						suggest: [
							{
								fix: (fixer): TSESLint.RuleFix => fixer.replaceText(node, literalText),
								messageId: "suggestArrayLiteral",
							},
						],
					});
					return;
				}

				const [firstArgument] = node.arguments;
				if (!firstArgument) return;

				if (firstArgument.type === AST_NODE_TYPES.SpreadElement) {
					context.report({
						messageId: "avoidSingleArgumentConstructor",
						node,
						suggest: [
							{
								fix: (fixer): TSESLint.RuleFix =>
									fixer.replaceText(node, `[...${sourceCode.getText(firstArgument.argument)}]`),
								messageId: "suggestArrayLiteral",
							},
						],
					});
					return;
				}

				if (!isDefinitelyNonNumericExpression(firstArgument)) {
					if (options.environment === "roblox-ts") return;

					const lengthExpressionText = sourceCode.getText(firstArgument);
					context.report({
						messageId: "avoidLengthConstructorInStandard",
						node,
						suggest: [
							{
								fix: (fixer): TSESLint.RuleFix =>
									fixer.replaceText(node, `Array.from({ length: ${lengthExpressionText} })`),
								messageId: "suggestArrayFromLength",
							},
						],
					});
					return;
				}

				const singleElementLiteral = `[${sourceCode.getText(firstArgument)}]`;
				context.report({
					fix: (fixer) => fixer.replaceText(node, singleElementLiteral),
					messageId: "avoidSingleArgumentConstructor",
					node,
				});
			},
			Program(node): void {
				inspectPushCollapse(node.body);
			},
		};
	},
	defaultOptions: [DEFAULT_OPTIONS],
	meta: {
		docs: {
			description: "Disallow array constructor element forms and enforce roblox-ts-aware constructor patterns.",
		},
		fixable: "code",
		hasSuggestions: true,
		messages: {
			avoidConstructorEnumeration:
				"Do not use Array constructor enumeration arguments. Use an array literal instead.",
			avoidLengthConstructorInStandard:
				"Length-based Array constructor is not allowed in standard mode. Prefer Array.from({ length: n }).",
			avoidSingleArgumentConstructor:
				"Single-argument Array constructor form is not allowed here. Use an array literal instead.",
			collapseArrayPushInitialization:
				"Collapse new Array<T>() + consecutive .push(...) calls into a single array literal initializer.",
			requireExplicitGenericOnNewArray:
				"new Array() must use an explicit generic argument or a contextual Array<T>/ReadonlyArray<T> annotation.",
			suggestArrayFromLength: "Replace with Array.from({ length: value }).",
			suggestArrayLiteral: "Replace constructor form with an array literal.",
			suggestCollapseArrayPushInitialization:
				"Collapse constructor + push sequence into a single array literal initializer.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					environment: {
						default: "roblox-ts",
						description:
							"Array constructor environment mode: 'roblox-ts' allows new Array(length); 'standard' reports it.",
						enum: ["roblox-ts", "standard"],
						type: "string",
					},
					requireExplicitGenericOnNewArray: {
						default: true,
						description:
							"When true, zero-argument new Array() requires explicit generic type arguments or contextual array typing.",
						type: "boolean",
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
	name: "no-array-constructor-elements",
});
