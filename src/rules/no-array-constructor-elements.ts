import { getMemberPropertyName, hasShadowedBinding, unwrapExpression } from "$utilities/ast-utilities";
import { createRule } from "$utilities/create-rule";
import { getArrayElementTypeText, getBindingTypeAnnotation } from "$utilities/typescript-node-utilities";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";

import type { EnvironmentMode } from "$types/environment-mode";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

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

function isGlobalArrayConstructor(
	context: Readonly<TSESLint.RuleContext<MessageIds, Options>>,
	node: TSESTree.NewExpression,
): boolean {
	const callee = unwrapExpression(node.callee);
	if (callee.type !== AST_NODE_TYPES.Identifier || callee.name !== "Array") return false;
	return !hasShadowedBinding(context.sourceCode, callee, "Array");
}

const IS_ANNOTATION = /:\s*(?:Array<.+>|ReadonlyArray<.+>)\s*=/u;

function hasArrayAnnotationInAssignmentPatternText(assignmentText: string): boolean {
	const annotationMatch = IS_ANNOTATION.exec(assignmentText);
	return Boolean(annotationMatch);
}

function hasContextualArrayAnnotation(
	node: TSESTree.NewExpression,
	sourceCode: Readonly<TSESLint.SourceCode>,
): boolean {
	const { parent } = node;
	if (parent.type === AST_NODE_TYPES.VariableDeclarator && parent.init === node) {
		const typeAnnotation = getBindingTypeAnnotation(parent.id);
		if (!typeAnnotation) return false;
		return getArrayElementTypeText(typeAnnotation.typeAnnotation, sourceCode) !== undefined;
	}

	if (parent.type === AST_NODE_TYPES.AssignmentPattern && parent.right === node) {
		return hasArrayAnnotationInAssignmentPatternText(sourceCode.getText(parent));
	}

	if (parent.type === AST_NODE_TYPES.PropertyDefinition && parent.value === node && parent.typeAnnotation) {
		return getArrayElementTypeText(parent.typeAnnotation.typeAnnotation, sourceCode) !== undefined;
	}

	if (parent.type === AST_NODE_TYPES.TSAsExpression && parent.expression === node) {
		return getArrayElementTypeText(parent.typeAnnotation, sourceCode) !== undefined;
	}

	if (parent.type === AST_NODE_TYPES.TSTypeAssertion && parent.expression === node) {
		return getArrayElementTypeText(parent.typeAnnotation, sourceCode) !== undefined;
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
			return unwrapped.operator === "void" || unwrapped.operator === "typeof";

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

function onMemberExpression(unwrapped: TSESTree.MemberExpression): boolean {
	if (
		unwrapped.optional ||
		unwrapped.object.type === AST_NODE_TYPES.Super ||
		!isExpressionSideEffectSafe(unwrapped.object)
	) {
		return false;
	}
	if (!unwrapped.computed) return true;
	return isExpressionSideEffectSafe(unwrapped.property);
}
function onObjectExpression(unwrapped: TSESTree.ObjectExpression): boolean {
	for (const property of unwrapped.properties) {
		if (property.type === AST_NODE_TYPES.SpreadElement) return false;
		if (property.kind !== "init" || property.method) return false;
		if (property.computed && !isExpressionSideEffectSafe(property.key)) return false;
		if (isObjectPropertyValueExpression(property.value) && !isExpressionSideEffectSafe(property.value)) {
			return false;
		}
	}
	return true;
}
function onArrayExpression(unwrapped: TSESTree.ArrayExpression): boolean {
	for (const element of unwrapped.elements) {
		if (element === null) continue;
		if (element.type === AST_NODE_TYPES.SpreadElement || !isExpressionSideEffectSafe(element)) return false;
	}
	return true;
}

function isExpressionSideEffectSafe(expression: TSESTree.Expression): boolean {
	const unwrapped = unwrapExpression(expression);

	switch (unwrapped.type) {
		case AST_NODE_TYPES.Identifier:
		case AST_NODE_TYPES.Literal:
		case AST_NODE_TYPES.ThisExpression:
			return true;

		case AST_NODE_TYPES.MemberExpression:
			return onMemberExpression(unwrapped);

		case AST_NODE_TYPES.UnaryExpression: {
			if (unwrapped.operator === "delete") return false;
			return isExpressionSideEffectSafe(unwrapped.argument);
		}

		case AST_NODE_TYPES.BinaryExpression:
		case AST_NODE_TYPES.LogicalExpression: {
			if (unwrapped.left.type === AST_NODE_TYPES.PrivateIdentifier) return false;
			return isExpressionSideEffectSafe(unwrapped.left) && isExpressionSideEffectSafe(unwrapped.right);
		}

		case AST_NODE_TYPES.ConditionalExpression: {
			return (
				isExpressionSideEffectSafe(unwrapped.test) &&
				isExpressionSideEffectSafe(unwrapped.consequent) &&
				isExpressionSideEffectSafe(unwrapped.alternate)
			);
		}

		case AST_NODE_TYPES.TemplateLiteral: {
			for (const part of unwrapped.expressions) if (!isExpressionSideEffectSafe(part)) return false;
			return true;
		}

		case AST_NODE_TYPES.ArrayExpression:
			return onArrayExpression(unwrapped);

		case AST_NODE_TYPES.ObjectExpression:
			return onObjectExpression(unwrapped);

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

type NonEmptyReadonlyArray<TValue> = readonly [TValue, ...Array<TValue>];

function createCollapseFixes(
	fixer: TSESLint.RuleFixer,
	sourceCode: Readonly<TSESLint.SourceCode>,
	arrayInitializer: TSESTree.NewExpression,
	pushStatements: NonEmptyReadonlyArray<TSESTree.ExpressionStatement>,
	arrayLiteralText: string,
): ReadonlyArray<TSESLint.RuleFix> {
	const [firstPush] = pushStatements;
	let lastPush = firstPush;
	for (const pushStatement of pushStatements) lastPush = pushStatement;

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
		fixer.replaceText(arrayInitializer, arrayLiteralText),
		fixer.removeRange([collapseStart, lastPush.range[1]]),
	];
}

interface PushCollapseCandidate {
	readonly arrayIdentifierName: string;
	readonly arrayInitializer: TSESTree.NewExpression;
	readonly statement: TSESTree.VariableDeclaration;
}

interface PushCollapseScan {
	readonly collapsedArgumentParts: ReadonlyArray<string>;
	readonly hasUnsafeArgument: boolean;
	readonly pushStatements: ReadonlyArray<TSESTree.ExpressionStatement>;
	readonly scanIndex: number;
}

interface NonEmptyPushCollapseScan extends PushCollapseScan {
	readonly pushStatements: NonEmptyReadonlyArray<TSESTree.ExpressionStatement>;
}

function hasPushStatements(scan: PushCollapseScan): scan is NonEmptyPushCollapseScan {
	return scan.pushStatements.length > 0;
}

function getPushCollapseCandidate(
	context: Readonly<TSESLint.RuleContext<MessageIds, Options>>,
	statement: TSESTree.ProgramStatement,
): PushCollapseCandidate | undefined {
	if (statement.type !== AST_NODE_TYPES.VariableDeclaration) return undefined;
	if (statement.kind !== "const" && statement.kind !== "let") return undefined;

	const declarator = statement.declarations.length === 1 ? statement.declarations[0] : undefined;
	if (!declarator) return undefined;
	if (declarator.id.type !== AST_NODE_TYPES.Identifier) return undefined;
	if (!declarator.init || declarator.init.type !== AST_NODE_TYPES.NewExpression) return undefined;
	if (!isGlobalArrayConstructor(context, declarator.init)) return undefined;
	if (declarator.init.arguments.length > 0) return undefined;
	if (isReadonlyArrayAnnotation(getBindingTypeAnnotation(declarator.id))) return undefined;

	return {
		arrayIdentifierName: declarator.id.name,
		arrayInitializer: declarator.init,
		statement,
	};
}

function scanPushCalls(
	statements: ReadonlyArray<TSESTree.ProgramStatement>,
	startIndex: number,
	arrayIdentifierName: string,
	sourceCode: Readonly<TSESLint.SourceCode>,
): PushCollapseScan {
	const pushStatements = new Array<TSESTree.ExpressionStatement>();
	const collapsedArgumentParts = new Array<string>();
	let hasUnsafeArgument = false;
	let scanIndex = startIndex;

	while (scanIndex < statements.length) {
		const nextStatement = statements[scanIndex];
		if (nextStatement?.type !== AST_NODE_TYPES.ExpressionStatement) break;

		const pushCall = getPushCallForIdentifier(nextStatement.expression, arrayIdentifierName);
		if (!pushCall || pushCall.arguments.length === 0) break;

		pushStatements.push(nextStatement);
		for (const argument of pushCall.arguments) {
			if (argument.type === AST_NODE_TYPES.SpreadElement) {
				hasUnsafeArgument = true;
				collapsedArgumentParts.push(`...${sourceCode.getText(argument.argument)}`);
				continue;
			}

			if (!isExpressionSideEffectSafe(argument)) hasUnsafeArgument = true;
			collapsedArgumentParts.push(sourceCode.getText(argument));
		}

		scanIndex += 1;
	}

	return {
		collapsedArgumentParts,
		hasUnsafeArgument,
		pushStatements,
		scanIndex,
	};
}

const noArrayConstructorElements = createRule<Options, MessageIds>({
	create(context) {
		const options: Required<NoArrayConstructorElementsOptions> = {
			...DEFAULT_OPTIONS,
			...context.options[0],
		};
		const { sourceCode } = context;

		function reportPushCollapse(candidate: PushCollapseCandidate, scan: NonEmptyPushCollapseScan): void {
			const literalText = `[${scan.collapsedArgumentParts.join(", ")}]`;

			if (!scan.hasUnsafeArgument) {
				context.report({
					fix: (fixer) =>
						createCollapseFixes(
							fixer,
							sourceCode,
							candidate.arrayInitializer,
							scan.pushStatements,
							literalText,
						),
					messageId: "collapseArrayPushInitialization",
					node: candidate.statement,
				});
				return;
			}

			context.report({
				messageId: "collapseArrayPushInitialization",
				node: candidate.statement,
				suggest: [
					{
						fix: (fixer): ReadonlyArray<TSESLint.RuleFix> =>
							createCollapseFixes(
								fixer,
								sourceCode,
								candidate.arrayInitializer,
								scan.pushStatements,
								literalText,
							),
						messageId: "suggestCollapseArrayPushInitialization",
					},
				],
			});
		}

		function inspectPushCollapse(statements: ReadonlyArray<TSESTree.ProgramStatement>): void {
			for (const [index, statement] of statements.entries()) {
				const candidate = getPushCollapseCandidate(context, statement);
				if (!candidate) continue;

				const scan = scanPushCalls(statements, index + 1, candidate.arrayIdentifierName, sourceCode);
				if (!hasPushStatements(scan)) continue;
				if (containsLaterPushCall(statements, scan.scanIndex, candidate.arrayIdentifierName)) continue;

				reportPushCollapse(candidate, scan);
			}
		}

		function reportZeroArgumentConstructor(node: TSESTree.NewExpression): void {
			if (!options.requireExplicitGenericOnNewArray) return;

			const hasTypeArguments = Boolean(node.typeArguments && node.typeArguments.params.length > 0);
			if (hasTypeArguments || hasContextualArrayAnnotation(node, sourceCode)) return;

			context.report({
				messageId: "requireExplicitGenericOnNewArray",
				node,
			});
		}

		function reportMultipleArgumentConstructor(
			node: TSESTree.NewExpression,
			firstArgument: TSESTree.CallExpressionArgument,
		): void {
			if (
				firstArgument.type !== AST_NODE_TYPES.SpreadElement &&
				options.environment === "roblox-ts" &&
				!isDefinitelyNonNumericExpression(firstArgument)
			) {
				return;
			}

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
		}

		function reportSingleArgumentConstructor(
			node: TSESTree.NewExpression,
			firstArgument: TSESTree.CallExpressionArgument,
		): void {
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
		}

		function inspectArrayConstructor(node: TSESTree.NewExpression): void {
			if (!isGlobalArrayConstructor(context, node)) return;

			if (node.arguments.length === 0) {
				reportZeroArgumentConstructor(node);
				return;
			}

			if (node.arguments.length > 1) {
				for (const firstArgument of node.arguments) {
					reportMultipleArgumentConstructor(node, firstArgument);
					return;
				}
			}

			for (const firstArgument of node.arguments) reportSingleArgumentConstructor(node, firstArgument);
		}

		return {
			BlockStatement(node): void {
				inspectPushCollapse(node.body);
			},

			NewExpression(node): void {
				inspectArrayConstructor(node);
			},
			Program(node): void {
				inspectPushCollapse(node.body);
			},
		};
	},
	meta: {
		defaultOptions: [DEFAULT_OPTIONS],
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

export default noArrayConstructorElements;
