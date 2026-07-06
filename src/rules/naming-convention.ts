import { createRule } from "$utilities/create-rule";
import { getDefinedValue } from "$utilities/defined-utilities";
import { Modifiers } from "$utilities/naming-convention-utilities/enums";
import { parseOptions } from "$utilities/naming-convention-utilities/parse-options";
import { SCHEMA } from "$utilities/naming-convention-utilities/schema";
import { PatternVisitor, ScopeType } from "@typescript-eslint/scope-manager";
import { AST_NODE_TYPES, ESLintUtils } from "@typescript-eslint/utils";
import { isIdentifierPart, isIdentifierStart, ScriptTarget } from "typescript";

import type { Selector, ValidatorFunction } from "$utilities/naming-convention-utilities/types";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

type ReportableMemberKey = TSESTree.Identifier | TSESTree.Literal | TSESTree.PrivateIdentifier;
interface NodeWithReportableMemberKey {
	readonly key: ReportableMemberKey;
}

export type MessageIds =
	| "doesNotMatchFormat"
	| "doesNotMatchFormatTrimmed"
	| "missingAffix"
	| "missingUnderscore"
	| "satisfyCustom"
	| "unexpectedUnderscore";

export type NamingConventionOptions = Selector;
export type Options = Array<NamingConventionOptions>;

const defaultCamelCaseAllTheThingsConfig: Options = [
	{
		format: ["camelCase"],
		leadingUnderscore: "allow",
		selector: "default",
		trailingUnderscore: "allow",
	},
	{
		format: ["camelCase", "PascalCase"],
		selector: "import",
	},
	{
		format: ["camelCase", "UPPER_CASE"],
		leadingUnderscore: "allow",
		selector: "variable",
		trailingUnderscore: "allow",
	},
	{
		format: ["PascalCase"],
		selector: "typeLike",
	},
];

// Helper functions moved to module scope to avoid recreating them on every call
function isUnused(name: string, initialScope: TSESLint.Scope.Scope): boolean {
	const scopes = new Array<TSESLint.Scope.Scope>();
	for (let scope: TSESLint.Scope.Scope | null = initialScope; scope !== null; scope = scope.upper) scopes.push(scope);
	return scopes.some((scope) => scope.set.get(name)?.references.length === 0);
}

function isAsyncInit(identifier: TSESTree.Identifier): boolean {
	return (
		"init" in identifier.parent &&
		identifier.parent.init !== null &&
		"async" in identifier.parent.init &&
		identifier.parent.init.async
	);
}

function isAsyncVariableIdentifier(identifier: TSESTree.Identifier): boolean {
	return isAsyncInit(identifier);
}
function isDestructured(identifier: TSESTree.Identifier): boolean {
	return (
		(identifier.parent.type === AST_NODE_TYPES.Property && identifier.parent.shorthand) ||
		(identifier.parent.type === AST_NODE_TYPES.AssignmentPattern &&
			identifier.parent.parent.type === AST_NODE_TYPES.Property &&
			identifier.parent.parent.shorthand)
	);
}

function addModifierIf(modifiers: Set<Modifiers>, condition: boolean, modifier: Modifiers): void {
	if (condition) modifiers.add(modifier);
}

function getMemberModifiers(
	node:
		| TSESTree.AccessorProperty
		| TSESTree.MethodDefinition
		| TSESTree.PropertyDefinition
		| TSESTree.TSAbstractAccessorProperty
		| TSESTree.TSAbstractMethodDefinition
		| TSESTree.TSAbstractPropertyDefinition
		| TSESTree.TSParameterProperty,
): Set<Modifiers> {
	const modifiers = new Set<Modifiers>();
	if ("key" in node && node.key.type === AST_NODE_TYPES.PrivateIdentifier) {
		modifiers.add(Modifiers["#private"]);
	} else if (node.accessibility) modifiers.add(Modifiers[node.accessibility]);
	else modifiers.add(Modifiers.public);

	if (node.static) modifiers.add(Modifiers.static);
	if ("readonly" in node && node.readonly) modifiers.add(Modifiers.readonly);
	if ("override" in node && node.override) modifiers.add(Modifiers.override);

	if (
		node.type === AST_NODE_TYPES.TSAbstractPropertyDefinition ||
		node.type === AST_NODE_TYPES.TSAbstractMethodDefinition ||
		node.type === AST_NODE_TYPES.TSAbstractAccessorProperty
	) {
		modifiers.add(Modifiers.abstract);
	}

	return modifiers;
}

