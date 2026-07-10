import { createRule } from "$utilities/create-rule";
import { TSESTree } from "@typescript-eslint/types";

export interface ComplexityConfiguration {
	readonly baseThreshold: number;
	readonly errorThreshold: number;
	readonly interfacePenalty: number;
	readonly performanceMode: boolean;
	readonly warnThreshold: number;
}

const DEFAULT_CONFIGURATION: ComplexityConfiguration = {
	baseThreshold: 10,
	errorThreshold: 25,
	interfacePenalty: 20,
	performanceMode: true,
	warnThreshold: 15,
};

type ParameterWithOptionalTypeAnnotation = TSESTree.Parameter & {
	readonly typeAnnotation?: TSESTree.TSTypeAnnotation | undefined;
};

function hasTypeAnnotation(node: TSESTree.Identifier): boolean {
	return Boolean(node.typeAnnotation);
}

function getParameterTypeAnnotation(
	parameter: ParameterWithOptionalTypeAnnotation,
): TSESTree.TSTypeAnnotation | undefined {
	return parameter.typeAnnotation;
}

function isIanitorValidator(node: TSESTree.CallExpression): boolean {
	return (
		node.callee.type === TSESTree.AST_NODE_TYPES.MemberExpression &&
		node.callee.object.type === TSESTree.AST_NODE_TYPES.Identifier &&
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
	) {
		[currentType] = currentType.typeArguments.params;
	}

	if (currentType.type !== TSESTree.AST_NODE_TYPES.TSTypeReference) return undefined;

	const { typeName, typeArguments } = currentType;

	if (
		typeName.type === TSESTree.AST_NODE_TYPES.TSQualifiedName &&
		typeName.left.type === TSESTree.AST_NODE_TYPES.Identifier &&
		typeName.left.name === "Ianitor" &&
		typeName.right.type === TSESTree.AST_NODE_TYPES.Identifier &&
		typeName.right.name === "Static"
	) {
		const first = typeArguments?.params[0];
		const name =
			first?.type === TSESTree.AST_NODE_TYPES.TSTypeQuery &&
			first.exprName.type === TSESTree.AST_NODE_TYPES.Identifier
				? first.exprName.name
				: undefined;
		return name;
	}

	return undefined;
}

