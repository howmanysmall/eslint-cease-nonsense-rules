import { PatternVisitor, ScopeType } from "@typescript-eslint/scope-manager";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES, ESLintUtils } from "@typescript-eslint/utils";
import { isIdentifierPart, isIdentifierStart, ScriptTarget } from "typescript";
import { createRule } from "../utilities/create-rule";
import type { Context, Selector, ValidatorFunction } from "./naming-convention-utils";
import { Modifiers, parseOptions, SCHEMA } from "./naming-convention-utils";

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
function isUnused(name: string, initialScope: TSESLint.Scope.Scope | undefined): boolean {
	let scope = initialScope;
	while (scope) {
		const variable = scope.set.get(name);
		if (variable) {
			return variable.references.length === 0;
		}
		scope = scope.upper ?? undefined;
	}
	return false;
}

function isAsyncVariableIdentifier(identifier: TSESTree.Identifier): boolean {
	return Boolean(
		("async" in identifier.parent && identifier.parent.async) ||
		("init" in identifier.parent &&
			identifier.parent.init &&
			"async" in identifier.parent.init &&
			identifier.parent.init.async),
	);
}

function isGlobal(scope: TSESLint.Scope.Scope | undefined): boolean {
	if (!scope) {
		return false;
	}
	return scope.type === ScopeType.global || scope.type === ScopeType.module;
}

