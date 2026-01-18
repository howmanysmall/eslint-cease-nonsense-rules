import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES, ESLintUtils } from "@typescript-eslint/utils";
import { regex } from "arkregex";
import { isPropertyReadonlyInType } from "ts-api-utils";
import type { IndexInfo, Symbol as TSSymbol, Type, TypeChecker } from "typescript";
import { createRule } from "../utilities/create-rule";

type MessageIds = "preferReadOnlyProps" | "readOnlyProp";
type Options = [];

const COMPONENT_NAME_PATTERN = regex("^[A-Z]", "u");
const LOWERCASE_PATTERN = regex("[a-z]", "u");
const READONLY_WRAPPER_NAMES = new Set(["Readonly", "ReadonlyArray", "ReadonlyDeep", "DeepReadonly", "DeepReadOnly"]);
const REACT_BUILTIN_PROPS = new Set(["children", "key", "ref"]);
const REACT_FC_TYPE_NAMES = new Set(["FC", "FunctionComponent", "VFC", "VoidFunctionComponent"]);
const REACT_FORWARD_REF_NAMES = new Set(["forwardRef"]);
const REACT_MEMO_NAMES = new Set(["memo"]);
const REACT_ELEMENT_TYPE_NAMES = new Set(["Element", "ReactElement", "ReactNode", "ReactChild", "ReactFragment"]);

function isPropertyReadonlyInTypeOrBase(checker: TypeChecker, type: Type, property: TSSymbol): boolean {
	const escapedName = property.getEscapedName();

	if (isPropertyReadonlyInType(type, escapedName, checker)) return true;

	const baseTypes = type.getBaseTypes?.() ?? [];
	for (const baseType of baseTypes) {
		const baseProperties = checker.getPropertiesOfType(baseType);
		const baseProperty = baseProperties.find((property) => property.getEscapedName() === escapedName);
		if (baseProperty && isPropertyReadonlyInType(baseType, escapedName, checker)) return true;
	}

	return false;
}

function isTypeFullyReadonly(checker: TypeChecker, type: Type, visited = new WeakSet<Type>()): boolean {
	if (visited.has(type)) return true;
	visited.add(type);

	const aliasSymbol = type.aliasSymbol ?? type.getSymbol();
	if (aliasSymbol) {
		const name = aliasSymbol.getName();
		if (READONLY_WRAPPER_NAMES.has(name)) return true;
	}

	if (type.isUnion()) return type.types.every((unionType) => isTypeFullyReadonly(checker, unionType, visited));

	if (type.isIntersection()) {
		return type.types.every((intersectionType) => isTypeFullyReadonly(checker, intersectionType, visited));
	}

	const indexInfos: ReadonlyArray<IndexInfo> = checker.getIndexInfosOfType(type);
	for (const indexInfo of indexInfos) if (!indexInfo.isReadonly) return false;

	const properties = checker.getPropertiesOfType(type);
	if (properties.length === 0) return true;

	for (const property of properties) {
		const propertyName = property.getName();
		if (REACT_BUILTIN_PROPS.has(propertyName)) continue;
		if (!isPropertyReadonlyInTypeOrBase(checker, type, property)) return false;
	}

	return true;
}

function isFunctionLike(
	node: TSESTree.Node,
): node is TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression {
	return (
		node.type === AST_NODE_TYPES.FunctionDeclaration ||
		node.type === AST_NODE_TYPES.FunctionExpression ||
		node.type === AST_NODE_TYPES.ArrowFunctionExpression
	);
}

function isComponentName(name: string): boolean {
	// React components use PascalCase:
	// - Starts with uppercase
	// - No underscores (excludes SCREAMING_SNAKE_CASE like DEFAULT_FIND_FIRST_CHILD)
	// - Has lowercase letters (excludes ALLCAPS constants like ABC)
	if (name.includes("_")) return false;
	if (!LOWERCASE_PATTERN.test(name)) return false;
	return COMPONENT_NAME_PATTERN.test(name);
}

function isDefinitelyNotReactReturnType(checker: TypeChecker, type: Type): boolean {
	// Handle unions - if any member could be a React element, return false
	if (type.isUnion()) {
		return type.types.every((memberType) => isDefinitelyNotReactReturnType(checker, memberType));
	}

	const typeString = checker.typeToString(type);

	// Null is a valid React return
	if (typeString === "null") return false;

	// Check for React element patterns in type string
	if (typeString.includes("Element") || typeString.includes("ReactNode") || typeString.includes("ReactElement")) {
		return false;
	}

	// Check symbol for known React element types
	const symbol = type.getSymbol() ?? type.aliasSymbol;
	if (symbol) {
		const name = symbol.getName();
		if (REACT_ELEMENT_TYPE_NAMES.has(name)) return false;
	}

	// Primitives that are clearly not React elements
	if (
		typeString === "string" ||
		typeString === "number" ||
		typeString === "boolean" ||
		typeString === "undefined" ||
		typeString === "void" ||
		typeString === "never"
	) {
		return true;
	}

	// Custom named types that don't match React patterns are probably not React elements.
	// We need to be conservative - only filter out if the type has a clear symbol
	// That's not a React type
	if (symbol) {
		const name = symbol.getName();
		// If it's a named type that's not a React element type, it's probably not a component return
		if (!(REACT_ELEMENT_TYPE_NAMES.has(name) || name.includes("Element"))) {
			return true;
		}
	}

	// Default: assume it might be a React element (conservative)
	return false;
}

