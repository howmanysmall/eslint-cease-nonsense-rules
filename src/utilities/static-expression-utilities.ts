import { isImportBindingDefinition, isModuleOrGlobalScope, isVariableDefinition } from "$utilities/scope-utilities";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";

import { unwrapExpression } from "./ast-utilities";

import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

interface StaticExpressionOptions {
	readonly allowArrayHoles?: boolean;
	readonly allowAssignmentExpression?: boolean;
	readonly circularReferenceResult?: boolean;
	readonly expression: TSESTree.Expression;
	readonly seen: Set<TSESTree.Node>;
	readonly sourceCode: TSESLint.SourceCode;
	readonly staticGlobalFactories: ReadonlySet<string>;
	readonly unaryOperators: ReadonlySet<string>;
}

type ObjectPropertyValue =
	| TSESTree.Expression
	| TSESTree.PrivateIdentifier
	| TSESTree.ArrayPattern
	| TSESTree.ObjectPattern
	| TSESTree.RestElement
	| TSESTree.AssignmentPattern
	| TSESTree.TSEmptyBodyFunctionExpression;

export function findVariableInScope(
	sourceCode: TSESLint.SourceCode,
	identifier: TSESTree.Identifier,
): TSESLint.Scope.Variable | undefined {
	let scope: TSESLint.Scope.Scope | null = sourceCode.getScope(identifier);

	while (scope !== null) {
		const variable = scope.set.get(identifier.name);
		if (variable !== undefined) return variable;
		scope = scope.upper;
	}

	return undefined;
}

export function isModuleLevelScope(scope: TSESLint.Scope.Scope): boolean {
	return isModuleOrGlobalScope(scope);
}

export function isImportVariable(variable: TSESLint.Scope.Variable): boolean {
	for (const definition of variable.defs) {
		if (isImportBindingDefinition(definition)) return true;
	}

	return false;
}

export function getConstInitializer(
	definition: TSESLint.Scope.Definition | undefined,
): TSESTree.Expression | undefined {
	if (definition === undefined || !isVariableDefinition(definition)) return undefined;
	if (definition.parent.kind !== "const") return undefined;
	return definition.node.init ?? undefined;
}

function isStaticIdentifierReference(options: StaticExpressionOptions, identifier: TSESTree.Identifier): boolean {
	const variable = findVariableInScope(options.sourceCode, identifier);
	if (variable === undefined) return options.staticGlobalFactories.has(identifier.name);
	if (!isModuleLevelScope(variable.scope)) return false;
	if (isImportVariable(variable)) return true;

	for (const definition of variable.defs) {
		const initializer = getConstInitializer(definition);
		if (initializer === undefined) continue;
		if (isStaticExpression(options, initializer)) return true;
	}

	return false;
}

function isExpression(value: ObjectPropertyValue): value is TSESTree.Expression {
	return (
		value.type !== AST_NODE_TYPES.PrivateIdentifier &&
		value.type !== AST_NODE_TYPES.AssignmentPattern &&
		value.type !== AST_NODE_TYPES.ArrayPattern &&
		value.type !== AST_NODE_TYPES.ObjectPattern &&
		value.type !== AST_NODE_TYPES.RestElement &&
		value.type !== AST_NODE_TYPES.TSEmptyBodyFunctionExpression
	);
}

function isNonPrivateExpression(value: TSESTree.Expression | TSESTree.PrivateIdentifier): value is TSESTree.Expression {
	return value.type !== AST_NODE_TYPES.PrivateIdentifier;
}

function isStaticArrayExpression(arrayExpression: TSESTree.ArrayExpression, options: StaticExpressionOptions): boolean {
	for (const element of arrayExpression.elements) {
		if (element === null) {
			if (options.allowArrayHoles === true) continue;
			return false;
		}

		if (element.type === AST_NODE_TYPES.SpreadElement) return false;
		if (!isStaticExpression(options, element)) return false;
	}

	return true;
}