function isExported(node: TSESTree.Node, name: string, scope: TSESLint.Scope.Scope): boolean {
	if (
		node?.parent?.type === AST_NODE_TYPES.ExportDefaultDeclaration ||
		node?.parent?.type === AST_NODE_TYPES.ExportNamedDeclaration
	) {
		return true;
	}

	const variable = scope.set.get(name);
	if (variable) {
		for (const reference of variable.references) {
			const referenceParent = reference.identifier.parent;
			if (
				referenceParent.type === AST_NODE_TYPES.ExportDefaultDeclaration ||
				referenceParent.type === AST_NODE_TYPES.ExportSpecifier
			) {
				return true;
			}
		}
	}

	return false;
}

function isGlobal(scope: TSESLint.Scope.Scope): boolean {
	return scope.type === ScopeType.global || scope.type === ScopeType.module;
}

const namingConventions = createRule<Options, MessageIds>({
	create(contextWithoutDefaults) {
		if (contextWithoutDefaults.filename.endsWith(".d.ts")) return {};

		const options =
			contextWithoutDefaults.options.length > 0
				? contextWithoutDefaults.options
				: defaultCamelCaseAllTheThingsConfig;
		const context = contextWithoutDefaults;

		const validators = parseOptions(contextWithoutDefaults, options);
		const parserServices = ESLintUtils.getParserServices(contextWithoutDefaults, true);
		const compilerOptions = parserServices.program?.getCompilerOptions() ?? {};

		function handleMember(
			validator: ValidatorFunction,
			node:
				| TSESTree.AccessorPropertyNonComputedName
				| TSESTree.MethodDefinitionNonComputedName
				| TSESTree.PropertyDefinitionNonComputedName
				| TSESTree.PropertyNonComputedName
				| TSESTree.TSMethodSignatureNonComputedName
				| TSESTree.TSPropertySignatureNonComputedName
				| NodeWithReportableMemberKey,
			modifiers: Set<Modifiers>,
		): void {
			const { key } = node;
			if (requiresQuoting(key, compilerOptions.target)) modifiers.add(Modifiers.requiresQuotes);

			validator(key, modifiers);
		}

		function isExportedCached(
			node: TSESTree.Node | undefined,
			name: string,
			scope: TSESLint.Scope.Scope | null | undefined,
		): boolean {
			return node !== undefined && scope !== undefined && scope !== null && isExported(node, name, scope);
		}

		type SelectorHandler = {
			// oxlint-disable-next-line typescript/method-signature-style -- naur
			bivarianceHack(node: TSESTree.Node, validator: ValidatorFunction): void;
		}["bivarianceHack"];

		const selectors: Record<
			string,
			{
				handler: SelectorHandler;
				validator: ValidatorFunction | undefined;
			}
		> = {
			":matches(PropertyDefinition, TSAbstractPropertyDefinition)[computed = false]:matches([value.type = 'ArrowFunctionExpression'], [value.type = 'FunctionExpression'], [value.type = 'TSEmptyBodyFunctionExpression'])":
				{
					handler: (
						node:
							| TSESTree.PropertyDefinitionNonComputedName
							| (TSESTree.TSAbstractPropertyDefinition & NodeWithReportableMemberKey),
						validator,
					): void => {
						const modifiers = getMemberModifiers(node);
						handleMember(validator, node, modifiers);
					},
					validator: validators.classMethod,
				},
			":matches(PropertyDefinition, TSAbstractPropertyDefinition)[computed = false][value.type != 'ArrowFunctionExpression'][value.type != 'FunctionExpression'][value.type != 'TSEmptyBodyFunctionExpression']":
				{
					handler: (
						node:
							| TSESTree.PropertyDefinitionNonComputedName
							| (TSESTree.TSAbstractPropertyDefinition & NodeWithReportableMemberKey),
						validator,
					): void => {
						const modifiers = getMemberModifiers(node);
						handleMember(validator, node, modifiers);
					},
					validator: validators.classProperty,
				},
			"AccessorProperty[computed = false], TSAbstractAccessorProperty[computed = false]": {
				handler: (
					node:
						| TSESTree.AccessorPropertyNonComputedName
						| (TSESTree.TSAbstractAccessorProperty & NodeWithReportableMemberKey),
					validator,
				): void => {
					const modifiers = getMemberModifiers(node);
					handleMember(validator, node, modifiers);
				},
				validator: validators.autoAccessor,
			},
			"ClassDeclaration, ClassExpression": {
				handler: (node: TSESTree.ClassDeclaration | TSESTree.ClassExpression, validator): void => {
					const classId = node.id;
					if (!classId) return;

					const modifiers = new Set<Modifiers>();
					const scope = context.sourceCode.getScope(node).upper;

					if (node.abstract) modifiers.add(Modifiers.abstract);
					if (isExportedCached(node, classId.name, scope)) modifiers.add(Modifiers.exported);
					if (scope && isUnused(classId.name, scope)) modifiers.add(Modifiers.unused);

					validator(classId, modifiers);
				},
				validator: validators.class,
			},
			"FunctionDeclaration, TSDeclareFunction, FunctionExpression": {
				handler: (
					node: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.TSDeclareFunction,
					validator,
				): void => {
					if (!node.id) return;

					const modifiers = new Set<Modifiers>();
					const scope = context.sourceCode.getScope(node).upper;

					if (scope && isGlobal(scope)) modifiers.add(Modifiers.global);
					if (isExportedCached(node, node.id.name, scope)) modifiers.add(Modifiers.exported);
					if (scope && isUnused(node.id.name, scope)) modifiers.add(Modifiers.unused);
					if (node.async) modifiers.add(Modifiers.async);

					validator(node.id, modifiers);
				},
				validator: validators.function,
			},
			"FunctionDeclaration, TSDeclareFunction, TSEmptyBodyFunctionExpression, FunctionExpression, ArrowFunctionExpression":
				{
					handler: (
						node:
							| TSESTree.ArrowFunctionExpression
							| TSESTree.FunctionDeclaration
							| TSESTree.FunctionExpression
							| TSESTree.TSDeclareFunction
							| TSESTree.TSEmptyBodyFunctionExpression,
						validator,
					): void => {
						for (const parameter of node.params) {
							if (parameter.type === AST_NODE_TYPES.TSParameterProperty) continue;

							const identifiers = getIdentifiersFromPattern(parameter);

							for (const identifier of identifiers) {
								const modifiers = new Set<Modifiers>();

								if (isDestructured(identifier)) modifiers.add(Modifiers.destructured);
								if (isUnused(identifier.name, context.sourceCode.getScope(identifier))) {
									modifiers.add(Modifiers.unused);
								}

								validator(identifier, modifiers);
							}
						}
					},
					validator: validators.parameter,
				},
			"ImportDefaultSpecifier, ImportNamespaceSpecifier, ImportSpecifier": {
				handler: (
					node:
						| TSESTree.ImportDefaultSpecifier
						| TSESTree.ImportNamespaceSpecifier
						| TSESTree.ImportSpecifier,
					validator,
				): void => {
					const modifiers = new Set<Modifiers>();

					switch (node.type) {
						case AST_NODE_TYPES.ImportDefaultSpecifier: {
							modifiers.add(Modifiers.default);
							break;
						}

						case AST_NODE_TYPES.ImportNamespaceSpecifier: {
							modifiers.add(Modifiers.namespace);
							break;
						}

						case AST_NODE_TYPES.ImportSpecifier: {
							if (node.imported.type === AST_NODE_TYPES.Identifier && node.imported.name !== "default") {
								return;
							}
							modifiers.add(Modifiers.default);
							break;
						}
					}

					validator(node.local, modifiers);
				},
				validator: validators.import,
			},
			"MethodDefinition[computed = false]:matches([kind = 'get'], [kind = 'set']), TSAbstractMethodDefinition[computed = false]:matches([kind='get'], [kind='set'])":
				{
					handler: (node: TSESTree.MethodDefinitionNonComputedName, validator): void => {
						const modifiers = getMemberModifiers(node);
						handleMember(validator, node, modifiers);
					},
					validator: validators.classicAccessor,
				},
			"MethodDefinition[computed = false][kind = 'method'], TSAbstractMethodDefinition[computed = false][kind = 'method']":
				{
					handler: (
						node:
							| TSESTree.MethodDefinitionNonComputedName
							| (TSESTree.TSAbstractMethodDefinition & NodeWithReportableMemberKey),
						validator,
					): void => {
						const modifiers = getMemberModifiers(node);
						handleMember(validator, node, modifiers);
					},
					validator: validators.classMethod,
				},
			"Property[computed = false]:matches([kind = 'get'], [kind = 'set'])": {
				handler: (node: TSESTree.PropertyNonComputedName, validator): void => {
					const modifiers = new Set<Modifiers>([Modifiers.public]);
					handleMember(validator, node, modifiers);
				},
				validator: validators.classicAccessor,
			},
			"Property[computed = false][kind = 'init'][method = false][value.type != 'FunctionExpression'][value.type != 'ArrowFunctionExpression']":
				{
					handler: (node: TSESTree.PropertyNonComputedName, validator): void => {
						const modifiers = new Set<Modifiers>([Modifiers.public]);
						handleMember(validator, node, modifiers);
					},
					validator: validators.objectLiteralProperty,
				},
			"Property[computed = false][kind = 'init'][method = true], Property[computed = false][kind = 'init'][value.type = 'FunctionExpression'], Property[computed = false][kind = 'init'][value.type = 'ArrowFunctionExpression']":
				{
					handler: (node: TSESTree.PropertyNonComputedName, validator): void => {
						const modifiers = new Set<Modifiers>([Modifiers.public]);
						handleMember(validator, node, modifiers);
					},
					validator: validators.objectLiteralMethod,
				},
			TSEnumDeclaration: {
				handler: (node: TSESTree.TSEnumDeclaration, validator): void => {
					const modifiers = new Set<Modifiers>();
					const scope = context.sourceCode.getScope(node).upper;

					if (isExportedCached(node, node.id.name, scope)) modifiers.add(Modifiers.exported);
					if (scope && isUnused(node.id.name, scope)) modifiers.add(Modifiers.unused);

					validator(node.id, modifiers);
				},
				validator: validators.enum,
			},
			TSEnumMember: {
				handler: (node: TSESTree.TSEnumMember, validator): void => {
					const memberId = node.id;
					if (requiresQuoting(memberId, compilerOptions.target)) return;

					const modifiers = new Set<Modifiers>();
					validator(memberId, modifiers);
				},
				validator: validators.enumMember,
			},
			TSInterfaceDeclaration: {
				handler: (node: TSESTree.TSInterfaceDeclaration, validator): void => {
					const modifiers = new Set<Modifiers>();
					const scope = context.sourceCode.getScope(node);

					if (isExportedCached(node, node.id.name, scope)) modifiers.add(Modifiers.exported);
					if (isUnused(node.id.name, scope)) modifiers.add(Modifiers.unused);

					validator(node.id, modifiers);
				},
				validator: validators.interface,
			},
			"TSMethodSignature[computed = false], TSPropertySignature[computed = false][typeAnnotation.typeAnnotation.type = 'TSFunctionType']":
				{
					handler: (
						node: TSESTree.TSMethodSignatureNonComputedName | TSESTree.TSPropertySignatureNonComputedName,
						validator,
					): void => {
						const modifiers = new Set<Modifiers>([Modifiers.public]);
						handleMember(validator, node, modifiers);
					},
					validator: validators.typeMethod,
				},
			TSParameterProperty: {
				handler: (node: TSESTree.TSParameterProperty, validator): void => {
					const modifiers = getMemberModifiers(node);
					const identifiers = getIdentifiersFromPattern(node.parameter);

					for (const identifier of identifiers) validator(identifier, modifiers);
				},
				validator: validators.parameterProperty,
			},
			"TSPropertySignature[computed = false][typeAnnotation.typeAnnotation.type != 'TSFunctionType']": {
				handler: (node: TSESTree.TSPropertySignatureNonComputedName, validator): void => {
					const modifiers = new Set<Modifiers>([Modifiers.public]);
					if (node.readonly) {
						modifiers.add(Modifiers.readonly);
					}
					handleMember(validator, node, modifiers);
				},
				validator: validators.typeProperty,
			},
			TSTypeAliasDeclaration: {
				handler: (node: TSESTree.TSTypeAliasDeclaration, validator): void => {
					const modifiers = new Set<Modifiers>();
					const scope = context.sourceCode.getScope(node);

					if (isExportedCached(node, node.id.name, scope)) modifiers.add(Modifiers.exported);
					if (isUnused(node.id.name, scope)) modifiers.add(Modifiers.unused);

					validator(node.id, modifiers);
				},
				validator: validators.typeAlias,
			},
			"TSTypeParameterDeclaration > TSTypeParameter": {
				handler: (node: TSESTree.TSTypeParameter, validator): void => {
					const modifiers = new Set<Modifiers>();
					const scope = context.sourceCode.getScope(node);

					if (isUnused(node.name.name, scope)) modifiers.add(Modifiers.unused);

					validator(node.name, modifiers);
				},
				validator: validators.typeParameter,
			},
			VariableDeclarator: {
				handler: (node: TSESTree.VariableDeclarator, validator): void => {
					const identifiers = getIdentifiersFromPattern(node.id);

					const baseModifiers = new Set<Modifiers>();
					const { parent } = node;
					if (parent.type === AST_NODE_TYPES.VariableDeclaration && parent.kind === "const") {
						baseModifiers.add(Modifiers.const);
					}

					if (isGlobal(context.sourceCode.getScope(node))) baseModifiers.add(Modifiers.global);

					for (const identifier of identifiers) {
						const modifiers = new Set(baseModifiers);

						if (isDestructured(identifier)) modifiers.add(Modifiers.destructured);

						const scope = context.sourceCode.getScope(identifier);
						addModifierIf(modifiers, isExportedCached(parent, identifier.name, scope), Modifiers.exported);
						addModifierIf(modifiers, isUnused(identifier.name, scope), Modifiers.unused);
						addModifierIf(modifiers, isAsyncVariableIdentifier(identifier), Modifiers.async);

						validator(identifier, modifiers);
					}
				},
				validator: validators.variable,
			},
		};

		return Object.fromEntries(
			Object.entries(selectors).map(([selector, { handler, validator }]) => [
				selector,
				(node: TSESTree.Node): void => {
					handler(node, getDefinedValue(validator));
				},
			]),
		);
	},
	meta: {
		defaultOptions: [],
		docs: {
			description: "Enforce naming conventions for everything across a codebase",
		},
		messages: {
			doesNotMatchFormat: "{{type}} name `{{name}}` must match one of the following formats: {{formats}}",
			doesNotMatchFormatTrimmed:
				"{{type}} name `{{name}}` trimmed as `{{processedName}}` must match one of the following formats: {{formats}}",
			missingAffix: "{{type}} name `{{name}}` must have one of the following {{position}}es: {{affixes}}",
			missingUnderscore: "{{type}} name `{{name}}` must have {{count}} {{position}} underscore(s).",
			satisfyCustom: "{{type}} name `{{name}}` must {{regexMatch}} the RegExp: {{regex}}",
			unexpectedUnderscore: "{{type}} name `{{name}}` must not have a {{position}} underscore.",
		},
		schema: SCHEMA,
		type: "suggestion",
	},
	name: "naming-convention",
});