function isReactComponentFunction(checker: TypeChecker, functionType: Type): boolean {
	const callSignatures = functionType.getCallSignatures();

	// Can't determine return type, assume it might be a component
	if (callSignatures.length === 0) return true;

	const [firstSignature] = callSignatures;

	// Can't determine return type
	if (!firstSignature) return true;

	const returnType = checker.getReturnTypeOfSignature(firstSignature);
	return !isDefinitelyNotReactReturnType(checker, returnType);
}

function getTypeLiteralFromParameter(parameter: TSESTree.Node | undefined): TSESTree.TSTypeLiteral | undefined {
	if (!parameter) return undefined;

	if (parameter.type === AST_NODE_TYPES.Identifier) {
		const annotation = parameter.typeAnnotation?.typeAnnotation;
		return annotation?.type === AST_NODE_TYPES.TSTypeLiteral ? annotation : undefined;
	}

	if (parameter.type === AST_NODE_TYPES.AssignmentPattern) return getTypeLiteralFromParameter(parameter.left);
	if (parameter.type === AST_NODE_TYPES.RestElement) return getTypeLiteralFromParameter(parameter.argument);
	if (parameter.type === AST_NODE_TYPES.TSParameterProperty) return getTypeLiteralFromParameter(parameter.parameter);

	return undefined;
}

function getPropertyName(member: TSESTree.TSPropertySignature): string {
	if (member.key.type === AST_NODE_TYPES.Identifier) return member.key.name;
	return "unknown";
}

