import { createRule } from "$utilities/create-rule";
import {
	isFunctionLikeNode,
	isLikelyReactComponentName,
	isReactComponentFunction,
} from "$utilities/react-component-utilities";
import { AST_NODE_TYPES, ESLintUtils } from "@typescript-eslint/utils";
import { isPropertyReadonlyInType } from "ts-api-utils";

import type { TSESTree } from "@typescript-eslint/utils";
import type { IndexInfo, Symbol as TSSymbol, Type, TypeChecker } from "typescript";

type MessageIds = "preferReadOnlyProperties" | "readOnlyProperty";
type Options = [];
type FunctionComponentNode =
	| TSESTree.ArrowFunctionExpression
	| TSESTree.FunctionDeclaration
	| TSESTree.FunctionExpression;
type TypeLiteralParameter = TSESTree.Parameter | TSESTree.DestructuringPattern;

const READONLY_WRAPPER_NAMES = new Set(["Readonly", "ReadonlyArray", "ReadonlyDeep", "DeepReadonly", "DeepReadOnly"]);
const REACT_BUILTIN_PROPS = new Set(["children", "key", "ref"]);
const REACT_FC_TYPE_NAMES = new Set(["FC", "FunctionComponent", "VFC", "VoidFunctionComponent"]);
const REACT_FORWARD_REF_NAMES = new Set(["forwardRef"]);
const REACT_MEMO_NAMES = new Set(["memo"]);

function getBaseTypes(type: Type): ReadonlyArray<Type> {
	return type.getBaseTypes() ?? [];
}

function isTypePropertyReadonly(checker: TypeChecker, type: Type, property: TSSymbol): boolean {
	return isPropertyReadonlyInType(type, property.getEscapedName(), checker);
}

function isPropertyReadonlyInBaseType(checker: TypeChecker, type: Type, property: TSSymbol): boolean {
	const propertyName = property.getName();
	const baseTypes = [...getBaseTypes(type)];

	for (const baseType of baseTypes) {
		const baseProperty = baseType.getProperty(propertyName);
		if (baseProperty === undefined) continue;
		if (isTypePropertyReadonly(checker, baseType, baseProperty)) return true;
		baseTypes.push(...getBaseTypes(baseType));
	}

	return false;
}

function isReadonlyPropertiesProperty(checker: TypeChecker, type: Type, property: TSSymbol): boolean {
	const propertyName = property.getName();
	if (REACT_BUILTIN_PROPS.has(propertyName)) return true;
	if (isTypePropertyReadonly(checker, type, property)) return true;
	return isPropertyReadonlyInBaseType(checker, type, property);
}

function isTypeFullyReadonly(checker: TypeChecker, type: Type): boolean {
	const aliasSymbol = type.aliasSymbol ?? type.getSymbol();
	if (aliasSymbol) {
		const name = aliasSymbol.getName();
		if (READONLY_WRAPPER_NAMES.has(name)) return true;
	}

	if (type.isUnion()) {
		return type.types.every((unionType) => isTypeFullyReadonly(checker, unionType));
	}

	if (type.isIntersection()) {
		return type.types.every((intersectionType) => isTypeFullyReadonly(checker, intersectionType));
	}

	const indexInfos: ReadonlyArray<IndexInfo> = checker.getIndexInfosOfType(type);
	for (const indexInfo of indexInfos) if (!indexInfo.isReadonly) return false;

	const properties = checker.getPropertiesOfType(type);
	if (properties.length === 0) return true;

	for (const property of properties) {
		if (!isReadonlyPropertiesProperty(checker, type, property)) return false;
	}

	return true;
}