export default namingConventions;

function getIdentifiersFromPattern(pattern: TSESTree.DestructuringPattern): Array<TSESTree.Identifier> {
	const identifiers = new Array<TSESTree.Identifier>();
	const visitor = new PatternVisitor({}, pattern, (identifier) => {
		identifiers.push(identifier);
	});
	visitor.visit(pattern);
	return identifiers;
}

function isValidIdentifierText(name: string, languageVersion: ScriptTarget): boolean {
	if (name.length === 0) return false;

	let index = 0;
	const firstCodePoint = name.codePointAt(index);
	if (firstCodePoint === undefined || !isIdentifierStart(firstCodePoint, languageVersion)) return false;

	index += firstCodePoint > 0xff_ff ? 2 : 1;
	while (index < name.length) {
		const codePoint = name.codePointAt(index);
		if (codePoint === undefined || !isIdentifierPart(codePoint, languageVersion)) return false;
		index += codePoint > 0xff_ff ? 2 : 1;
	}
	return true;
}

function requiresQuoting(
	node: TSESTree.Identifier | TSESTree.Literal | TSESTree.PrivateIdentifier,
	target: ScriptTarget | undefined,
): boolean {
	const name =
		node.type === AST_NODE_TYPES.Identifier || node.type === AST_NODE_TYPES.PrivateIdentifier
			? node.name
			: `${node.value}`;
	const languageVersion = target ?? ScriptTarget.Latest;
	return !isValidIdentifierText(name, languageVersion);
}