function hasIanitorStaticType(typeAnnotation: TSESTree.TypeNode): boolean {
	let currentType = typeAnnotation;

	if (
		currentType.type === TSESTree.AST_NODE_TYPES.TSTypeReference &&
		currentType.typeName.type === TSESTree.AST_NODE_TYPES.Identifier &&
		currentType.typeName.name === "Readonly" &&
		currentType.typeArguments?.params[0]
	) {
		[currentType] = currentType.typeArguments.params;
	}

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

function isLuaTupleType(typeAnnotation: TSESTree.TypeNode): boolean {
	let currentType = typeAnnotation;

	// Unwrap Readonly<...>
	if (
		currentType.type === TSESTree.AST_NODE_TYPES.TSTypeReference &&
		currentType.typeName.type === TSESTree.AST_NODE_TYPES.Identifier &&
		currentType.typeName.name === "Readonly" &&
		currentType.typeArguments?.params[0]
	) {
		[currentType] = currentType.typeArguments.params;
	}

	return (
		currentType.type === TSESTree.AST_NODE_TYPES.TSTypeReference &&
		currentType.typeName.type === TSESTree.AST_NODE_TYPES.Identifier &&
		currentType.typeName.name === "LuaTuple"
	);
}

function calculateIanitorComplexity(node: TSESTree.CallExpression): number {
	const { callee } = node;
	if (
		callee.type !== TSESTree.AST_NODE_TYPES.MemberExpression ||
		callee.property?.type !== TSESTree.AST_NODE_TYPES.Identifier
	) {
		return 0;
	}

	const method = callee.property.name;
	switch (method) {
		case "interface":
		case "strictInterface": {
			const properties = node.arguments?.[0];
			return properties?.type === TSESTree.AST_NODE_TYPES.ObjectExpression
				? 10 + properties.properties.length * 3
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
			return node.arguments.length * 2;

		case "string":
		case "number":
		case "boolean":
			return 1;

		default:
			return 1;
	}
}

type MessageIds = "complexInterfaceNeedsCheck" | "missingIanitorCheckType";
type Options = [Partial<ComplexityConfiguration>];

const enforceIanitorCheckType = createRule<Options, MessageIds>({
	create(context) {
		const [rawOptions] = context.options;
		const config: ComplexityConfiguration = { ...DEFAULT_CONFIGURATION, ...rawOptions };
		const ianitorStaticVariables = new Set<string>();
		const depthMultiplierCache = new Map<number, number>();
		const complexityCeiling = config.errorThreshold * 2;
		let hasIanitorReference = false;
		const interfacesToCheck = new Map<TSESTree.TSInterfaceDeclaration, { complexity: number }>();
		const typeAliasesToCheck = new Map<TSESTree.TSTypeAliasDeclaration, { complexity: number }>();

		function getDepthMultiplier(depth: number): number {
			const cached = depthMultiplierCache.get(depth);
			if (cached !== undefined) return cached;
			const computed = depth === 0 ? 1 : Math.log2(depth + 1);
			depthMultiplierCache.set(depth, computed);
			return computed;
		}

		function addScore(current: number, addition: number): number {
			const nextScore = current + addition;
			if (!config.performanceMode) return nextScore;
			return Math.min(nextScore, complexityCeiling);
		}

		function calculateTypeMembersComplexity(
			members: ReadonlyArray<TSESTree.TypeElement>,
			baseScore: number,
			nextDepth: number,
		): number {
			let score = addScore(baseScore, members.length * 2);
			for (const member of members) {
				const typeAnnotation = "typeAnnotation" in member ? member.typeAnnotation : undefined;
				if (typeAnnotation !== undefined) {
					score = addScore(score, calculateStructuralComplexity(typeAnnotation.typeAnnotation, nextDepth));
				} else if (member.type === TSESTree.AST_NODE_TYPES.TSMethodSignature) {
					score = addScore(score, calculateStructuralComplexity(member, nextDepth));
				}
			}
			return score;
		}

		function calculateUnionComplexity(types: ReadonlyArray<TSESTree.TypeNode>, nextDepth: number): number {
			let score = 0;
			for (const type of types) score = addScore(score, calculateStructuralComplexity(type, nextDepth));
			return addScore(score, 2 * (types.length - 1));
		}

		function calculateIntersectionComplexity(types: ReadonlyArray<TSESTree.TypeNode>, nextDepth: number): number {
			let score = 0;
			for (const type of types) score = addScore(score, calculateStructuralComplexity(type, nextDepth));
			return addScore(score, 3 * types.length);
		}

		function calculateTupleComplexity(elementTypes: ReadonlyArray<TSESTree.TypeNode>, nextDepth: number): number {
			let score = 1;
			for (const element of elementTypes) {
				if (
					element.type !== TSESTree.AST_NODE_TYPES.TSRestType &&
					element.type !== TSESTree.AST_NODE_TYPES.TSOptionalType
				) {
					score = addScore(score, calculateStructuralComplexity(element, nextDepth));
				}
			}
			return addScore(score, 1.5 * elementTypes.length);
		}

		function calculateTypeReferenceComplexity(
			typeArguments: TSESTree.TSTypeParameterInstantiation | undefined,
			nextDepth: number,
		): number {
			let score = 2;
			if (typeArguments === undefined) return score;

			for (const parameter of typeArguments.params) {
				score = addScore(score, calculateStructuralComplexity(parameter, nextDepth) + 2);
			}
			return score;
		}

		function calculateConditionalComplexity(node: TSESTree.TSConditionalType, nextDepth: number): number {
			let score = 3;
			score = addScore(score, calculateStructuralComplexity(node.checkType, nextDepth));
			score = addScore(score, calculateStructuralComplexity(node.extendsType, nextDepth));
			score = addScore(score, calculateStructuralComplexity(node.trueType, nextDepth));
			return addScore(score, calculateStructuralComplexity(node.falseType, nextDepth));
		}

		function calculateFunctionTypeComplexity(
			node: TSESTree.TSFunctionType | TSESTree.TSMethodSignature,
			nextDepth: number,
		): number {
			let score = 2;
			for (const parameter of node.params) {
				const typeAnnotation = getParameterTypeAnnotation(parameter);
				if (typeAnnotation !== undefined) {
					score = addScore(score, calculateStructuralComplexity(typeAnnotation.typeAnnotation, nextDepth));
				}
			}
			if (node.returnType !== undefined) {
				score = addScore(score, calculateStructuralComplexity(node.returnType.typeAnnotation, nextDepth));
			}
			return score;
		}

		function calculateMappedTypeComplexity(node: TSESTree.TSMappedType, nextDepth: number): number {
			let score = 5;
			score = addScore(score, calculateStructuralComplexity(node.constraint, nextDepth));
			if (node.typeAnnotation !== undefined) {
				score = addScore(score, calculateStructuralComplexity(node.typeAnnotation, nextDepth));
			}
			return score;
		}

		function calculateStructuralComplexity(node: TSESTree.Node, depth = 0): number {
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
				case TSESTree.AST_NODE_TYPES.TSBigIntKeyword: {
					score = 1;
					break;
				}

				case TSESTree.AST_NODE_TYPES.TSNeverKeyword:
				case TSESTree.AST_NODE_TYPES.TSUnknownKeyword:
				case TSESTree.AST_NODE_TYPES.TSAnyKeyword: {
					break;
				}

				case TSESTree.AST_NODE_TYPES.TSInterfaceDeclaration: {
					const extendsLength = node.extends.length;
					score = addScore(config.interfacePenalty, extendsLength * 5);
					score = calculateTypeMembersComplexity(node.body.body, score, nextDepth);
					break;
				}

				case TSESTree.AST_NODE_TYPES.TSTypeLiteral: {
					score = calculateTypeMembersComplexity(node.members, 2 + node.members.length * 0.5, nextDepth);
					break;
				}

				case TSESTree.AST_NODE_TYPES.TSUnionType: {
					score = calculateUnionComplexity(node.types, nextDepth);
					break;
				}

				case TSESTree.AST_NODE_TYPES.TSIntersectionType: {
					score = calculateIntersectionComplexity(node.types, nextDepth);
					break;
				}

				case TSESTree.AST_NODE_TYPES.TSArrayType: {
					score = addScore(calculateStructuralComplexity(node.elementType, nextDepth), 1);
					break;
				}

				case TSESTree.AST_NODE_TYPES.TSTupleType: {
					score = calculateTupleComplexity(node.elementTypes, nextDepth);
					break;
				}

				case TSESTree.AST_NODE_TYPES.TSTypeReference: {
					score = calculateTypeReferenceComplexity(node.typeArguments, nextDepth);
					break;
				}

				case TSESTree.AST_NODE_TYPES.TSConditionalType: {
					score = calculateConditionalComplexity(node, nextDepth);
					break;
				}

				case TSESTree.AST_NODE_TYPES.TSMappedType: {
					score = calculateMappedTypeComplexity(node, nextDepth);
					break;
				}

				case TSESTree.AST_NODE_TYPES.TSFunctionType:
				case TSESTree.AST_NODE_TYPES.TSMethodSignature: {
					score = calculateFunctionTypeComplexity(node, nextDepth);
					break;
				}

				default:
					score = 1;
			}

			score *= getDepthMultiplier(depth);
			return score;
		}

		const variableDeclaratorsToCheck = new Map<TSESTree.VariableDeclarator, { complexity: number }>();

		return {
			Identifier(node): void {
				if (node.name === "Ianitor") hasIanitorReference = true;
			},

			"Program:exit"(): void {
				if (!hasIanitorReference) return;

				for (const [node, data] of typeAliasesToCheck.entries()) {
					context.report({
						data: { score: data.complexity.toFixed(1) },
						messageId: "missingIanitorCheckType",
						node,
					});
				}

				for (const [node] of interfacesToCheck.entries()) {
					context.report({
						data: { name: node.id.name },
						messageId: "complexInterfaceNeedsCheck",
						node,
					});
				}

				for (const [node, data] of variableDeclaratorsToCheck.entries()) {
					if (
						node.id.type === TSESTree.AST_NODE_TYPES.Identifier &&
						ianitorStaticVariables.has(node.id.name)
					) {
						continue;
					}

					context.report({
						data: { score: data.complexity.toFixed(1) },
						messageId: "missingIanitorCheckType",
						node: node.id,
					});
				}
			},

			TSInterfaceDeclaration(node): void {
				const complexity = calculateStructuralComplexity(node);
				if (complexity < config.interfacePenalty) return;

				interfacesToCheck.set(node, { complexity });
			},

			TSTypeAliasDeclaration(node): void {
				const variableName = extractIanitorStaticVariable(node.typeAnnotation);
				if (variableName !== undefined) {
					hasIanitorReference = true;
					ianitorStaticVariables.add(variableName);
				}
				if (hasIanitorStaticType(node.typeAnnotation)) return;

				// LuaTuple types represent variadic return types and cannot be
				// annotated with Ianitor.Check<T>, so skip them entirely.
				if (isLuaTupleType(node.typeAnnotation)) return;

				const complexity = calculateStructuralComplexity(node.typeAnnotation);
				if (complexity < config.baseThreshold) return;

				typeAliasesToCheck.set(node, { complexity });
			},

			VariableDeclarator(node): void {
				if (node.id.type !== TSESTree.AST_NODE_TYPES.Identifier) return;
				if (!node.init || node.init.type !== TSESTree.AST_NODE_TYPES.CallExpression) return;
				if (!isIanitorValidator(node.init)) return;
				if (hasTypeAnnotation(node.id)) return;

				const complexity = calculateIanitorComplexity(node.init);
				if (complexity < config.baseThreshold) return;

				variableDeclaratorsToCheck.set(node, { complexity });
			},
		};
	},
	meta: {
		defaultOptions: [DEFAULT_CONFIGURATION],
		docs: {
			description: "Enforce Ianitor.Check<T> type annotations on complex TypeScript types",
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
	name: "enforce-ianitor-check-type",
});

export default enforceIanitorCheckType;
