import { TSESTree } from "@typescript-eslint/types";
import type { TypeChecker, TypeNode } from "typescript";
import { createRule } from "../utilities/create-rule";

/**
 * Configuration options for the require-serialized-numeric-data-type rule.
 */
export interface RequireSerializedNumericDataTypeOptions {
	/**
	 * Check mode:
	 * - `"type-arguments"` (default): Only check type arguments of function calls
	 * - `"all"`: Check all `number` type annotations globally
	 */
	readonly mode?: "type-arguments" | "all";

	/**
	 * Function names to check for type arguments when mode is "type-arguments".
	 * @default ["registerComponent"]
	 */
	readonly functionNames?: ReadonlyArray<string>;

	/**
	 * When true, resolves type aliases using TypeScript's type checker.
	 * Slower but catches aliased types like `type Foo = number`.
	 * Requires `parserOptions.project` to be configured.
	 * @default false
	 */
	readonly strict?: boolean;
}

type Options = [RequireSerializedNumericDataTypeOptions?];
type MessageIds = "requireSerializedNumericDataType";

const DEFAULT_FUNCTION_NAMES = ["registerComponent"];

function isRawNumberType(node: TSESTree.TypeNode): boolean {
	return node.type === TSESTree.AST_NODE_TYPES.TSNumberKeyword;
}

function isDataTypeReference(node: TSESTree.TypeNode): boolean {
	if (node.type !== TSESTree.AST_NODE_TYPES.TSTypeReference) return false;

	const { typeName } = node;

	if (typeName.type === TSESTree.AST_NODE_TYPES.TSQualifiedName) {
		const { left, right } = typeName;
		if (
			left.type === TSESTree.AST_NODE_TYPES.Identifier &&
			left.name === "DataType" &&
			right.type === TSESTree.AST_NODE_TYPES.Identifier
		) {
			const dataTypeName = right.name;
			return (
				dataTypeName === "f32" ||
				dataTypeName === "f64" ||
				dataTypeName === "u8" ||
				dataTypeName === "u16" ||
				dataTypeName === "u32" ||
				dataTypeName === "i8" ||
				dataTypeName === "i16" ||
				dataTypeName === "i32"
			);
		}
	}

	return false;
}

function containsRawNumber(node: TSESTree.TypeNode): boolean {
	if (isRawNumberType(node)) return true;
	if (isDataTypeReference(node)) return false;

	if (node.type === TSESTree.AST_NODE_TYPES.TSUnionType || node.type === TSESTree.AST_NODE_TYPES.TSIntersectionType) {
		return node.types.some(containsRawNumber);
	}

	if (node.type === TSESTree.AST_NODE_TYPES.TSTypeLiteral) {
		for (const member of node.members) {
			if (
				member.type === TSESTree.AST_NODE_TYPES.TSPropertySignature &&
				member.typeAnnotation !== undefined &&
				member.typeAnnotation.typeAnnotation !== undefined &&
				containsRawNumber(member.typeAnnotation.typeAnnotation)
			) {
				return true;
			}
		}
		return false;
	}

	if (node.type === TSESTree.AST_NODE_TYPES.TSArrayType) return containsRawNumber(node.elementType);
	if (node.type === TSESTree.AST_NODE_TYPES.TSTupleType) return node.elementTypes.some(containsRawNumber);
	if (node.type === TSESTree.AST_NODE_TYPES.TSIndexedAccessType) return containsRawNumber(node.objectType);
	if (node.type === TSESTree.AST_NODE_TYPES.TSTypeOperator) {
		const { typeAnnotation } = node;
		if (typeAnnotation !== undefined) return containsRawNumber(typeAnnotation);
	}

	return false;
}

function checkTypeWithTypeChecker(typeChecker: TypeChecker, node: TypeNode, visited = new Set<number>()): boolean {
	const nodeId = node.pos;
	if (visited.has(nodeId)) return false;
	visited.add(nodeId);

	const type = typeChecker.getTypeAtLocation(node);
	const typeString = typeChecker.typeToString(type);

	if (typeString === "number") return true;
	if (type.isUnion() || type.isIntersection()) {
		return type.types.some((tsType) => typeChecker.typeToString(tsType) === "number");
	}

	return false;
}

