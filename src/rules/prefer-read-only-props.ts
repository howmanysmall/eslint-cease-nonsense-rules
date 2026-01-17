import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { regex } from "arkregex";
import { createRule } from "../utilities/create-rule";

type MessageIds = "preferReadOnlyProps" | "readOnlyProp";
type Options = [];

type TypeDeclaration = TSESTree.TSTypeAliasDeclaration | TSESTree.TSInterfaceDeclaration;
type TypeName = TSESTree.Identifier | TSESTree.TSQualifiedName | TSESTree.ThisExpression;

interface ValueDeclarationInfo {
	declarator: TSESTree.VariableDeclarator;
	kind: TSESTree.VariableDeclaration["kind"];
}

const COMPONENT_NAME_PATTERN = regex("^[A-Z]", "u");
const READONLY_WRAPPER_NAMES = new Set(["Readonly", "ReadonlyArray", "ReadonlyDeep", "DeepReadonly", "DeepReadOnly"]);
const REACT_COMPONENT_TYPE_NAMES = new Set(["FC", "FunctionComponent", "VFC", "VoidFunctionComponent"]);

function hasTypeInformation(services: unknown): boolean {
	if (!services || typeof services !== "object") return false;

	const getTypeAtLocation: unknown = Reflect.get(services, "getTypeAtLocation");
	if (typeof getTypeAtLocation !== "function") return false;

	const program: unknown = Reflect.get(services, "program");
	if (!program || typeof program !== "object") return false;

	const getTypeChecker: unknown = Reflect.get(program, "getTypeChecker");
	return typeof getTypeChecker === "function";
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
	return COMPONENT_NAME_PATTERN.test(name);
}

function isIdentifier(node: TSESTree.Node | undefined): node is TSESTree.Identifier {
	return Boolean(node && node.type === AST_NODE_TYPES.Identifier);
}

function isMemberExpression(node: TSESTree.Node | undefined): node is TSESTree.MemberExpression {
	return Boolean(node && node.type === AST_NODE_TYPES.MemberExpression);
}

function getQualifiedName(name: TSESTree.TSQualifiedName): string {
	const { left } = name;
	if (left.type === AST_NODE_TYPES.Identifier) return `${left.name}.${name.right.name}`;
	if (left.type === AST_NODE_TYPES.ThisExpression) return `this.${name.right.name}`;
	return `${getQualifiedName(left)}.${name.right.name}`;
}

function getTypeName(name: TypeName): string | undefined {
	if (name.type === AST_NODE_TYPES.Identifier) return name.name;
	if (name.type === AST_NODE_TYPES.ThisExpression) return undefined;
	return getQualifiedName(name);
}

function getTypeNameParts(name: TypeName): ReadonlyArray<string> {
	if (name.type === AST_NODE_TYPES.Identifier) return [name.name];
	if (name.type === AST_NODE_TYPES.ThisExpression) return ["this"];
	return [...getTypeNameParts(name.left), name.right.name];
}

function getMemberExpressionName(node: TSESTree.MemberExpression): string | undefined {
	if (node.computed || node.property.type !== AST_NODE_TYPES.Identifier) return undefined;

	const { object } = node;
	if (object.type === AST_NODE_TYPES.Identifier) return `${object.name}.${node.property.name}`;
	if (object.type === AST_NODE_TYPES.MemberExpression) {
		const objectName = getMemberExpressionName(object);
		return objectName ? `${objectName}.${node.property.name}` : undefined;
	}

	return undefined;
}

function getTypeNameFromExpression(node: TSESTree.Expression): string | undefined {
	if (node.type === AST_NODE_TYPES.Identifier) return node.name;
	if (node.type === AST_NODE_TYPES.MemberExpression) return getMemberExpressionName(node);
	return undefined;
}

