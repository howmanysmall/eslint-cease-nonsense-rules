import { createRule } from "$utilities/create-rule";
import { getDefinedValue } from "$utilities/defined-utilities";
import { AST_NODE_TYPES, ESLintUtils } from "@typescript-eslint/utils";
import { isCompilerOptionEnabled, isTypeFlagSet } from "ts-api-utils";
import { getCombinedModifierFlags, ModifierFlags, TypeFlags } from "typescript";

import type { EnvironmentMode } from "$types/environment-mode";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import type { Type, TypeChecker, Node as TypeScriptNode, Symbol as TypeScriptSymbol } from "typescript";

type MessageIds = "useBrackets" | "useDot";

export interface DotNotationOptions {
	readonly allowInaccessibleClassPropertyAccess?: boolean;
	readonly allowIndexSignaturePropertyAccess?: boolean;
	readonly allowKeywords?: boolean;
	readonly allowPattern?: string;
	readonly allowPrivateClassPropertyAccess?: boolean;
	readonly allowProtectedClassPropertyAccess?: boolean;
	readonly environment?: EnvironmentMode;
}

type Options = [DotNotationOptions?];

interface ParserServices {
	readonly esTreeNodeToTSNodeMap: {
		readonly get: (node: TSESTree.Node) => TypeScriptNode;
	};
	readonly getTypeAtLocation: (node: TSESTree.Node) => Type;
}

const DEFAULT_OPTIONS: Required<DotNotationOptions> = {
	allowInaccessibleClassPropertyAccess: false,
	allowIndexSignaturePropertyAccess: false,
	allowKeywords: true,
	allowPattern: "",
	allowPrivateClassPropertyAccess: false,
	allowProtectedClassPropertyAccess: false,
	environment: "standard",
};

const VALID_IDENTIFIER = /^[a-zA-Z_$][\w$]*$/u;
const DECIMAL_INTEGER_PATTERN = /^(?:0|0[0-7]*[89]\d*|[1-9](?:_?\d)*)$/u;
const IDENTIFIER_CONTINUATION = /^[$\p{ID_Continue}]$/u;
const KEYWORDS = new Set([
	"abstract",
	"boolean",
	"break",
	"byte",
	"case",
	"catch",
	"char",
	"class",
	"const",
	"continue",
	"debugger",
	"default",
	"delete",
	"do",
	"double",
	"else",
	"enum",
	"export",
	"extends",
	"false",
	"final",
	"finally",
	"float",
	"for",
	"function",
	"goto",
	"if",
	"implements",
	"import",
	"in",
	"instanceof",
	"int",
	"interface",
	"long",
	"native",
	"new",
	"null",
	"package",
	"private",
	"protected",
	"public",
	"return",
	"short",
	"static",
	"super",
	"switch",
	"synchronized",
	"this",
	"throw",
	"throws",
	"transient",
	"true",
	"try",
	"typeof",
	"var",
	"void",
	"volatile",
	"while",
	"with",
]);
const LITERAL_TYPES_TO_CHECK = new Set(["boolean", "string"]);
interface ReportableComputedProperty {
	readonly formattedValue: string;
	readonly propertyName: string;
}

function isNullLiteral(node: TSESTree.Expression): node is TSESTree.Literal {
	return node.type === AST_NODE_TYPES.Literal && node.value === null && node.raw === "null";
}

function isStaticTemplateLiteral(node: TSESTree.Expression): node is TSESTree.TemplateLiteral {
	return node.type === AST_NODE_TYPES.TemplateLiteral && node.expressions.length === 0;
}

function isDecimalInteger(node: TSESTree.Expression | TSESTree.Super): boolean {
	return (
		node.type === AST_NODE_TYPES.Literal &&
		typeof node.value === "number" &&
		typeof node.raw === "string" &&
		DECIMAL_INTEGER_PATTERN.test(node.raw)
	);
}

function canPropertyTouchNextToken(propertyName: string, rightToken: TSESTree.Token): boolean {
	const lastPropertyCharacter = propertyName.at(-1);
	const [firstTokenCharacter] = rightToken.value;

	return (
		lastPropertyCharacter === undefined ||
		firstTokenCharacter === undefined ||
		!(IDENTIFIER_CONTINUATION.test(lastPropertyCharacter) && IDENTIFIER_CONTINUATION.test(firstTokenCharacter))
	);
}

function getDotReplacementPrefix(node: TSESTree.MemberExpression): "." | " ." | "?." {
	if (node.optional) return "?.";
	return isDecimalInteger(node.object) ? " ." : ".";
}

function getReportableLiteralValue(node: TSESTree.Literal): ReportableComputedProperty | undefined {
	if (typeof node.value === "boolean" && LITERAL_TYPES_TO_CHECK.has("boolean")) {
		return {
			formattedValue: JSON.stringify(node.value),
			propertyName: String(node.value),
		};
	}

	if (typeof node.value === "string" && LITERAL_TYPES_TO_CHECK.has("string")) {
		return {
			formattedValue: JSON.stringify(node.value),
			propertyName: node.value,
		};
	}

	if (isNullLiteral(node)) {
		return {
			formattedValue: "null",
			propertyName: "null",
		};
	}

	return undefined;
}

