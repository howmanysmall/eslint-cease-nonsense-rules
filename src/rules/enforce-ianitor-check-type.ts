import type { TSESTree } from "@typescript-eslint/types";
import type { Rule } from "eslint";

/**
 * Configuration options for the enforce-ianitor-check-type rule.
 */
interface ComplexityConfig {
	baseThreshold: number;
	warnThreshold: number;
	errorThreshold: number;
	interfacePenalty: number;
	performanceMode: boolean;
}

/**
 * Cache for complexity calculations to improve performance.
 */
interface ComplexityCache {
	nodeCache: WeakMap<object, number>;
	visitedNodes: WeakSet<object>;
}

/**
 * Default configuration values for the rule.
 */
const DEFAULT_CONFIG: ComplexityConfig = {
	baseThreshold: 10,
	errorThreshold: 25,
	interfacePenalty: 20,
	performanceMode: true,
	warnThreshold: 15,
};

/**
 * Checks if a node has a type annotation.
 *
 * @param node - The node to check.
 * @returns True if the node has a type annotation.
 */
function hasTypeAnnotation(node: { type: string; id?: unknown; returnType?: unknown }): boolean {
	if (node.type === "VariableDeclarator" && node.id && typeof node.id === "object" && "typeAnnotation" in node.id)
		return !!node.id.typeAnnotation;
	if (node.type === "FunctionDeclaration" || node.type === "FunctionExpression") return !!node.returnType;
	return false;
}

/**
 * Extracts the type name from a TypeScript type node.
 *
 * @param node - The TypeScript AST node.
 * @returns The type name or null if not applicable.
 */
function getTypeName(node: TSESTree.Node): string | null {
	return node.type === "TSInterfaceDeclaration" || node.type === "TSTypeAliasDeclaration" ? node.id.name : null;
}

/**
 * Checks if a node is an Ianitor validator call.
 *
 * @param node - The node to check.
 * @returns True if the node is an Ianitor validator.
 */
function isIanitorValidator(node: {
	type: string;
	callee?: { type: string; object?: { type: string; name?: string } };
}): boolean {
	return (
		node.type === "CallExpression" &&
		node.callee?.type === "MemberExpression" &&
		node.callee.object?.type === "Identifier" &&
		node.callee.object.name === "Ianitor"
	);
}

/**
 * Checks if a type annotation uses the Ianitor.Static<typeof ...> pattern.
 *
 * @param typeAnnotation - The TypeScript type annotation to check.
 * @returns True if the type uses Ianitor.Static pattern.
 */
function hasIanitorStaticType(typeAnnotation: TSESTree.TypeNode): boolean {
	let currentType = typeAnnotation;

	// Handle Readonly<...> wrapper
	if (
		currentType.type === "TSTypeReference" &&
		currentType.typeName.type === "Identifier" &&
		currentType.typeName.name === "Readonly" &&
		currentType.typeArguments?.params[0]
	) {
		currentType = currentType.typeArguments.params[0];
	}

	// Check for Ianitor.Static<typeof ...>
	if (currentType.type !== "TSTypeReference") return false;

	const { typeName, typeArguments } = currentType;
	const firstParam = typeArguments?.params[0];

	return (
		typeName.type === "TSQualifiedName" &&
		typeName.left.type === "Identifier" &&
		typeName.left.name === "Ianitor" &&
		typeName.right.type === "Identifier" &&
		typeName.right.name === "Static" &&
		firstParam?.type === "TSTypeQuery"
	);
}

/**
 * Calculates the complexity score of an Ianitor validator.
 *
 * @param node - The Ianitor validator node.
 * @returns The complexity score.
 */