function getTypeAnnotationFromParameter(parameter: TSESTree.Node | undefined): TSESTree.TypeNode | undefined {
	if (!parameter) return undefined;
	if (parameter.type === AST_NODE_TYPES.Identifier) return parameter.typeAnnotation?.typeAnnotation;
	if (parameter.type === AST_NODE_TYPES.ObjectPattern || parameter.type === AST_NODE_TYPES.ArrayPattern) {
		return parameter.typeAnnotation?.typeAnnotation;
	}

	if (parameter.type === AST_NODE_TYPES.AssignmentPattern) return getTypeAnnotationFromParameter(parameter.left);
	if (parameter.type === AST_NODE_TYPES.RestElement) return getTypeAnnotationFromParameter(parameter.argument);
	if (parameter.type === AST_NODE_TYPES.TSParameterProperty) {
		return getTypeAnnotationFromParameter(parameter.parameter);
	}

	if (parameter.type === AST_NODE_TYPES.MemberExpression) return undefined;

	return undefined;
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

function getPropertiesTypeFromFunction(
	node: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression,
): TSESTree.TypeNode | undefined {
	const [firstParameter] = node.params;
	return firstParameter ? getTypeAnnotationFromParameter(firstParameter) : undefined;
}

function isReactComponentTypeReference(node: TSESTree.TSTypeReference): boolean {
	const nameParts = getTypeNameParts(node.typeName);
	const baseName = nameParts.at(-1);
	if (!baseName) return false;

	if (REACT_COMPONENT_TYPE_NAMES.has(baseName)) return true;

	return nameParts.length === 2 && nameParts[0] === "React" && REACT_COMPONENT_TYPE_NAMES.has(baseName);
}

function getPropsTypeFromReactComponentAnnotation(
	annotation: TSESTree.TSTypeAnnotation | undefined,
): TSESTree.TypeNode | undefined {
	if (!annotation || annotation.typeAnnotation.type !== AST_NODE_TYPES.TSTypeReference) return undefined;

	const typeReference = annotation.typeAnnotation;
	if (!isReactComponentTypeReference(typeReference)) return undefined;

	const typeArguments = typeReference.typeArguments?.params ?? [];
	return typeArguments[0];
}

function isReactMemberExpression(node: TSESTree.MemberExpression, name: string): boolean {
	return (
		!node.computed &&
		isIdentifier(node.object) &&
		node.object.name === "React" &&
		isIdentifier(node.property) &&
		node.property.name === name
	);
}

function isCalleeNamed(node: TSESTree.Node, name: string): boolean {
	return isIdentifier(node) ? node.name === name : isMemberExpression(node) && isReactMemberExpression(node, name);
}

function isMemoCall(node: TSESTree.CallExpression): boolean {
	return isCalleeNamed(node.callee, "memo");
}

function isForwardRefCall(node: TSESTree.CallExpression): boolean {
	return isCalleeNamed(node.callee, "forwardRef");
}

function getTypeArguments(node: {
	typeArguments?: TSESTree.TSTypeParameterInstantiation | undefined;
}): ReadonlyArray<TSESTree.TypeNode> {
	return node.typeArguments?.params ?? [];
}

function getPropsTypeFromCallExpression(node: TSESTree.CallExpression): TSESTree.TypeNode | undefined {
	if (isMemoCall(node)) {
		const typeArguments = getTypeArguments(node);
		if (typeArguments.length > 0) return typeArguments[0];

		const [firstArgument] = node.arguments;
		if (firstArgument?.type === AST_NODE_TYPES.CallExpression) {
			const nestedProperties = getPropsTypeFromCallExpression(firstArgument);
			if (nestedProperties) return nestedProperties;
		}
		if (firstArgument && isFunctionLike(firstArgument)) return getPropertiesTypeFromFunction(firstArgument);
	}

	if (isForwardRefCall(node)) {
		const typeArguments = getTypeArguments(node);
		if (typeArguments.length > 1) return typeArguments[1];

		const [firstArgument] = node.arguments;
		if (firstArgument && isFunctionLike(firstArgument)) return getPropertiesTypeFromFunction(firstArgument);
	}

	return undefined;
}

function collectDeclarations(
	nodes: ReadonlyArray<TSESTree.Node>,
	typeDeclarations: Map<string, TypeDeclaration>,
	valueDeclarations: Map<string, ValueDeclarationInfo>,
	namespacePrefix: string,
): void {
	for (const node of nodes) {
		if (node.type === AST_NODE_TYPES.ExportNamedDeclaration && node.declaration) {
			collectDeclarations([node.declaration], typeDeclarations, valueDeclarations, namespacePrefix);
			continue;
		}

		if (node.type === AST_NODE_TYPES.TSModuleDeclaration && node.id.type === AST_NODE_TYPES.Identifier) {
			const nextPrefix = namespacePrefix ? `${namespacePrefix}.${node.id.name}` : node.id.name;
			const { body } = node;
			if (body) {
				if (body.type === AST_NODE_TYPES.TSModuleBlock) {
					collectDeclarations(body.body, typeDeclarations, valueDeclarations, nextPrefix);
				} else if (body.type === AST_NODE_TYPES.TSModuleDeclaration) {
					collectDeclarations([body], typeDeclarations, valueDeclarations, nextPrefix);
				}
			}
			continue;
		}

		if (node.type === AST_NODE_TYPES.TSTypeAliasDeclaration) {
			const name = namespacePrefix ? `${namespacePrefix}.${node.id.name}` : node.id.name;
			typeDeclarations.set(name, node);
			continue;
		}

		if (node.type === AST_NODE_TYPES.TSInterfaceDeclaration) {
			const name = namespacePrefix ? `${namespacePrefix}.${node.id.name}` : node.id.name;
			typeDeclarations.set(name, node);
			continue;
		}

		if (node.type === AST_NODE_TYPES.VariableDeclaration) {
			for (const declarator of node.declarations) {
				if (declarator.id.type === AST_NODE_TYPES.Identifier) {
					valueDeclarations.set(declarator.id.name, {
						declarator,
						kind: node.kind,
					});
				}
			}
		}
	}
}

export function createPreferReadOnlyPropsRule(ruleName: string): TSESLint.RuleModule<MessageIds> {
	return createRule<Options, MessageIds>({
		create(context) {
			function getPropertyName(member: TSESTree.TSPropertySignature): string {
				if (member.key.type === AST_NODE_TYPES.Identifier) return member.key.name;
				return "unknown";
			}

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

			function reportPropsFromFunction(
				node: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression,
			): void {
				for (const parameter of node.params) {
					const typeLiteral = getTypeLiteralFromParameter(parameter);
					if (typeLiteral) reportTypeLiteral(typeLiteral);
				}
			}

			if (!hasTypeInformation(context.sourceCode.parserServices)) {
				return {
					FunctionDeclaration(node): void {
						if (!(node.id && isComponentName(node.id.name))) return;
						reportPropsFromFunction(node);
					},
					VariableDeclarator(node): void {
						if (node.id.type !== AST_NODE_TYPES.Identifier || !isComponentName(node.id.name)) return;
						if (node.init && isFunctionLike(node.init)) reportPropsFromFunction(node.init);
					},
				};
			}

			const reportedComponents = new WeakSet<TSESTree.Node>();
			const typeDeclarations = new Map<string, TypeDeclaration>();
			const valueDeclarations = new Map<string, ValueDeclarationInfo>();
			collectDeclarations(context.sourceCode.ast.body, typeDeclarations, valueDeclarations, "");

			const readonlyTypeCache = new Map<string, boolean>();
			const readonlyNodeCache = new WeakMap<TSESTree.Node, boolean>();

			function isConstAssertion(node: TSESTree.Expression | undefined): boolean {
				if (!node || node.type !== AST_NODE_TYPES.TSAsExpression) return false;

				const { typeAnnotation } = node;
				return (
					typeAnnotation.type === AST_NODE_TYPES.TSTypeReference &&
					typeAnnotation.typeName.type === AST_NODE_TYPES.Identifier &&
					typeAnnotation.typeName.name === "const"
				);
			}

			function isTypeReadonlyByName(name: string, visited: Set<string>): boolean {
				if (readonlyTypeCache.has(name)) return readonlyTypeCache.get(name) === true;
				if (visited.has(name)) return true;
				visited.add(name);

				const declaration = typeDeclarations.get(name);
				if (!declaration) {
					readonlyTypeCache.set(name, false);
					return false;
				}

				let result = false;
				if (declaration.type === AST_NODE_TYPES.TSTypeAliasDeclaration) {
					result = isTypeReadonly(declaration.typeAnnotation, visited);
				} else {
					const extendsList = declaration.extends ?? [];
					const hasNonReadonlyExtends = extendsList.some((extend) => {
						const extendName = getTypeNameFromExpression(extend.expression);
						if (!extendName) return true;
						return !isTypeReadonlyByName(extendName, new Set(visited));
					});

					const membersReadonly = declaration.body.body.every((member) =>
						member.type === AST_NODE_TYPES.TSPropertySignature ||
						member.type === AST_NODE_TYPES.TSIndexSignature
							? member.readonly
							: true,
					);

					result = !hasNonReadonlyExtends && membersReadonly;
				}

				readonlyTypeCache.set(name, result);
				return result;
			}

			function isTypeReadonly(typeNode: TSESTree.TypeNode, visited = new Set<string>()): boolean {
				const cached = readonlyNodeCache.get(typeNode);
				if (cached !== undefined) return cached;

				let result = false;

				switch (typeNode.type) {
					case AST_NODE_TYPES.TSTypeLiteral: {
						result = typeNode.members.every((member) =>
							member.type === AST_NODE_TYPES.TSPropertySignature ||
							member.type === AST_NODE_TYPES.TSIndexSignature
								? member.readonly
								: true,
						);
						break;
					}
					case AST_NODE_TYPES.TSTypeReference: {
						const nameParts = getTypeNameParts(typeNode.typeName);
						const baseName = nameParts.at(-1);
						const name = getTypeName(typeNode.typeName);
						if (baseName && READONLY_WRAPPER_NAMES.has(baseName)) {
							result = true;
							break;
						}

						if (!name) {
							result = false;
							break;
						}

						result = isTypeReadonlyByName(name, visited);
						break;
					}
					case AST_NODE_TYPES.TSUnionType:
						result = typeNode.types.every((type) => isTypeReadonly(type, new Set(visited)));
						break;
					case AST_NODE_TYPES.TSIntersectionType:
						result = typeNode.types.every((type) => isTypeReadonly(type, new Set(visited)));
						break;
					case AST_NODE_TYPES.TSTypeQuery: {
						const { exprName } = typeNode;
						if (!isIdentifier(exprName)) {
							result = false;
							break;
						}
						const valueInfo = valueDeclarations.get(exprName.name);
						result = Boolean(
							valueInfo &&
							(valueInfo.kind === "const" || valueInfo.kind === "let" || valueInfo.kind === "var") &&
							isConstAssertion(valueInfo.declarator.init ?? undefined),
						);
						break;
					}
					case AST_NODE_TYPES.TSTypeOperator:
						result = typeNode.operator === "readonly";
						break;
					default:
						result = false;
						break;
				}

				readonlyNodeCache.set(typeNode, result);
				return result;
			}

			function reportIfNeeded(node: TSESTree.Node, propsType: TSESTree.TypeNode | undefined): void {
				if (!propsType || reportedComponents.has(node) || isTypeReadonly(propsType)) return;

				reportedComponents.add(node);
				context.report({
					messageId: "preferReadOnlyProps",
					node,
				});
			}

			return {
				FunctionDeclaration(node): void {
					if (!(node.id && isComponentName(node.id.name))) return;

					const propsType = getPropertiesTypeFromFunction(node);
					reportIfNeeded(node, propsType);
				},
				VariableDeclarator(node): void {
					if (node.id.type !== AST_NODE_TYPES.Identifier || !isComponentName(node.id.name)) return;

					const propsFromAnnotation = getPropsTypeFromReactComponentAnnotation(node.id.typeAnnotation);
					const propsFromInitializer = node.init
						? node.init.type === AST_NODE_TYPES.CallExpression
							? getPropsTypeFromCallExpression(node.init)
							: isFunctionLike(node.init)
								? getPropertiesTypeFromFunction(node.init)
								: undefined
						: undefined;

					reportIfNeeded(node, propsFromAnnotation ?? propsFromInitializer);
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
		name: ruleName,
	});
}

export default createPreferReadOnlyPropsRule("prefer-read-only-props");