const requireSerializedNumericDataType = createRule<Options, MessageIds>({
	create(context) {
		const options = context.options[0] ?? {};
		const mode = options.mode ?? "type-arguments";
		const functionNames = new Set(options.functionNames ?? DEFAULT_FUNCTION_NAMES);
		const strictMode = options.strict ?? false;

		const { parserServices } = context.sourceCode;

		const typeChecker =
			strictMode && parserServices !== undefined && parserServices.program
				? parserServices.program.getTypeChecker()
				: undefined;

		function reportError(node: TSESTree.Node): void {
			context.report({
				messageId: "requireSerializedNumericDataType",
				node,
			});
		}

		function checkTypeNode(node: TSESTree.TypeNode): boolean {
			if (containsRawNumber(node)) return true;

			if (
				typeChecker !== undefined &&
				parserServices !== undefined &&
				"esTreeNodeToTSNodeMap" in parserServices
			) {
				const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);
				if (tsNode !== undefined) {
					return checkTypeWithTypeChecker(typeChecker, tsNode as TypeNode);
				}
			}

			return false;
		}

		function checkTypeAnnotation(annotation: TSESTree.TSTypeAnnotation | undefined): void {
			if (annotation === undefined) return;

			const { typeAnnotation } = annotation;
			if (typeAnnotation !== undefined && checkTypeNode(typeAnnotation)) reportError(typeAnnotation);
		}

		if (mode === "type-arguments") {
			return {
				CallExpression(node: TSESTree.CallExpression): void {
					if (node.callee.type !== TSESTree.AST_NODE_TYPES.Identifier) return;
					if (!functionNames.has(node.callee.name)) return;

					if (node.typeArguments === undefined) return;
					for (const parameter of node.typeArguments.params) {
						if (checkTypeNode(parameter)) reportError(parameter);
					}
				},
			};
		}

		return {
			ArrowFunctionExpression(node: TSESTree.ArrowFunctionExpression): void {
				for (const parameter of node.params) {
					if (parameter.type === TSESTree.AST_NODE_TYPES.Identifier) {
						checkTypeAnnotation(parameter.typeAnnotation);
					}
				}
				checkTypeAnnotation(node.returnType);
			},

			CallExpression(node: TSESTree.CallExpression): void {
				if (node.typeArguments === undefined) return;
				for (const parameter of node.typeArguments.params) if (checkTypeNode(parameter)) reportError(parameter);
			},

			FunctionDeclaration(node: TSESTree.FunctionDeclaration): void {
				for (const parameter of node.params) {
					if (parameter.type === TSESTree.AST_NODE_TYPES.Identifier) {
						checkTypeAnnotation(parameter.typeAnnotation);
					}
				}
				checkTypeAnnotation(node.returnType);
			},

			MethodDefinition(node: TSESTree.MethodDefinition): void {
				if (node.value.type === TSESTree.AST_NODE_TYPES.FunctionExpression) {
					for (const parameter of node.value.params) {
						if (parameter.type === TSESTree.AST_NODE_TYPES.Identifier) {
							checkTypeAnnotation(parameter.typeAnnotation);
						}
					}
					checkTypeAnnotation(node.value.returnType);
				}
			},

			PropertyDefinition(node: TSESTree.PropertyDefinition): void {
				checkTypeAnnotation(node.typeAnnotation);
			},

			TSFunctionType(node: TSESTree.TSFunctionType): void {
				for (const parameter of node.params) {
					if (parameter.type === TSESTree.AST_NODE_TYPES.Identifier) {
						checkTypeAnnotation(parameter.typeAnnotation);
					}
				}
				checkTypeAnnotation(node.returnType);
			},

			TSPropertySignature(node: TSESTree.TSPropertySignature): void {
				checkTypeAnnotation(node.typeAnnotation);
			},

			TSTypeAliasDeclaration(node: TSESTree.TSTypeAliasDeclaration): void {
				if (checkTypeNode(node.typeAnnotation)) reportError(node.typeAnnotation);
			},
			VariableDeclarator(node: TSESTree.VariableDeclarator): void {
				checkTypeAnnotation(node.id.typeAnnotation);
			},
		};
	},
	defaultOptions: [
		{
			functionNames: DEFAULT_FUNCTION_NAMES,
			mode: "type-arguments",
			strict: false,
		},
	],
	meta: {
		docs: {
			description:
				"Require specific serialized numeric data types (DataType.*) instead of generic `number` for ECS components and other serialization contexts.",
		},
		messages: {
			requireSerializedNumericDataType:
				"Use a more precise numeric data type for serialization. Prefer `DataType.u8`, `DataType.u16`, `DataType.u32`, `DataType.i8`, `DataType.i16`, `DataType.i32`, `DataType.f32`, or `DataType.f64` over generic `number`.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					functionNames: {
						description: "Function names to check for type arguments when mode is 'type-arguments'.",
						items: { type: "string" },
						type: "array",
					},
					mode: {
						description:
							"Check mode: 'type-arguments' (default) only checks type arguments of function calls, 'all' checks all number type annotations globally.",
						enum: ["type-arguments", "all"],
						type: "string",
					},
					strict: {
						description:
							"When true, resolves type aliases using TypeScript's type checker. Slower but catches aliased types. Requires parserOptions.project to be configured.",
						type: "boolean",
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
	name: "require-serialized-numeric-data-type",
});

export default requireSerializedNumericDataType;