function isStaticObjectExpression(
	objectExpression: TSESTree.ObjectExpression,
	options: StaticExpressionOptions,
): boolean {
	for (const property of objectExpression.properties) {
		if (property.type !== AST_NODE_TYPES.Property) return false;
		if (property.kind !== "init") return false;
		if (property.computed && !isStaticExpression(options, property.key)) return false;
		if (!isExpression(property.value)) return false;
		if (!isStaticExpression(options, property.value)) return false;
	}

	return true;
}

function isStaticMemberProperty(property: TSESTree.Expression, options: StaticExpressionOptions): boolean {
	if (property.type === AST_NODE_TYPES.Identifier) return true;
	return isStaticExpression(options, property);
}

function isStaticCallCallee(callee: TSESTree.Expression, options: StaticExpressionOptions): boolean {
	const unwrapped = unwrapExpression(callee);

	if (unwrapped.type === AST_NODE_TYPES.Identifier) {
		return isStaticIdentifierReference(options, unwrapped);
	}

	if (unwrapped.type !== AST_NODE_TYPES.MemberExpression) return false;
	if (!isStaticExpression(options, unwrapped.object)) return false;
	if (unwrapped.computed) return isStaticMemberProperty(unwrapped.property, options);
	return unwrapped.property.type === AST_NODE_TYPES.Identifier;
}

function isStaticCallOrNewExpression(
	expression: TSESTree.CallExpression | TSESTree.NewExpression,
	options: StaticExpressionOptions,
): boolean {
	if (!isStaticCallCallee(expression.callee, options)) return false;

	return expression.arguments.every(
		(argument) => argument.type !== AST_NODE_TYPES.SpreadElement && isStaticExpression(options, argument),
	);
}

function isStaticBinaryOrLogicalExpression(
	expression: TSESTree.BinaryExpression | TSESTree.LogicalExpression,
	options: StaticExpressionOptions,
): boolean {
	return (
		isNonPrivateExpression(expression.left) &&
		isNonPrivateExpression(expression.right) &&
		isStaticExpression(options, expression.left) &&
		isStaticExpression(options, expression.right)
	);
}

export function isStaticExpression(
	options: StaticExpressionOptions,
	expression: TSESTree.Expression = options.expression,
): boolean {
	const unwrapped = unwrapExpression(expression);
	if (options.seen.has(unwrapped)) return options.circularReferenceResult === true;
	options.seen.add(unwrapped);

	switch (unwrapped.type) {
		case AST_NODE_TYPES.Literal:
			return true;

		case AST_NODE_TYPES.TemplateLiteral:
			return unwrapped.expressions.length === 0;

		case AST_NODE_TYPES.UnaryExpression: {
			return options.unaryOperators.has(unwrapped.operator) && isStaticExpression(options, unwrapped.argument);
		}

		case AST_NODE_TYPES.BinaryExpression:
		case AST_NODE_TYPES.LogicalExpression:
			return isStaticBinaryOrLogicalExpression(unwrapped, options);

		case AST_NODE_TYPES.ConditionalExpression: {
			return (
				isStaticExpression(options, unwrapped.test) &&
				isStaticExpression(options, unwrapped.consequent) &&
				isStaticExpression(options, unwrapped.alternate)
			);
		}

		case AST_NODE_TYPES.ArrayExpression:
			return isStaticArrayExpression(unwrapped, options);

		case AST_NODE_TYPES.ObjectExpression:
			return isStaticObjectExpression(unwrapped, options);

		case AST_NODE_TYPES.Identifier: {
			return isStaticIdentifierReference(options, unwrapped);
		}

		case AST_NODE_TYPES.MemberExpression: {
			return (
				isStaticExpression(options, unwrapped.object) &&
				(!unwrapped.computed || isStaticMemberProperty(unwrapped.property, options))
			);
		}

		case AST_NODE_TYPES.CallExpression:
		case AST_NODE_TYPES.NewExpression:
			return isStaticCallOrNewExpression(unwrapped, options);

		case AST_NODE_TYPES.SequenceExpression: {
			return (
				unwrapped.expressions.length > 0 &&
				unwrapped.expressions.every((nestedExpression) => isStaticExpression(options, nestedExpression))
			);
		}

		case AST_NODE_TYPES.AssignmentExpression: {
			return options.allowAssignmentExpression === true && isStaticExpression(options, unwrapped.right);
		}

		default:
			return false;
	}
}
