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
function hasTypeAnnotation(node: unknown): boolean {
	const nodeObj = node as { type: string; id?: unknown; returnType?: unknown };
	if (nodeObj.type === "VariableDeclarator") {
		const id = nodeObj.id as { typeAnnotation?: unknown } | undefined;
		return !!(id && "typeAnnotation" in id && id.typeAnnotation);
	}
	if (nodeObj.type === "FunctionDeclaration" || nodeObj.type === "FunctionExpression") return !!nodeObj.returnType;
	return false;
}

/**
 * Extracts the type name from a TypeScript type node.
 *
 * @param node - The TypeScript AST node.
 * @returns The type name or null if not applicable.
 */
function getTypeName(node: TSESTree.Node): string | null {
	if (node.type === "TSInterfaceDeclaration") return node.id.name;
	if (node.type === "TSTypeAliasDeclaration") return node.id.name;
	return null;
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
	if (node.type !== "CallExpression") return false;
	const callee = node.callee;

	if (callee && callee.type === "MemberExpression") {
		const object = callee.object;
		if (object && object.type === "Identifier" && object.name === "Ianitor") return true;
	}

	return false;
}

/**
 * Calculates the complexity score of an Ianitor validator.
 *
 * @param node - The Ianitor validator node.
 * @returns The complexity score.
 */
function calculateIanitorComplexity(node: unknown): number {
	const callNode = node as {
		readonly type: string;
		readonly callee?: {
			readonly type: string;
			readonly property?: { type: string; name?: string };
		};
		readonly arguments?: Array<unknown>;
	};

	const callee = callNode.callee;
	let score = 0;

	if (callee?.type === "MemberExpression" && callee.property && callee.property.type === "Identifier") {
		const method = callee.property.name;

		switch (method) {
			case "interface":
			case "strictInterface": {
				const props = callNode.arguments?.[0] as { type?: string; properties?: unknown[] };
				// Skip recursive property calculation for now to avoid type issues
				if (props && props.type === "ObjectExpression") score = 10 + (props.properties?.length || 0) * 3;
				break;
			}

			case "optional":
			case "array":
				score = 2;
				break;

			case "record":
			case "map":
				score = 3;
				break;

			case "union":
			case "intersection":
				score = (callNode.arguments?.length || 0) * 2;
				break;

			case "string":
			case "number":
			case "boolean":
				score = 1;
				break;

			case "instanceIsA":
			case "instanceOf":
				score = 2;
				break;

			default:
				score = 1;
		}
	}

	return score;
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

		/**
		 * Calculates the structural complexity of a TypeScript type.
		 *
		 * @param node - The TypeScript AST node.
		 * @param depth - The current depth in the type tree.
		 * @returns The complexity score.
		 */
		function calculateStructuralComplexity(node: TSESTree.Node, depth = 0): number {
			// Performance: Cache everything
			if (cache.nodeCache.has(node)) return cache.nodeCache.get(node)!;

			// Cycle detection without TypeChecker
			if (cache.visitedNodes.has(node)) return 50;

			cache.visitedNodes.add(node);

			let score = 0;

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
					score = config.interfacePenalty; // Base penalty
					// Add for extends
					if (iface.extends && iface.extends.length > 0) score += iface.extends.length * 5;

					// Add for members
					score += iface.body.body.length * 2;
					// Recurse on member types
					for (const member of iface.body.body)
						if ("typeAnnotation" in member && member.typeAnnotation)
							score += calculateStructuralComplexity(member.typeAnnotation.typeAnnotation, depth + 1);

					break;
				}

				// Type literals (object types)
				case "TSTypeLiteral": {
					const literal = node;
					score = 2;
					score += literal.members.length * 0.5;
					for (const member of literal.members)
						if ("typeAnnotation" in member && member.typeAnnotation)
							score += calculateStructuralComplexity(member.typeAnnotation.typeAnnotation, depth + 1);

					break;
				}

				// Unions
				case "TSUnionType": {
					const union = node;
					for (const type of union.types) score += calculateStructuralComplexity(type, depth + 1);

					score += 2 * (union.types.length - 1); // Branch penalty
					break;
				}

				// Intersections
				case "TSIntersectionType": {
					const intersection = node;
					for (const type of intersection.types) {
						score += calculateStructuralComplexity(type, depth + 1);
					}
					score += 3 * intersection.types.length; // Overlap resolution penalty
					break;
				}

				// Arrays
				case "TSArrayType": {
					const array = node;
					score = calculateStructuralComplexity(array.elementType, depth + 1) + 1;
					break;
				}

				// Tuples
				case "TSTupleType": {
					const tuple = node;
					score = 1;
					for (const element of tuple.elementTypes)
						if (element.type !== "TSRestType" && element.type !== "TSOptionalType")
							score += calculateStructuralComplexity(element, depth + 1);

					score += 1.5 * tuple.elementTypes.length;
					break;
				}

				// Type references (including generics)
				case "TSTypeReference": {
					const ref = node;
					score = 2;
					if (ref.typeArguments)
						for (const param of ref.typeArguments.params)
							score += calculateStructuralComplexity(param, depth + 1) + 2;

					break;
				}

				// Conditional types
				case "TSConditionalType": {
					const conditional = node;
					score = 3;
					score += calculateStructuralComplexity(conditional.checkType, depth + 1);
					score += calculateStructuralComplexity(conditional.extendsType, depth + 1);
					score += calculateStructuralComplexity(conditional.trueType, depth + 1);
					score += calculateStructuralComplexity(conditional.falseType, depth + 1);
					break;
				}

				// Mapped types
				case "TSMappedType": {
					const mapped = node;
					score = 5;
					if (mapped.typeParameter?.constraint)
						score += calculateStructuralComplexity(mapped.typeParameter.constraint, depth + 1);

					if (mapped.typeAnnotation) score += calculateStructuralComplexity(mapped.typeAnnotation, depth + 1);

					break;
				}

				// Function types
				case "TSFunctionType":
				case "TSMethodSignature": {
					const func = node as TSESTree.TSFunctionType | TSESTree.TSMethodSignature;
					score = 2;
					for (const param of func.params)
						if ("typeAnnotation" in param && param.typeAnnotation)
							score += calculateStructuralComplexity(param.typeAnnotation.typeAnnotation, depth + 1);

					if (func.returnType)
						score += calculateStructuralComplexity(func.returnType.typeAnnotation, depth + 1);

					break;
				}

				default:
					score = 1;
			}

			// Apply depth multiplier (logarithmic to prevent explosion)
			score *= Math.log2(depth + 1);

			// Cache and return
			cache.nodeCache.set(node, score);
			cache.visitedNodes.delete(node);
			return score;
		}

		return {
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

			// Check type alias declarations
			TSTypeAliasDeclaration(node) {
				const complexity = calculateStructuralComplexity(node.typeAnnotation);

				if (complexity < config.baseThreshold) return;
				context.report({
					data: { score: complexity.toFixed(1) },
					messageId: "missingIanitorCheckType",
					node,
				});
			},

			// Check variable declarations with Ianitor validators
			VariableDeclarator(node) {
				if (!node.init || node.init.type !== "CallExpression") return;
				if (!isIanitorValidator(node.init)) return;
				if (hasTypeAnnotation(node)) return;

				const complexity = calculateIanitorComplexity(node.init);

				if (complexity < config.baseThreshold) return;
				context.report({
					data: { score: complexity.toFixed(1) },
					messageId: "missingIanitorCheckType",
					node,
				});
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
