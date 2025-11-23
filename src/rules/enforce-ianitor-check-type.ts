import { TSESTree } from "@typescript-eslint/types";
import type { TSESLint } from "@typescript-eslint/utils";

export interface ComplexityConfiguration {
	readonly baseThreshold: number;
	readonly warnThreshold: number;
	readonly errorThreshold: number;
	readonly interfacePenalty: number;
	readonly performanceMode: boolean;
}

interface ComplexityCache {
	readonly nodeCache: WeakMap<object, number>;
	readonly visitedNodes: WeakSet<object>;
}

const DEFAULT_CONFIGURATION: ComplexityConfiguration = {
	baseThreshold: 10,
	errorThreshold: 25,
	interfacePenalty: 20,
	performanceMode: true,
	warnThreshold: 15,
};

const SHOULD_NOT_NOT_RETURN_TYPE = new Set<string>([
	TSESTree.AST_NODE_TYPES.FunctionDeclaration,
	TSESTree.AST_NODE_TYPES.FunctionExpression,
]);

type MessageIds = "complexInterfaceNeedsCheck" | "missingIanitorCheckType";
type Options = [Partial<ComplexityConfiguration>];

interface RuleDocs extends TSESLint.RuleMetaDataDocs {
	readonly recommended?: boolean;
}

function hasTypeAnnotation(node: { type: string; id?: unknown; returnType?: unknown }): boolean {
	if (
		node.type === TSESTree.AST_NODE_TYPES.VariableDeclarator &&
		node.id &&
		typeof node.id === "object" &&
		"typeAnnotation" in node.id
	)
		return !!node.id.typeAnnotation;

	if (SHOULD_NOT_NOT_RETURN_TYPE.has(node.type)) return !!node.returnType;
	return false;
}

function getTypeName(node: TSESTree.Node): string | undefined {
	return node.type === TSESTree.AST_NODE_TYPES.TSInterfaceDeclaration ||
		node.type === TSESTree.AST_NODE_TYPES.TSTypeAliasDeclaration
		? node.id.name
		: undefined;
}

function isIanitorValidator(node: {
	type: string;
	callee?: { type: string; object?: { type: string; name?: string } };
}): boolean {
	return (
		node.type === TSESTree.AST_NODE_TYPES.CallExpression &&
		node.callee?.type === TSESTree.AST_NODE_TYPES.MemberExpression &&
		node.callee.object?.type === TSESTree.AST_NODE_TYPES.Identifier &&
		node.callee.object.name === "Ianitor"
	);
}

function extractIanitorStaticVariable(typeAnnotation: TSESTree.TypeNode): string | undefined {
	let currentType = typeAnnotation;

	if (
		currentType.type === TSESTree.AST_NODE_TYPES.TSTypeReference &&
		currentType.typeName.type === TSESTree.AST_NODE_TYPES.Identifier &&
		currentType.typeName.name === "Readonly" &&
		currentType.typeArguments?.params[0]
	)
		currentType = currentType.typeArguments.params[0];

	if (currentType.type !== TSESTree.AST_NODE_TYPES.TSTypeReference) return undefined;

	const { typeName, typeArguments } = currentType;
	const firstParam = typeArguments?.params[0];

	if (
		typeName.type === TSESTree.AST_NODE_TYPES.TSQualifiedName &&
		typeName.left.type === TSESTree.AST_NODE_TYPES.Identifier &&
		typeName.left.name === "Ianitor" &&
		typeName.right.type === TSESTree.AST_NODE_TYPES.Identifier &&
		typeName.right.name === "Static" &&
		firstParam?.type === TSESTree.AST_NODE_TYPES.TSTypeQuery &&
		firstParam.exprName.type === TSESTree.AST_NODE_TYPES.Identifier
	)
		return firstParam.exprName.name;

	return undefined;
}

function hasIanitorStaticType(typeAnnotation: TSESTree.TypeNode): boolean {
	let currentType = typeAnnotation;

	if (
		currentType.type === TSESTree.AST_NODE_TYPES.TSTypeReference &&
		currentType.typeName.type === TSESTree.AST_NODE_TYPES.Identifier &&
		currentType.typeName.name === "Readonly" &&
		currentType.typeArguments?.params[0]
	)
		currentType = currentType.typeArguments.params[0];

	if (currentType.type !== TSESTree.AST_NODE_TYPES.TSTypeReference) return false;

	const { typeName, typeArguments } = currentType;

	return (
		typeName.type === TSESTree.AST_NODE_TYPES.TSQualifiedName &&
		typeName.left.type === TSESTree.AST_NODE_TYPES.Identifier &&
		typeName.left.name === "Ianitor" &&
		typeName.right.type === TSESTree.AST_NODE_TYPES.Identifier &&
		typeName.right.name === "Static" &&
		typeArguments?.params[0]?.type === TSESTree.AST_NODE_TYPES.TSTypeQuery
	);
}