function getComputedStringPropertyName(node: TSESTree.MemberExpression): string | undefined {
	if (node.property.type !== AST_NODE_TYPES.Literal) return undefined;
	return typeof node.property.value === "string" ? node.property.value : undefined;
}

function resolvePropertySymbol(
	node: TSESTree.MemberExpression,
	checker: TypeChecker,
	services: ParserServices,
	objectType: Type,
): TypeScriptSymbol | undefined {
	const propertyTsNode = services.esTreeNodeToTSNodeMap.get(node.property);
	const directSymbol = checker.getSymbolAtLocation(propertyTsNode);
	if (directSymbol !== undefined) return directSymbol;

	const propertyName = getComputedStringPropertyName(node);
	if (propertyName === undefined) return undefined;

	return objectType.getProperties().find((propertySymbol) => propertySymbol.getName() === propertyName);
}

function getPropertyAccessibility(propertySymbol: TypeScriptSymbol): "private" | "protected" | undefined {
	const declarations = propertySymbol.getDeclarations();
	if (declarations === undefined) return undefined;

	for (const declaration of declarations) {
		const modifierFlags = getCombinedModifierFlags(declaration);
		if ((modifierFlags & ModifierFlags.Private) !== 0) return "private";
		if ((modifierFlags & ModifierFlags.Protected) !== 0) return "protected";
	}

	return undefined;
}

function hasStringIndexSignature(checker: TypeChecker, objectType: Type): boolean {
	return checker
		.getIndexInfosOfType(objectType)
		.some((indexInfo) => isTypeFlagSet(indexInfo.keyType, TypeFlags.StringLike));
}

function hasCommentInComputedProperty(
	context: Readonly<TSESLint.RuleContext<MessageIds, Options>>,
	node: TSESTree.MemberExpression,
): boolean {
	const [, propertyAccessStart] = node.object.range;
	return context.sourceCode.getCommentsInside(node).some((comment) => comment.range[0] >= propertyAccessStart);
}

function shouldSkipForRobloxInaccessibleAccess(
	node: TSESTree.MemberExpression,
	propertySymbol: TypeScriptSymbol | undefined,
	options: Required<DotNotationOptions>,
): boolean {
	if (!(options.allowInaccessibleClassPropertyAccess && options.environment === "roblox-ts")) return false;
	if (!propertySymbol) return false;

	const accessibility = getPropertyAccessibility(propertySymbol);
	if (!(accessibility === "private" || accessibility === "protected")) return false;

	return node.object.type !== AST_NODE_TYPES.ThisExpression && node.object.type !== AST_NODE_TYPES.Super;
}

function reportComputedProperty(
	context: Readonly<TSESLint.RuleContext<MessageIds, Options>>,
	node: TSESTree.MemberExpression,
	property: ReportableComputedProperty,
	options: Required<DotNotationOptions>,
): void {
	const { sourceCode } = context;
	const { formattedValue, propertyName } = property;
	if (
		!(VALID_IDENTIFIER.test(propertyName) && (options.allowKeywords || !KEYWORDS.has(propertyName))) ||
		(options.allowPattern.length > 0 && new RegExp(options.allowPattern, "u").test(propertyName))
	) {
		return;
	}

	context.report({
		data: {
			key: formattedValue,
		},
		*fix(fixer) {
			const nextToken = sourceCode.getTokenAfter(node);

			if (hasCommentInComputedProperty(context, node)) return;

			yield fixer.replaceTextRange(
				[node.object.range[1], node.range[1]],
				`${getDotReplacementPrefix(node)}${propertyName}`,
			);

			if (nextToken?.range[0] === node.range[1] && !canPropertyTouchNextToken(propertyName, nextToken)) {
				yield fixer.insertTextAfter(node, " ");
			}
		},
		messageId: "useDot",
		node: node.property,
	});
}

function reportKeywordProperty(
	context: Readonly<TSESLint.RuleContext<MessageIds, Options>>,
	node: TSESTree.MemberExpression,
	property: TSESTree.Identifier,
): void {
	const { sourceCode } = context;

	context.report({
		data: {
			key: property.name,
		},
		*fix(fixer) {
			const dotToken = sourceCode.getTokenBefore(property);

			if (node.object.type === AST_NODE_TYPES.Identifier && node.object.name === "let" && !node.optional) return;
			if (dotToken !== null && sourceCode.commentsExistBetween(dotToken, property)) return;

			if (!node.optional && dotToken !== null) yield fixer.remove(dotToken);
			yield fixer.replaceText(property, `["${property.name}"]`);
		},
		messageId: "useBrackets",
		node: property,
	});
}

