import { DefinitionType, ScopeType } from "@typescript-eslint/scope-manager";

import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

interface StaticIdentifierReferenceOptions {
	readonly identifier: TSESTree.Identifier;
	readonly isStaticExpression: (expression: TSESTree.Expression) => boolean;
	readonly seen: Set<TSESTree.Node>;
	readonly sourceCode: TSESLint.SourceCode;
	readonly staticGlobalFactories: ReadonlySet<string>;
}

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
	return scope.type === ScopeType.module || scope.type === ScopeType.global;
}

export function isImportVariable(variable: TSESLint.Scope.Variable): boolean {
	for (const definition of variable.defs) {
		if (definition.type === DefinitionType.ImportBinding) return true;
	}

	return false;
}

export function getConstInitializer(
	definition: TSESLint.Scope.Definition | undefined,
): TSESTree.Expression | undefined {
	if (definition?.type !== DefinitionType.Variable) return undefined;
	if (definition.parent.kind !== "const") return undefined;
	return definition.node.init ?? undefined;
}

export function isStaticIdentifierReference(options: StaticIdentifierReferenceOptions): boolean {
	const variable = findVariableInScope(options.sourceCode, options.identifier);
	if (variable === undefined) return options.staticGlobalFactories.has(options.identifier.name);
	if (!isModuleLevelScope(variable.scope)) return false;
	if (isImportVariable(variable)) return true;

	for (const definition of variable.defs) {
		const initializer = getConstInitializer(definition);
		if (initializer === undefined) continue;
		if (options.isStaticExpression(initializer)) return true;
	}

	return false;
}