function calculateIanitorComplexity(node: {
	readonly callee?: {
		readonly type: string;
		readonly property?: { type: string; name?: string };
	};
	readonly arguments?: ReadonlyArray<{ type?: string; properties?: Array<unknown> }>;
}): number {
	const callee = node.callee;
	if (
		callee?.type !== TSESTree.AST_NODE_TYPES.MemberExpression ||
		callee.property?.type !== TSESTree.AST_NODE_TYPES.Identifier
	)
		return 0;

	const method = callee.property.name;
	switch (method) {
		case "interface":
		case "strictInterface": {
			const properties = node.arguments?.[0];
			return properties?.type === TSESTree.AST_NODE_TYPES.ObjectExpression
				? 10 + (properties.properties?.length || 0) * 3
				: 0;
		}

		case "optional":
		case "array":
		case "instanceIsA":
		case "instanceOf":
			return 2;

		case "record":
		case "map":
			return 3;

		case "union":
		case "intersection":
			return (node.arguments?.length || 0) * 2;

		case "string":
		case "number":
		case "boolean":
			return 1;

		default:
			return 1;
	}
}

const enforceIanitorCheckType: TSESLint.RuleModuleWithMetaDocs<MessageIds, Options, RuleDocs> = {
	create(context) {
		const [rawOptions] = context.options;
		const config: ComplexityConfiguration = { ...DEFAULT_CONFIGURATION, ...rawOptions };
		const cache: ComplexityCache = {
			nodeCache: new WeakMap(),
			visitedNodes: new WeakSet(),
		};
		const ianitorStaticVariables = new Set<string>();
		const depthMultiplierCache = new Map<number, number>();
		const complexityCeiling = config.errorThreshold * 2;

		function getDepthMultiplier(depth: number): number {
			const cached = depthMultiplierCache.get(depth);
			if (cached !== undefined) return cached;
			const computed = Math.log2(depth + 1);
			depthMultiplierCache.set(depth, computed);
			return computed;
		}

		function addScore(current: number, addition: number): number {
			const nextScore = current + addition;
			if (!config.performanceMode) return nextScore;
			return nextScore > complexityCeiling ? complexityCeiling : nextScore;
		}

		function calculateStructuralComplexity(node: TSESTree.Node, depth = 0): number {
			const cached = cache.nodeCache.get(node);
			if (cached !== undefined) return cached;

			if (cache.visitedNodes.has(node)) return 50;

			cache.visitedNodes.add(node);

			let score = 0;
			const nextDepth = depth + 1;

			switch (node.type) {
				case TSESTree.AST_NODE_TYPES.TSStringKeyword:
				case TSESTree.AST_NODE_TYPES.TSNumberKeyword:
				case TSESTree.AST_NODE_TYPES.TSBooleanKeyword:
				case TSESTree.AST_NODE_TYPES.TSNullKeyword:
				case TSESTree.AST_NODE_TYPES.TSUndefinedKeyword:
				case TSESTree.AST_NODE_TYPES.TSVoidKeyword:
				case TSESTree.AST_NODE_TYPES.TSSymbolKeyword:
				case TSESTree.AST_NODE_TYPES.TSBigIntKeyword:
					score = 1;
					break;

				case TSESTree.AST_NODE_TYPES.TSNeverKeyword:
				case TSESTree.AST_NODE_TYPES.TSUnknownKeyword:
				case TSESTree.AST_NODE_TYPES.TSAnyKeyword:
					score = 0;
					break;

				case TSESTree.AST_NODE_TYPES.TSInterfaceDeclaration: {
					const iface = node;
					score = config.interfacePenalty;
					const extendsLength = iface.extends?.length;
					if (extendsLength) score = addScore(score, extendsLength * 5);

					const { body } = iface.body;
					score = addScore(score, body.length * 2);
					for (const member of body) {
						const typeAnnotation = "typeAnnotation" in member ? member.typeAnnotation : undefined;
						if (typeAnnotation)
							score = addScore(
								score,
								calculateStructuralComplexity(typeAnnotation.typeAnnotation, nextDepth),
							);
					}
					break;
				}

				case TSESTree.AST_NODE_TYPES.TSTypeLiteral: {
					const { members } = node;
					score = 2 + members.length * 0.5;
					for (const member of members) {
						const typeAnnotation = "typeAnnotation" in member ? member.typeAnnotation : undefined;
						if (typeAnnotation)
							score = addScore(
								score,
								calculateStructuralComplexity(typeAnnotation.typeAnnotation, nextDepth),
							);
					}
					break;
				}

				case TSESTree.AST_NODE_TYPES.TSUnionType: {
					const { types } = node;
					for (const type of types) score = addScore(score, calculateStructuralComplexity(type, nextDepth));
					score = addScore(score, 2 * (types.length - 1));
					break;
				}

				case TSESTree.AST_NODE_TYPES.TSIntersectionType: {
					const { types } = node;
					for (const type of types) score = addScore(score, calculateStructuralComplexity(type, nextDepth));
					score = addScore(score, 3 * types.length);
					break;
				}

				case TSESTree.AST_NODE_TYPES.TSArrayType:
					score = addScore(calculateStructuralComplexity(node.elementType, nextDepth), 1);
					break;

				case TSESTree.AST_NODE_TYPES.TSTupleType: {
					const { elementTypes } = node;
					score = 1;
					for (const element of elementTypes) {
						const elementType = element.type;
						if (elementType !== "TSRestType" && elementType !== "TSOptionalType")
							score = addScore(score, calculateStructuralComplexity(element, nextDepth));
					}
					score = addScore(score, 1.5 * elementTypes.length);
					break;
				}

				case TSESTree.AST_NODE_TYPES.TSTypeReference: {
					score = 2;
					const { typeArguments } = node;
					if (typeArguments) {
						for (const param of typeArguments.params)
							score = addScore(score, calculateStructuralComplexity(param, nextDepth) + 2);
					}
					break;
				}

				case TSESTree.AST_NODE_TYPES.TSConditionalType: {
					score = 3;
					score = addScore(score, calculateStructuralComplexity(node.checkType, nextDepth));
					score = addScore(score, calculateStructuralComplexity(node.extendsType, nextDepth));
					score = addScore(score, calculateStructuralComplexity(node.trueType, nextDepth));
					score = addScore(score, calculateStructuralComplexity(node.falseType, nextDepth));
					break;
				}

				case TSESTree.AST_NODE_TYPES.TSMappedType: {
					score = 5;
					if (node.constraint)
						score = addScore(score, calculateStructuralComplexity(node.constraint, nextDepth));
					if (node.typeAnnotation)
						score = addScore(score, calculateStructuralComplexity(node.typeAnnotation, nextDepth));
					break;
				}

				case TSESTree.AST_NODE_TYPES.TSFunctionType:
				case TSESTree.AST_NODE_TYPES.TSMethodSignature: {
					score = 2;
					for (const param of node.params) {
						const typeAnnotation = "typeAnnotation" in param ? param.typeAnnotation : undefined;
						if (typeAnnotation)
							score = addScore(
								score,
								calculateStructuralComplexity(typeAnnotation.typeAnnotation, nextDepth),
							);
					}
					if (node.returnType)
						score = addScore(
							score,
							calculateStructuralComplexity(node.returnType.typeAnnotation, nextDepth),
						);
					break;
				}

				default:
					score = 1;
			}

			score *= getDepthMultiplier(depth);

			cache.nodeCache.set(node, score);
			cache.visitedNodes.delete(node);
			return score;
		}

			const variableDeclaratorsToCheck = new Map<TSESTree.VariableDeclarator, { complexity: number }>();

			return {
				"Program:exit"() {
					for (const [node, data] of variableDeclaratorsToCheck.entries()) {
						if (node.id.type === TSESTree.AST_NODE_TYPES.Identifier && ianitorStaticVariables.has(node.id.name))
							continue;

						context.report({
							data: { score: data.complexity.toFixed(1) },
						messageId: "missingIanitorCheckType",
						node: node.id,
					});
				}
			},

				TSInterfaceDeclaration(node: TSESTree.TSInterfaceDeclaration) {
					const complexity = calculateStructuralComplexity(node);
					const name = getTypeName(node);

				if (complexity >= config.interfacePenalty) {
					context.report({
						data: { name: name || "unknown" },
						messageId: "complexInterfaceNeedsCheck",
						node,
					});
				}
			},

			TSTypeAliasDeclaration(node: TSESTree.TSTypeAliasDeclaration) {
				const variableName = extractIanitorStaticVariable(node.typeAnnotation);
				if (variableName) ianitorStaticVariables.add(variableName);
				if (hasIanitorStaticType(node.typeAnnotation)) return;

				const complexity = calculateStructuralComplexity(node.typeAnnotation);
				if (complexity < config.baseThreshold) return;

				context.report({
					data: { score: complexity.toFixed(1) },
					messageId: "missingIanitorCheckType",
					node,
				});
			},

				VariableDeclarator(node: TSESTree.VariableDeclarator) {
					if (!node.init || node.init.type !== TSESTree.AST_NODE_TYPES.CallExpression) return;
					if (!isIanitorValidator(node.init)) return;
					if (hasTypeAnnotation(node)) return;

				const complexity = calculateIanitorComplexity(node.init);
				if (complexity < config.baseThreshold) return;

				variableDeclaratorsToCheck.set(node, { complexity });
			},
		};
	},
	defaultOptions: [{}],
	meta: {
		docs: {
			description: "Enforce Ianitor.Check<T> type annotations on complex TypeScript types",
			recommended: false,
		},
		messages: {
			complexInterfaceNeedsCheck:
				"Interface '{{name}}' requires Ianitor.Check<T> annotation (interfaces always need explicit checking)",
			missingIanitorCheckType:
				"Complex type (score: {{score}}) requires Ianitor.Check<T> annotation for type safety",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					baseThreshold: { minimum: 1, type: "number" },
					errorThreshold: { minimum: 1, type: "number" },
					interfacePenalty: { minimum: 1, type: "number" },
					performanceMode: { type: "boolean" },
					warnThreshold: { minimum: 1, type: "number" },
				},
				type: "object",
			},
		],
		type: "problem",
	},
};

export default enforceIanitorCheckType;