function calculateIanitorComplexity(node: {
	readonly callee?: {
		readonly type: string;
		readonly property?: { type: string; name?: string };
	};
	readonly arguments?: ReadonlyArray<{ type?: string; properties?: unknown[] }>;
}): number {
	const callee = node.callee;
	if (callee?.type !== "MemberExpression" || callee.property?.type !== "Identifier") return 0;

	const method = callee.property.name;
	switch (method) {
		case "interface":
		case "strictInterface": {
			const props = node.arguments?.[0];
			return props?.type === "ObjectExpression" ? 10 + (props.properties?.length || 0) * 3 : 0;
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

const enforceIanitorCheckType: Rule.RuleModule = {
	/**
	 * Creates the ESLint rule visitor.
	 *
	 * @param context - The ESLint rule context.
	 * @returns The visitor object with AST node handlers.
	 */
	create(context) {
		const config: ComplexityConfig = { ...DEFAULT_CONFIG, ...context.options[0] };
		const cache: ComplexityCache = {
			nodeCache: new WeakMap(),
			visitedNodes: new WeakSet(),
		};
		// Track variable names used in Ianitor.Static<typeof varName> patterns
		const ianitorStaticVariables = new Set<string>();
		const depthMultiplierCache = new Map<number, number>();
		const complexityCeiling = config.errorThreshold * 2;

		/**
		 * Retrieves the cached logarithmic multiplier for a given depth.
		 *
		 * @param depth - The current recursion depth.
		 * @returns The multiplier applied to the accumulated score.
		 */
		function getDepthMultiplier(depth: number): number {
			const cached = depthMultiplierCache.get(depth);
			if (cached !== undefined) return cached;
			const computed = Math.log2(depth + 1);
			depthMultiplierCache.set(depth, computed);
			return computed;
		}

		/**
		 * Adds a contribution to the running score, respecting performance ceilings.
		 *
		 * @param current - The current accumulated score.
		 * @param addition - The contribution that should be added.
		 * @returns The bounded score after applying the contribution.
		 */
		function addScore(current: number, addition: number): number {
			const nextScore = current + addition;
			if (!config.performanceMode) return nextScore;
			return nextScore > complexityCeiling ? complexityCeiling : nextScore;
		}

		/**
		 * Extracts the variable name from Ianitor.Static<typeof varName> pattern.
		 *
		 * @param typeAnnotation - The TypeScript type annotation to check.
		 * @returns The variable name if found, null otherwise.
		 */
		// oxlint-disable-next-line consistent-function-scoping
		function extractIanitorStaticVariable(typeAnnotation: TSESTree.TypeNode): string | null {
			let currentType = typeAnnotation;

			// Handle Readonly<...> wrapper
			if (
				currentType.type === "TSTypeReference" &&
				currentType.typeName.type === "Identifier" &&
				currentType.typeName.name === "Readonly" &&
				currentType.typeArguments?.params[0]
			) {
				currentType = currentType.typeArguments.params[0];
			}

			// Check for Ianitor.Static<typeof varName>
			if (currentType.type !== "TSTypeReference") return null;

			const { typeName, typeArguments } = currentType;
			const firstParam = typeArguments?.params[0];

			if (
				typeName.type === "TSQualifiedName" &&
				typeName.left.type === "Identifier" &&
				typeName.left.name === "Ianitor" &&
				typeName.right.type === "Identifier" &&
				typeName.right.name === "Static" &&
				firstParam?.type === "TSTypeQuery" &&
				firstParam.exprName.type === "Identifier"
			) {
				return firstParam.exprName.name;
			}

			return null;
		}

		/**
		 * Calculates the structural complexity of a TypeScript type.
		 *
		 * @param node - The TypeScript AST node.
		 * @param depth - The current depth in the type tree.
		 * @returns The complexity score.
		 */
		function calculateStructuralComplexity(node: TSESTree.Node, depth = 0): number {
			// Performance: Cache everything
			const cached = cache.nodeCache.get(node);
			if (cached !== undefined) return cached;

			// Cycle detection without TypeChecker
			if (cache.visitedNodes.has(node)) return 50;

			cache.visitedNodes.add(node);

			let score = 0;
			const nextDepth = depth + 1;

			switch (node.type) {
				// Primitives
				case "TSStringKeyword":
				case "TSNumberKeyword":
				case "TSBooleanKeyword":
				case "TSNullKeyword":
				case "TSUndefinedKeyword":
				case "TSVoidKeyword":
				case "TSSymbolKeyword":
				case "TSBigIntKeyword":
					score = 1;
					break;

				// Short-circuits
				case "TSNeverKeyword":
				case "TSUnknownKeyword":
				case "TSAnyKeyword":
					score = 0;
					break;

				// INTERFACES - ALWAYS COMPLEX
				case "TSInterfaceDeclaration": {
					const iface = node;
					score = config.interfacePenalty;
					const extendsLength = iface.extends?.length;
					if (extendsLength) score = addScore(score, extendsLength * 5);

					const { body } = iface.body;
					score = addScore(score, body.length * 2);
					for (const member of body) {
						const typeAnnotation = "typeAnnotation" in member ? member.typeAnnotation : undefined;
						if (typeAnnotation)
							score = addScore(score, calculateStructuralComplexity(typeAnnotation.typeAnnotation, nextDepth));
					}
					break;
				}

				// Type literals (object types)
				case "TSTypeLiteral": {
					const { members } = node;
					score = 2 + members.length * 0.5;
					for (const member of members) {
						const typeAnnotation = "typeAnnotation" in member ? member.typeAnnotation : undefined;
						if (typeAnnotation)
							score = addScore(score, calculateStructuralComplexity(typeAnnotation.typeAnnotation, nextDepth));
					}
					break;
				}

				// Unions
				case "TSUnionType": {
					const { types } = node;
					for (const type of types) score = addScore(score, calculateStructuralComplexity(type, nextDepth));
					score = addScore(score, 2 * (types.length - 1));
					break;
				}

				// Intersections
				case "TSIntersectionType": {
					const { types } = node;
					for (const type of types) score = addScore(score, calculateStructuralComplexity(type, nextDepth));
					score = addScore(score, 3 * types.length);
					break;
				}

				// Arrays
				case "TSArrayType":
					score = addScore(calculateStructuralComplexity(node.elementType, nextDepth), 1);
					break;

				// Tuples
				case "TSTupleType": {
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

				// Type references (including generics)
				case "TSTypeReference": {
					score = 2;
					const { typeArguments } = node;
					if (typeArguments) {
						for (const param of typeArguments.params)
							score = addScore(score, calculateStructuralComplexity(param, nextDepth) + 2);
					}
					break;
				}

				// Conditional types
				case "TSConditionalType": {
					score = 3;
					score = addScore(score, calculateStructuralComplexity(node.checkType, nextDepth));
					score = addScore(score, calculateStructuralComplexity(node.extendsType, nextDepth));
					score = addScore(score, calculateStructuralComplexity(node.trueType, nextDepth));
					score = addScore(score, calculateStructuralComplexity(node.falseType, nextDepth));
					break;
				}

				// Mapped types
				case "TSMappedType": {
					score = 5;
					if (node.constraint) score = addScore(score, calculateStructuralComplexity(node.constraint, nextDepth));
					if (node.typeAnnotation)
						score = addScore(score, calculateStructuralComplexity(node.typeAnnotation, nextDepth));
					break;
				}

				// Function types
				case "TSFunctionType":
				case "TSMethodSignature": {
					const func = node as TSESTree.TSFunctionType | TSESTree.TSMethodSignature;
					score = 2;
					for (const param of func.params) {
						const typeAnnotation = "typeAnnotation" in param ? param.typeAnnotation : undefined;
						if (typeAnnotation)
							score = addScore(score, calculateStructuralComplexity(typeAnnotation.typeAnnotation, nextDepth));
					}
					if (func.returnType)
						score = addScore(score, calculateStructuralComplexity(func.returnType.typeAnnotation, nextDepth));
					break;
				}

				default:
					score = 1;
			}

			// Apply depth multiplier (logarithmic to prevent explosion)
			score *= getDepthMultiplier(depth);

			// Cache and return
			cache.nodeCache.set(node, score);
			cache.visitedNodes.delete(node);
			return score;
		}

		// Track which VariableDeclarator nodes need checking after type aliases are collected
		const variableDeclaratorsToCheck = new Map<unknown, { complexity: number }>();

		return {
			// Handle type alias declarations
			TSTypeAliasDeclaration(node: TSESTree.TSTypeAliasDeclaration) {
				// First, check if this uses Ianitor.Static pattern and collect the variable name
				const varName = extractIanitorStaticVariable(node.typeAnnotation);
				if (varName) ianitorStaticVariables.add(varName);

				// Skip complexity check if the type uses Ianitor.Static<typeof ...> pattern
				if (hasIanitorStaticType(node.typeAnnotation)) return;

				// Check complexity of the type alias
				const complexity = calculateStructuralComplexity(node.typeAnnotation);
				if (complexity < config.baseThreshold) return;

				context.report({
					data: { score: complexity.toFixed(1) },
					messageId: "missingIanitorCheckType",
					node,
				});
			},

			// Check interface declarations
			TSInterfaceDeclaration(node) {
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

			// Collect variable declarators that might need checking
			VariableDeclarator(node) {
				if (!node.init || node.init.type !== "CallExpression") return;
				if (!isIanitorValidator(node.init)) return;
				if (hasTypeAnnotation(node)) return;

				const complexity = calculateIanitorComplexity(node.init);
				if (complexity < config.baseThreshold) return;

				// Store for later checking in Program:exit
				variableDeclaratorsToCheck.set(node as unknown, { complexity });
			},

			// After all nodes are visited, check the collected variable declarators
			"Program:exit"() {
				for (const [nodeKey, data] of variableDeclaratorsToCheck.entries()) {
					const node = nodeKey as TSESTree.VariableDeclarator;

					// Skip if this variable is used in an Ianitor.Static<typeof ...> pattern
					if (node.id.type === "Identifier" && ianitorStaticVariables.has(node.id.name)) continue;

					context.report({
						data: { score: data.complexity.toFixed(1) },
						messageId: "missingIanitorCheckType",
						node,
					});
				}
			},
		};
	},
	meta: {
		docs: {
			description: "Enforce Ianitor.Check<T> type annotations on complex TypeScript types",
			recommended: false,
		},
		fixable: undefined,
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