export default createRule<Options, MessageIds>({
	create(contextWithoutDefaults) {
		if (contextWithoutDefaults.filename.endsWith(".d.ts")) {
			return {};
		}

		const context =
			contextWithoutDefaults.options.length > 0
				? contextWithoutDefaults
				: (Object.setPrototypeOf(
						{
							options: defaultCamelCaseAllTheThingsConfig,
						},
						contextWithoutDefaults,
					) as Context);

		const validators = parseOptions(context);
		const parserServices = ESLintUtils.getParserServices(context, true);
		const compilerOptions = parserServices.program?.getCompilerOptions() ?? {};

		function handleMember(
			validator: ValidatorFunction,
			node:
				| TSESTree.AccessorProperty
				| TSESTree.MethodDefinition
				| TSESTree.PropertyDefinition
				| TSESTree.Property
				| TSESTree.TSAbstractMethodDefinition
				| TSESTree.TSAbstractPropertyDefinition
				| TSESTree.TSMethodSignature
				| TSESTree.TSPropertySignature,
			modifiers: Set<Modifiers>,
		): void {
			if (node.computed) {
				return;
			}
			const { key } = node;
			if (
				key.type !== AST_NODE_TYPES.Identifier &&
				key.type !== AST_NODE_TYPES.Literal &&
				key.type !== AST_NODE_TYPES.PrivateIdentifier
			) {
				return;
			}
			if (requiresQuoting(key, compilerOptions.target)) modifiers.add(Modifiers.requiresQuotes);

			validator(key, modifiers);
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

		function isDestructured(identifier: TSESTree.Identifier): boolean {
			return (
				(identifier.parent.type === AST_NODE_TYPES.Property && identifier.parent.shorthand) ||
				(identifier.parent.type === AST_NODE_TYPES.AssignmentPattern &&
					identifier.parent.parent.type === AST_NODE_TYPES.Property &&
					identifier.parent.parent.shorthand)
			);
		}

		function isExported(
			node: TSESTree.Node | undefined,
			name: string,
			scope: TSESLint.Scope.Scope | undefined,
		): boolean {
			if (
				node?.parent?.type === AST_NODE_TYPES.ExportDefaultDeclaration ||
				node?.parent?.type === AST_NODE_TYPES.ExportNamedDeclaration
			) {
				return true;
			}

			if (!scope) {
				return false;
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

		type SelectorHandler = {
			bivarianceHack(node: TSESTree.Node, validator: ValidatorFunction): void;
		}["bivarianceHack"];

		const selectors: Record<
			string,
			{
				handler: SelectorHandler;
				validator: ValidatorFunction | undefined;
			}
		> = {
			":matches(PropertyDefinition, TSAbstractPropertyDefinition)[computed = false][value.type != 'ArrowFunctionExpression'][value.type != 'FunctionExpression'][value.type != 'TSEmptyBodyFunctionExpression']":
				{
					handler: (node: TSESTree.Node, validator): void => {
						if (
							node.type !== AST_NODE_TYPES.PropertyDefinition &&
							node.type !== AST_NODE_TYPES.TSAbstractPropertyDefinition
						) {
							return;
						}
						if (node.computed) {
							return;
						}
						const modifiers = getMemberModifiers(node);
						handleMember(validator, node, modifiers);
					},
					validator: validators.objectLiteralProperty,
				},
			"ClassDeclaration, ClassExpression": {
				handler: (node: TSESTree.ClassDeclaration | TSESTree.ClassExpression, validator): void => {
					const classId = node.id;
					if (!classId) {
						return;
					}

					const modifiers = new Set<Modifiers>();
					const scope = context.sourceCode.getScope(node).upper ?? undefined;

					if (node.abstract) {
						modifiers.add(Modifiers.abstract);
					}

					if (isExported(node, classId.name, scope)) {
						modifiers.add(Modifiers.exported);
					}

					if (isUnused(classId.name, scope)) {
						modifiers.add(Modifiers.unused);
					}

					validator(classId, modifiers);
				},
				validator: validators.class,
			},
			"FunctionDeclaration, TSDeclareFunction, FunctionExpression": {
				handler: (node: TSESTree.Node, validator): void => {
					if (
						node.type !== AST_NODE_TYPES.FunctionDeclaration &&
						node.type !== AST_NODE_TYPES.FunctionExpression &&
						node.type !== AST_NODE_TYPES.TSDeclareFunction
					) {
						return;
					}
					if (!node.id) {
						return;
					}

					const modifiers = new Set<Modifiers>();
					const scope = context.sourceCode.getScope(node).upper ?? undefined;

					if (isGlobal(scope)) {
						modifiers.add(Modifiers.global);
					}

					if (isExported(node, node.id.name, scope)) {
						modifiers.add(Modifiers.exported);
					}

					if (isUnused(node.id.name, scope)) {
						modifiers.add(Modifiers.unused);
					}

					if (node.async) {
						modifiers.add(Modifiers.async);
					}

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
						for (const param of node.params) {
							if (param.type === AST_NODE_TYPES.TSParameterProperty) {
								continue;
							}

							const identifiers = getIdentifiersFromPattern(param);

							for (const identifier of identifiers) {
								const modifiers = new Set<Modifiers>();

								if (isDestructured(identifier)) {
									modifiers.add(Modifiers.destructured);
								}

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
				handler: (node: TSESTree.Node, validator): void => {
					if (
						node.type !== AST_NODE_TYPES.ImportDefaultSpecifier &&
						node.type !== AST_NODE_TYPES.ImportNamespaceSpecifier &&
						node.type !== AST_NODE_TYPES.ImportSpecifier
					) {
						return;
					}
					const modifiers = new Set<Modifiers>();

					switch (node.type) {
						case AST_NODE_TYPES.ImportDefaultSpecifier:
							modifiers.add(Modifiers.default);
							break;
						case AST_NODE_TYPES.ImportNamespaceSpecifier:
							modifiers.add(Modifiers.namespace);
							break;
						case AST_NODE_TYPES.ImportSpecifier:
							if (node.imported.type === AST_NODE_TYPES.Identifier && node.imported.name !== "default") {
								return;
							}
							modifiers.add(Modifiers.default);
							break;
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
			"Property[computed = false]:matches([kind = 'get'], [kind = 'set'])": {
				handler: (node: TSESTree.PropertyNonComputedName, validator): void => {
					const modifiers = new Set<Modifiers>([Modifiers.public]);
					handleMember(validator, node, modifiers);
				},
				validator: validators.classicAccessor,
			},
			TSEnumDeclaration: {
				handler: (node: TSESTree.TSEnumDeclaration, validator): void => {
					const modifiers = new Set<Modifiers>();
					const scope = context.sourceCode.getScope(node).upper ?? undefined;

					if (isExported(node, node.id.name, scope)) {
						modifiers.add(Modifiers.exported);
					}

					if (isUnused(node.id.name, scope)) {
						modifiers.add(Modifiers.unused);
					}

					validator(node.id, modifiers);
				},
				validator: validators.enum,
			},
			TSEnumMember: {
				handler: (node: TSESTree.TSEnumMember, validator): void => {
					const memberId = node.id;
					if (requiresQuoting(memberId, compilerOptions.target)) {
						return;
					}

					const modifiers = new Set<Modifiers>();
					validator(memberId, modifiers);
				},
				validator: validators.enumMember,
			},
			TSInterfaceDeclaration: {
				handler: (node: TSESTree.TSInterfaceDeclaration, validator): void => {
					const modifiers = new Set<Modifiers>();
					const scope = context.sourceCode.getScope(node);

					if (isExported(node, node.id.name, scope)) {
						modifiers.add(Modifiers.exported);
					}

					if (isUnused(node.id.name, scope)) {
						modifiers.add(Modifiers.unused);
					}

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

					for (const identifier of identifiers) {
						validator(identifier, modifiers);
					}
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

					if (isExported(node, node.id.name, scope)) {
						modifiers.add(Modifiers.exported);
					}

					if (isUnused(node.id.name, scope)) {
						modifiers.add(Modifiers.unused);
					}

					validator(node.id, modifiers);
				},
				validator: validators.typeAlias,
			},
			"TSTypeParameterDeclaration > TSTypeParameter": {
				handler: (node: TSESTree.TSTypeParameter, validator): void => {
					const modifiers = new Set<Modifiers>();
					const scope = context.sourceCode.getScope(node);

					if (isUnused(node.name.name, scope)) {
						modifiers.add(Modifiers.unused);
					}

					validator(node.name, modifiers);
				},
				validator: validators.typeParameter,
			},
			VariableDeclarator: {
				handler: (node: TSESTree.Node, validator): void => {
					if (node.type !== AST_NODE_TYPES.VariableDeclarator) {
						return;
					}
					const identifiers = getIdentifiersFromPattern(node.id);

					const baseModifiers = new Set<Modifiers>();
					const { parent } = node;
					if (parent.type === AST_NODE_TYPES.VariableDeclaration && parent.kind === "const") {
						baseModifiers.add(Modifiers.const);
					}

					if (isGlobal(context.sourceCode.getScope(node))) {
						baseModifiers.add(Modifiers.global);
					}

					for (const identifier of identifiers) {
						const modifiers = new Set(baseModifiers);

						if (isDestructured(identifier)) {
							modifiers.add(Modifiers.destructured);
						}

						const scope = context.sourceCode.getScope(identifier);
						if (isExported(parent, identifier.name, scope)) {
							modifiers.add(Modifiers.exported);
						}

						if (isUnused(identifier.name, scope)) {
							modifiers.add(Modifiers.unused);
						}

						if (isAsyncVariableIdentifier(identifier)) {
							modifiers.add(Modifiers.async);
						}

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
					if (!validator) {
						return;
					}
					handler(node, validator);
				},
			]),
		);
	},
	defaultOptions: defaultCamelCaseAllTheThingsConfig,
	meta: {
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

function getIdentifiersFromPattern(pattern: TSESTree.DestructuringPattern): Array<TSESTree.Identifier> {
	const identifiers: Array<TSESTree.Identifier> = [];
	const visitor = new PatternVisitor({}, pattern, (identifier) => identifiers.push(identifier));
	visitor.visit(pattern);
	return identifiers;
}

function isValidIdentifierText(name: string, languageVersion: ScriptTarget): boolean {
	if (name.length === 0) {
		return false;
	}
	let index = 0;
	const firstCodePoint = name.codePointAt(index);
	if (firstCodePoint === undefined || !isIdentifierStart(firstCodePoint, languageVersion)) {
		return false;
	}
	index += firstCodePoint > 0xff_ff ? 2 : 1;
	while (index < name.length) {
		const codePoint = name.codePointAt(index);
		if (codePoint === undefined || !isIdentifierPart(codePoint, languageVersion)) {
			return false;
		}
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