function getTypeLiteralFromParameter(parameter: TypeLiteralParameter): TSESTree.TSTypeLiteral | undefined {
	if (parameter.type === AST_NODE_TYPES.Identifier) {
		const annotation = parameter.typeAnnotation?.typeAnnotation;
		return annotation?.type === AST_NODE_TYPES.TSTypeLiteral ? annotation : undefined;
	}

	if (parameter.type === AST_NODE_TYPES.AssignmentPattern) return getTypeLiteralFromParameter(parameter.left);
	if (parameter.type === AST_NODE_TYPES.RestElement) return getTypeLiteralFromParameter(parameter.argument);

	return undefined;
}

function getPropertyName(member: TSESTree.TSPropertySignature): string {
	if (member.key.type === AST_NODE_TYPES.Identifier) return member.key.name;
	return "unknown";
}

const preferReadOnlyProperties = createRule<Options, MessageIds>({
	create(context) {
		function reportTypeLiteral(typeLiteral: TSESTree.TSTypeLiteral): void {
			for (const member of typeLiteral.members) {
				if (member.type !== AST_NODE_TYPES.TSPropertySignature || member.readonly || member.computed) continue;

				const { key } = member;

				context.report({
					data: {
						name: getPropertyName(member),
					},
					fix(fixer) {
						return fixer.insertTextBefore(key, "readonly ");
					},
					messageId: "readOnlyProperty",
					node: member,
				});
			}
		}

		function reportPropertiesFromFunction(node: FunctionComponentNode): void {
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
					if (node.id === null || !isLikelyReactComponentName(node.id.name)) return;
					reportPropertiesFromFunction(node);
				},
				VariableDeclarator(node): void {
					if (node.id.type !== AST_NODE_TYPES.Identifier || !isLikelyReactComponentName(node.id.name)) return;
					if (node.init !== null && isFunctionLikeNode(node.init)) reportPropertiesFromFunction(node.init);
				},
			};
		}

		const checker = program.getTypeChecker();
		const reportedComponents = new WeakSet<TSESTree.Node>();

		function getPropertiesTypeFromCallableType(callableType: Type): Type | undefined {
			const callSignatures = callableType.getCallSignatures();

			for (const firstSignature of callSignatures) {
				const parameters = firstSignature.getParameters();
				if (parameters.length === 0) return undefined;

				for (const propertiesParameter of parameters) return checker.getTypeOfSymbol(propertiesParameter);
			}

			return undefined;
		}

		function getPropertiesTypeFromFunctionNode(functionNode: FunctionComponentNode): Type | undefined {
			const tsNode = services.esTreeNodeToTSNodeMap.get(functionNode);
			const functionType = checker.getTypeAtLocation(tsNode);

			return getPropertiesTypeFromCallableType(functionType);
		}

		function getPropertiesTypeFromReactFCAlias(annotationType: Type): Type | undefined {
			const { aliasSymbol, aliasTypeArguments } = annotationType;
			if (aliasSymbol === undefined) return undefined;
			if (!REACT_FC_TYPE_NAMES.has(aliasSymbol.getName())) return undefined;

			return aliasTypeArguments?.at(0);
		}

		function getPropertiesTypeFromCallExpression(callExpr: TSESTree.CallExpression): Type | undefined {
			if (callExpr.typeArguments === undefined || callExpr.typeArguments.params.length === 0) return undefined;

			const { callee } = callExpr;
			let calleeName: string | undefined;

			if (callee.type === AST_NODE_TYPES.MemberExpression && callee.property.type === AST_NODE_TYPES.Identifier) {
				calleeName = callee.property.name;
			} else if (callee.type === AST_NODE_TYPES.Identifier) calleeName = callee.name;

			if (calleeName === undefined) return undefined;

			let propertiesTypeIndex: number;
			if (REACT_FORWARD_REF_NAMES.has(calleeName)) propertiesTypeIndex = 1;
			else if (REACT_MEMO_NAMES.has(calleeName)) propertiesTypeIndex = 0;
			else return undefined;

			const typeArgument = callExpr.typeArguments.params[propertiesTypeIndex];
			if (typeArgument === undefined) return undefined;

			const tsTypeArgument = services.esTreeNodeToTSNodeMap.get(typeArgument);

			return checker.getTypeAtLocation(tsTypeArgument);
		}

		function getPropertiesTypeFromVariableAnnotation(node: TSESTree.VariableDeclarator): Type | undefined {
			if (node.id.type !== AST_NODE_TYPES.Identifier || node.id.typeAnnotation === undefined) return undefined;

			const tsAnnotation = services.esTreeNodeToTSNodeMap.get(node.id.typeAnnotation.typeAnnotation);
			const annotationType = checker.getTypeAtLocation(tsAnnotation);

			return (
				getPropertiesTypeFromReactFCAlias(annotationType) ?? getPropertiesTypeFromCallableType(annotationType)
			);
		}

		function reportIfNotReadonly(componentNode: TSESTree.Node, propertiesType?: Type): void {
			if (propertiesType === undefined || reportedComponents.has(componentNode)) return;

			if (!isTypeFullyReadonly(checker, propertiesType)) {
				reportedComponents.add(componentNode);
				context.report({
					messageId: "preferReadOnlyProperties",
					node: componentNode,
				});
			}
		}

		function isFunctionReactComponent(functionNode: FunctionComponentNode): boolean {
			const tsNode = services.esTreeNodeToTSNodeMap.get(functionNode);
			const functionType = checker.getTypeAtLocation(tsNode);

			return isReactComponentFunction(checker, functionType);
		}

		function reportFunctionNode(componentNode: TSESTree.Node, functionNode: FunctionComponentNode): void {
			if (functionNode.params.length === 0) return;
			if (!isFunctionReactComponent(functionNode)) return;
			reportIfNotReadonly(componentNode, getPropertiesTypeFromFunctionNode(functionNode));
		}

		function getPropertiesTypeFromFirstCallArgument(callExpr: TSESTree.CallExpression): Type | undefined {
			const [firstArgument] = callExpr.arguments;

			if (firstArgument === undefined) return undefined;

			if (firstArgument.type === AST_NODE_TYPES.CallExpression) {
				return getPropertiesTypeFromCallExpression(firstArgument);
			}

			if (isFunctionLikeNode(firstArgument) && firstArgument.params.length > 0) {
				return getPropertiesTypeFromFunctionNode(firstArgument);
			}

			return undefined;
		}

		function getPropertiesTypeFromVariableInitializer(init: TSESTree.Expression): Type | undefined {
			if (init.type !== AST_NODE_TYPES.CallExpression) return undefined;

			return getPropertiesTypeFromCallExpression(init) ?? getPropertiesTypeFromFirstCallArgument(init);
		}

		function reportVariableDeclarator(node: TSESTree.VariableDeclarator): void {
			if (node.id.type !== AST_NODE_TYPES.Identifier || !isLikelyReactComponentName(node.id.name)) return;

			const { init } = node;
			if (init === null) return;

			const propertiesFromAnnotation = getPropertiesTypeFromVariableAnnotation(node);
			if (propertiesFromAnnotation !== undefined) {
				reportIfNotReadonly(node, propertiesFromAnnotation);
				return;
			}

			if (isFunctionLikeNode(init)) {
				reportFunctionNode(node, init);
				return;
			}

			reportIfNotReadonly(node, getPropertiesTypeFromVariableInitializer(init));
		}

		return {
			FunctionDeclaration(node): void {
				if (node.id === null || !isLikelyReactComponentName(node.id.name)) return;
				reportFunctionNode(node, node);
			},
			VariableDeclarator: reportVariableDeclarator,
		};
	},
	meta: {
		defaultOptions: [],
		docs: {
			description: "Enforce that function component props are read-only",
		},
		fixable: "code",
		messages: {
			preferReadOnlyProperties: "A function component's props should be read-only.",
			readOnlyProperty: "Prop '{{name}}' should be read-only.",
		},
		schema: [],
		type: "suggestion",
	},
	name: "prefer-read-only-properties",
});

export default preferReadOnlyProperties;