const preferReadOnlyPropsRule = createRule<Options, MessageIds>({
	create(context) {
		function reportTypeLiteral(typeLiteral: TSESTree.TSTypeLiteral): void {
			for (const member of typeLiteral.members) {
				if (member.type !== AST_NODE_TYPES.TSPropertySignature || member.readonly || member.computed) {
					continue;
				}

				const { key } = member;
				if (key.type !== AST_NODE_TYPES.Identifier && key.type !== AST_NODE_TYPES.Literal) continue;

				context.report({
					data: {
						name: getPropertyName(member),
					},
					fix(fixer) {
						return fixer.insertTextBefore(key, "readonly ");
					},
					messageId: "readOnlyProp",
					node: member,
				});
			}
		}

		function reportPropertiesFromFunction(
			node: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression,
		): void {
			for (const parameter of node.params) {
				const typeLiteral = getTypeLiteralFromParameter(parameter);
				if (typeLiteral) reportTypeLiteral(typeLiteral);
			}
		}

		const services = ESLintUtils.getParserServices(context, true);
		const { program } = services;

		if (!program) {
			return {
				FunctionDeclaration(node): void {
					if (!(node.id && isComponentName(node.id.name))) return;
					reportPropertiesFromFunction(node);
				},
				VariableDeclarator(node): void {
					if (node.id.type !== AST_NODE_TYPES.Identifier || !isComponentName(node.id.name)) return;
					if (node.init && isFunctionLike(node.init)) reportPropertiesFromFunction(node.init);
				},
			};
		}

		const checker = program.getTypeChecker();
		const reportedComponents = new WeakSet<TSESTree.Node>();

		function getPropertiesTypeFromCallableType(callableType: Type): Type | undefined {
			const callSignatures = callableType.getCallSignatures();
			if (callSignatures.length === 0) return undefined;

			const [firstSignature] = callSignatures;
			if (!firstSignature) return undefined;

			const parameters = firstSignature.getParameters();
			if (parameters.length === 0) return undefined;

			const [propertiesParameter] = parameters;
			return propertiesParameter ? checker.getTypeOfSymbol(propertiesParameter) : undefined;
		}

		function getPropertiesTypeFromFunctionNode(
			functionNode: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression,
		): Type | undefined {
			const tsNode = services.esTreeNodeToTSNodeMap.get(functionNode);
			if (!tsNode) return undefined;

			const functionType = checker.getTypeAtLocation(tsNode);
			if (!functionType) return undefined;

			return getPropertiesTypeFromCallableType(functionType);
		}

		function getPropertiesTypeFromReactFCAlias(annotationType: Type): Type | undefined {
			const { aliasSymbol, aliasTypeArguments } = annotationType;
			if (!aliasSymbol) return undefined;
			if (!REACT_FC_TYPE_NAMES.has(aliasSymbol.getName())) return undefined;
			if (!aliasTypeArguments || aliasTypeArguments.length === 0) return undefined;

			return aliasTypeArguments[0];
		}

		function getPropertiesTypeFromCallExpressionTypeArgs(callExpr: TSESTree.CallExpression): Type | undefined {
			if (!callExpr.typeArguments || callExpr.typeArguments.params.length === 0) return undefined;

			const { callee } = callExpr;
			let calleeName: string | undefined;

			if (callee.type === AST_NODE_TYPES.MemberExpression && callee.property.type === AST_NODE_TYPES.Identifier) {
				calleeName = callee.property.name;
			} else if (callee.type === AST_NODE_TYPES.Identifier) {
				calleeName = callee.name;
			}

			if (!calleeName) return undefined;

			let propertiesTypeIndex: number;
			if (REACT_FORWARD_REF_NAMES.has(calleeName)) {
				propertiesTypeIndex = 1;
			} else if (REACT_MEMO_NAMES.has(calleeName)) {
				propertiesTypeIndex = 0;
			} else {
				// Not a known React component factory (e.g., createContext, registerComponent)
				return undefined;
			}

			const typeArgument = callExpr.typeArguments.params[propertiesTypeIndex];
			if (!typeArgument) return undefined;

			const tsTypeArgument = services.esTreeNodeToTSNodeMap.get(typeArgument);
			if (!tsTypeArgument) return undefined;

			return checker.getTypeAtLocation(tsTypeArgument);
		}

		function getPropertiesTypeFromVariableAnnotation(node: TSESTree.VariableDeclarator): Type | undefined {
			if (node.id.type !== AST_NODE_TYPES.Identifier || !node.id.typeAnnotation) return undefined;

			const tsAnnotation = services.esTreeNodeToTSNodeMap.get(node.id.typeAnnotation.typeAnnotation);
			if (!tsAnnotation) return undefined;

			const annotationType = checker.getTypeAtLocation(tsAnnotation);
			if (!annotationType) return undefined;

			return (
				getPropertiesTypeFromReactFCAlias(annotationType) ?? getPropertiesTypeFromCallableType(annotationType)
			);
		}

		function reportIfNotReadonly(componentNode: TSESTree.Node, propertiesType?: Type): void {
			if (!propertiesType || reportedComponents.has(componentNode)) return;

			if (!isTypeFullyReadonly(checker, propertiesType)) {
				reportedComponents.add(componentNode);
				context.report({
					messageId: "preferReadOnlyProps",
					node: componentNode,
				});
			}
		}

		function isFunctionReactComponent(
			functionNode: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression,
		): boolean {
			const tsNode = services.esTreeNodeToTSNodeMap.get(functionNode);
			if (!tsNode) return false;

			const functionType = checker.getTypeAtLocation(tsNode);
			if (!functionType) return false;

			return isReactComponentFunction(checker, functionType);
		}

		return {
			FunctionDeclaration(node): void {
				if (!(node.id && isComponentName(node.id.name))) return;
				if (node.params.length === 0) return;
				if (!isFunctionReactComponent(node)) return;
				reportIfNotReadonly(node, getPropertiesTypeFromFunctionNode(node));
			},
			VariableDeclarator(node): void {
				if (node.id.type !== AST_NODE_TYPES.Identifier || !isComponentName(node.id.name)) return;

				const { init } = node;
				if (!init) return;

				const propertiesFromAnnotation = getPropertiesTypeFromVariableAnnotation(node);
				if (propertiesFromAnnotation) {
					reportIfNotReadonly(node, propertiesFromAnnotation);
					return;
				}

				if (isFunctionLike(init)) {
					if (init.params.length === 0) return;
					if (!isFunctionReactComponent(init)) return;
					reportIfNotReadonly(node, getPropertiesTypeFromFunctionNode(init));
				} else if (init.type === AST_NODE_TYPES.CallExpression) {
					const propertiesFromTypeArgs = getPropertiesTypeFromCallExpressionTypeArgs(init);
					if (propertiesFromTypeArgs) {
						reportIfNotReadonly(node, propertiesFromTypeArgs);
						return;
					}

					const [firstArgument] = init.arguments;
					if (firstArgument?.type === AST_NODE_TYPES.CallExpression) {
						const propertiesFromInnerCall = getPropertiesTypeFromCallExpressionTypeArgs(firstArgument);
						if (propertiesFromInnerCall) {
							reportIfNotReadonly(node, propertiesFromInnerCall);
							return;
						}
					}

					if (firstArgument && isFunctionLike(firstArgument)) {
						if (firstArgument.params.length === 0) return;
						reportIfNotReadonly(node, getPropertiesTypeFromFunctionNode(firstArgument));
					}
				}
			},
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description: "Enforce that function component props are read-only",
		},
		fixable: "code",
		messages: {
			preferReadOnlyProps: "A function component's props should be read-only.",
			readOnlyProp: "Prop '{{name}}' should be read-only.",
		},
		schema: [],
		type: "suggestion",
	},
	name: "prefer-read-only-props",
});

export default preferReadOnlyPropsRule;
