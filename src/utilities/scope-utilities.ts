import { DefinitionType, ScopeType } from "@typescript-eslint/scope-manager";

import type { TSESLint } from "@typescript-eslint/utils";

type ClassNameDefinition = TSESLint.Scope.Definition & {
	readonly type: DefinitionType.ClassName;
};

type FunctionNameDefinition = TSESLint.Scope.Definition & {
	readonly type: DefinitionType.FunctionName;
};

type ImportBindingDefinition = TSESLint.Scope.Definition & {
	readonly type: DefinitionType.ImportBinding;
};

type ParameterDefinition = TSESLint.Scope.Definition & {
	readonly type: DefinitionType.Parameter;
};

type VariableDefinition = TSESLint.Scope.Definition & {
	readonly type: DefinitionType.Variable;
};

export function isModuleOrGlobalScope(scope: TSESLint.Scope.Scope): boolean {
	return scope.type === ScopeType.module || scope.type === ScopeType.global;
}

export function isClassScope(scope: TSESLint.Scope.Scope): boolean {
	return scope.type === ScopeType.class;
}

export function isFunctionScope(scope: TSESLint.Scope.Scope): boolean {
	return scope.type === ScopeType.function;
}

export function isGlobalScope(scope: TSESLint.Scope.Scope): boolean {
	return scope.type === ScopeType.global;
}

export function isModuleScope(scope: TSESLint.Scope.Scope): boolean {
	return scope.type === ScopeType.module;
}

export function isClassNameDefinition(definition: TSESLint.Scope.Definition): definition is ClassNameDefinition {
	return definition.type === DefinitionType.ClassName;
}

export function isFunctionNameDefinition(definition: TSESLint.Scope.Definition): definition is FunctionNameDefinition {
	return definition.type === DefinitionType.FunctionName;
}

export function isImportBindingDefinition(
	definition: TSESLint.Scope.Definition,
): definition is ImportBindingDefinition {
	return definition.type === DefinitionType.ImportBinding;
}

export function isParameterDefinition(definition: TSESLint.Scope.Definition): definition is ParameterDefinition {
	return definition.type === DefinitionType.Parameter;
}

export function isVariableDefinition(definition: TSESLint.Scope.Definition): definition is VariableDefinition {
	return definition.type === DefinitionType.Variable;
}