function reportStaticTemplateProperty(
	context: Readonly<TSESLint.RuleContext<MessageIds, Options>>,
	node: TSESTree.MemberExpression,
	options: Required<DotNotationOptions>,
): void {
	if (node.property.type !== AST_NODE_TYPES.TemplateLiteral || !isStaticTemplateLiteral(node.property)) return;

	for (const quasi of node.property.quasis) {
		const cookedValue = getDefinedValue(
			quasi.value.cooked?.toString(),
			"Expected static template property to be cooked.",
		);
		reportComputedProperty(
			context,
			node,
			{
				formattedValue: `\`${cookedValue}\``,
				propertyName: cookedValue,
			},
			options,
		);
		return;
	}
}

function shouldSkipComputedProperty(
	node: TSESTree.MemberExpression,
	checker: TypeChecker,
	objectType: Type,
	propertySymbol: TypeScriptSymbol | undefined,
	allowIndexSignaturePropertyAccess: boolean,
	options: Required<DotNotationOptions>,
): boolean {
	const propertyAccessibility = propertySymbol === undefined ? undefined : getPropertyAccessibility(propertySymbol);

	if (propertyAccessibility === "private" && options.allowPrivateClassPropertyAccess) return true;
	if (propertyAccessibility === "protected" && options.allowProtectedClassPropertyAccess) return true;

	if (
		propertySymbol === undefined &&
		allowIndexSignaturePropertyAccess &&
		hasStringIndexSignature(checker, objectType)
	) {
		return true;
	}

	return shouldSkipForRobloxInaccessibleAccess(node, propertySymbol, options);
}

function reportComputedMemberExpression(
	context: Readonly<TSESLint.RuleContext<MessageIds, Options>>,
	node: TSESTree.MemberExpression,
	checker: TypeChecker,
	services: ParserServices,
	allowIndexSignaturePropertyAccess: boolean,
	options: Required<DotNotationOptions>,
): void {
	const objectType = services.getTypeAtLocation(node.object).getNonNullableType();
	const propertySymbol = resolvePropertySymbol(node, checker, services, objectType);

	if (
		shouldSkipComputedProperty(
			node,
			checker,
			objectType,
			propertySymbol,
			allowIndexSignaturePropertyAccess,
			options,
		)
	) {
		return;
	}

	if (node.property.type === AST_NODE_TYPES.Literal) {
		const literalValue = getReportableLiteralValue(node.property);
		if (literalValue !== undefined) reportComputedProperty(context, node, literalValue, options);
		return;
	}

	reportStaticTemplateProperty(context, node, options);
}

const dotNotation = createRule<Options, MessageIds>({
	create(context, [rawOptions]) {
		const options = { ...DEFAULT_OPTIONS, ...rawOptions };
		const services = ESLintUtils.getParserServices(context);
		const checker = services.program.getTypeChecker();
		const allowIndexSignaturePropertyAccess =
			options.allowIndexSignaturePropertyAccess ||
			isCompilerOptionEnabled(services.program.getCompilerOptions(), "noPropertyAccessFromIndexSignature");

		return {
			MemberExpression(node): void {
				if (node.computed) {
					reportComputedMemberExpression(
						context,
						node,
						checker,
						services,
						allowIndexSignaturePropertyAccess,
						options,
					);
					return;
				}

				if (
					!(options.allowKeywords || node.computed) &&
					node.property.type === AST_NODE_TYPES.Identifier &&
					KEYWORDS.has(node.property.name)
				) {
					reportKeywordProperty(context, node, node.property);
				}
			},
		};
	},
	meta: {
		defaultOptions: [DEFAULT_OPTIONS],
		docs: {
			description: "Enforce dot notation while preserving opt-in roblox-ts visibility-safe bracket access.",
		},
		fixable: "code",
		messages: {
			useBrackets: ".{{key}} is a syntax error.",
			useDot: "[{{key}}] is better written in dot notation.",
		} as const,
		schema: [
			{
				additionalProperties: false,
				properties: {
					allowInaccessibleClassPropertyAccess: {
						default: false,
						description:
							"When true in roblox-ts mode, allows bracket access for private/protected members when dot access is illegal at that site.",
						type: "boolean",
					},
					allowIndexSignaturePropertyAccess: {
						default: false,
						description:
							"Whether to allow accessing properties matched by a string index signature with bracket notation.",
						type: "boolean",
					},
					allowKeywords: {
						default: true,
						description: "Whether to allow bracket notation for keywords such as ['default'].",
						type: "boolean",
					},
					allowPattern: {
						default: "",
						description: "Regular expression of property names allowed to remain in bracket notation.",
						type: "string",
					},
					allowPrivateClassPropertyAccess: {
						default: false,
						description: "Whether to allow bracket notation for class members marked private.",
						type: "boolean",
					},
					allowProtectedClassPropertyAccess: {
						default: false,
						description: "Whether to allow bracket notation for class members marked protected.",
						type: "boolean",
					},
					environment: {
						default: "standard",
						description:
							"Environment mode. roblox-ts enables the optional inaccessible-member escape; standard leaves core dot-notation behavior unchanged.",
						enum: ["roblox-ts", "standard"],
						type: "string",
					},
				},
				type: "object",
			},
		],
		type: "suggestion",
	},
	name: "dot-notation",
});

export default dotNotation;
