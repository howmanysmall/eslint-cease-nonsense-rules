import { AST_NODE_TYPES, ESLintUtils } from "@typescript-eslint/utils";
import { createRule } from "@utilities/create-rule";
import { isLikelyReactComponentName } from "@utilities/react-component-utilities";
import {
	isExpressionWithTypeArguments,
	isInterfaceDeclaration,
	isIntersectionTypeNode,
	isTypeAliasDeclaration,
	isTypeLiteralNode,
	isTypeReferenceNode,
	isFunctionLike as isTypeScriptFunctionLike,
	isIdentifier as isTypeScriptIdentifier,
	isPropertySignature as isTypeScriptPropertySignature,
	isStringLiteral as isTypeScriptStringLiteral,
	isTypeNode as isTypeScriptTypeNode,
	SymbolFlags,
} from "typescript";

import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import type { Declaration, Symbol as TSSymbol, TypeNode as TsTypeNode, TypeChecker } from "typescript";

type MessageIds = "manualChildrenProperty";
type RuleMode = "accurate" | "auto" | "fast";

export interface NoManualChildrenPropertyOptions {
	readonly mode?: RuleMode;
	readonly wrapperNames?: ReadonlyArray<string>;
}

type Options = [NoManualChildrenPropertyOptions?];

interface InspectionResult {
	readonly hasChildren: boolean;
	readonly hasManualChildren: boolean;
	readonly usesApprovedWrapper: boolean;
}

interface ComponentCandidate {
	readonly functionNode:
		| TSESTree.ArrowFunctionExpression
		| TSESTree.FunctionDeclaration
		| TSESTree.FunctionExpression;
	readonly name: string;
	readonly propertiesTypeNode: TSESTree.TypeNode;
	readonly reportNode: TSESTree.Node;
}

const DEFAULT_OPTIONS: Required<NoManualChildrenPropertyOptions> = {
	mode: "auto",
	wrapperNames: ["PropertiesWithChildren"],
};

const CHILDREN_PROPERTY_NAMES = new Set(["children"]);
const KNOWN_CHILDREN_WRAPPER_NAMES = new Set(["PropertiesWithChildren", "PropsWithChildren"]);

function isIdentifierNamed(node: TSESTree.PropertyName, expectedName: string): boolean {
	if (node.type === AST_NODE_TYPES.Identifier) return node.name === expectedName;
	if (node.type === AST_NODE_TYPES.Literal) return node.value === expectedName;
	return false;
}

function getParameterTypeAnnotation(parameter: TSESTree.Node | undefined): TSESTree.TypeNode | undefined {
	if (!parameter) return undefined;
	if (parameter.type === AST_NODE_TYPES.Identifier) return parameter.typeAnnotation?.typeAnnotation;
	if (parameter.type === AST_NODE_TYPES.AssignmentPattern) return getParameterTypeAnnotation(parameter.left);
	if (parameter.type === AST_NODE_TYPES.RestElement) return getParameterTypeAnnotation(parameter.argument);
	if (parameter.type === AST_NODE_TYPES.TSParameterProperty) return getParameterTypeAnnotation(parameter.parameter);
	return undefined;
}

function getFunctionCandidate(
	name: string,
	node: TSESTree.ArrowFunctionExpression | TSESTree.FunctionDeclaration | TSESTree.FunctionExpression,
): ComponentCandidate | undefined {
	if (!isLikelyReactComponentName(name)) return undefined;

	const [firstParameter] = node.params;
	if (!firstParameter) return undefined;

	const propertiesTypeNode = getParameterTypeAnnotation(firstParameter);
	if (!propertiesTypeNode) return undefined;

	return {
		functionNode: node,
		name,
		propertiesTypeNode,
		reportNode: firstParameter,
	};
}

function mergeInspectionResults(results: ReadonlyArray<InspectionResult>): InspectionResult {
	let hasChildren = false;
	let hasManualChildren = false;
	let usesApprovedWrapper = false;
	for (const result of results) {
		hasChildren ||= result.hasChildren;
		hasManualChildren ||= result.hasManualChildren;
		usesApprovedWrapper ||= result.usesApprovedWrapper;
	}

	return {
		hasChildren,
		hasManualChildren,
		usesApprovedWrapper,
	};
}

function getTypeReferenceName(typeName: TSESTree.EntityName): string | undefined {
	if (typeName.type === AST_NODE_TYPES.Identifier) return typeName.name;
	if (typeName.type !== AST_NODE_TYPES.TSQualifiedName) return undefined;
	return typeName.right.name;
}

function getExpressionReferenceName(expression: TSESTree.Expression): string | undefined {
	if (expression.type === AST_NODE_TYPES.Identifier) return expression.name;
	if (expression.type === AST_NODE_TYPES.MemberExpression && expression.property.type === AST_NODE_TYPES.Identifier) {
		return expression.property.name;
	}

	return undefined;
}

function inspectTypeLiteral(typeLiteral: TSESTree.TSTypeLiteral): InspectionResult {
	return inspectTypeMembers(typeLiteral.members);
}

function inspectTypeMembers(members: ReadonlyArray<TSESTree.TypeElement>): InspectionResult {
	for (const member of members) {
		if (member.type !== AST_NODE_TYPES.TSPropertySignature || member.computed) continue;
		if (isIdentifierNamed(member.key, "children")) {
			return {
				hasChildren: true,
				hasManualChildren: true,
				usesApprovedWrapper: false,
			};
		}
	}

	return {
		hasChildren: false,
		hasManualChildren: false,
		usesApprovedWrapper: false,
	};
}

function inspectTypeNodeFast(
	typeNode: TSESTree.Node,
	wrapperNames: ReadonlySet<string>,
	interfaceDeclarations: ReadonlyMap<string, TSESTree.TSInterfaceDeclaration>,
	typeAliasDeclarations: ReadonlyMap<string, TSESTree.TSTypeAliasDeclaration>,
	visitedNames = new Set<string>(),
): InspectionResult {
	if (typeNode.type === AST_NODE_TYPES.TSTypeLiteral) return inspectTypeLiteral(typeNode);

	if (typeNode.type === AST_NODE_TYPES.TSIntersectionType) {
		return mergeInspectionResults(
			typeNode.types.map((memberType: TSESTree.TypeNode) =>
				inspectTypeNodeFast(
					memberType,
					wrapperNames,
					interfaceDeclarations,
					typeAliasDeclarations,
					visitedNames,
				),
			),
		);
	}

	if (typeNode.type === AST_NODE_TYPES.TSTypeReference) {
		const referenceName = getTypeReferenceName(typeNode.typeName);
		if (!referenceName) {
			return {
				hasChildren: false,
				hasManualChildren: false,
				usesApprovedWrapper: false,
			};
		}

		if (wrapperNames.has(referenceName)) {
			return {
				hasChildren: true,
				hasManualChildren: false,
				usesApprovedWrapper: true,
			};
		}

		if (KNOWN_CHILDREN_WRAPPER_NAMES.has(referenceName)) {
			return {
				hasChildren: true,
				hasManualChildren: false,
				usesApprovedWrapper: false,
			};
		}

		if (visitedNames.has(referenceName)) {
			return {
				hasChildren: false,
				hasManualChildren: false,
				usesApprovedWrapper: false,
			};
		}

		const nextVisitedNames = new Set([...visitedNames, referenceName]);

		const interfaceDeclaration = interfaceDeclarations.get(referenceName);
		if (interfaceDeclaration) {
			return inspectInterfaceDeclarationFast(
				interfaceDeclaration,
				wrapperNames,
				interfaceDeclarations,
				typeAliasDeclarations,
				nextVisitedNames,
			);
		}

		const typeAliasDeclaration = typeAliasDeclarations.get(referenceName);
		if (typeAliasDeclaration) {
			return inspectTypeNodeFast(
				typeAliasDeclaration.typeAnnotation,
				wrapperNames,
				interfaceDeclarations,
				typeAliasDeclarations,
				nextVisitedNames,
			);
		}

		return {
			hasChildren: false,
			hasManualChildren: false,
			usesApprovedWrapper: false,
		};
	}

	return {
		hasChildren: false,
		hasManualChildren: false,
		usesApprovedWrapper: false,
	};
}

function inspectHeritageClauseFast(
	heritageClause: TSESTree.TSInterfaceHeritage,
	wrapperNames: ReadonlySet<string>,
	interfaceDeclarations: ReadonlyMap<string, TSESTree.TSInterfaceDeclaration>,
	typeAliasDeclarations: ReadonlyMap<string, TSESTree.TSTypeAliasDeclaration>,
	visitedNames = new Set<string>(),
): InspectionResult {
	const referenceName = getExpressionReferenceName(heritageClause.expression);
	if (!referenceName) {
		return {
			hasChildren: false,
			hasManualChildren: false,
			usesApprovedWrapper: false,
		};
	}

	if (wrapperNames.has(referenceName)) {
		return {
			hasChildren: true,
			hasManualChildren: false,
			usesApprovedWrapper: true,
		};
	}

	if (KNOWN_CHILDREN_WRAPPER_NAMES.has(referenceName)) {
		return {
			hasChildren: true,
			hasManualChildren: false,
			usesApprovedWrapper: false,
		};
	}

	if (visitedNames.has(referenceName)) {
		return {
			hasChildren: false,
			hasManualChildren: false,
			usesApprovedWrapper: false,
		};
	}

	const nextVisitedNames = new Set([...visitedNames, referenceName]);

	const interfaceDeclaration = interfaceDeclarations.get(referenceName);
	if (interfaceDeclaration) {
		return inspectInterfaceDeclarationFast(
			interfaceDeclaration,
			wrapperNames,
			interfaceDeclarations,
			typeAliasDeclarations,
			nextVisitedNames,
		);
	}

	const typeAliasDeclaration = typeAliasDeclarations.get(referenceName);
	if (typeAliasDeclaration) {
		return inspectTypeNodeFast(
			typeAliasDeclaration.typeAnnotation,
			wrapperNames,
			interfaceDeclarations,
			typeAliasDeclarations,
			nextVisitedNames,
		);
	}

	return {
		hasChildren: false,
		hasManualChildren: false,
		usesApprovedWrapper: false,
	};
}

function inspectInterfaceDeclarationFast(
	interfaceDeclaration: TSESTree.TSInterfaceDeclaration,
	wrapperNames: ReadonlySet<string>,
	interfaceDeclarations: ReadonlyMap<string, TSESTree.TSInterfaceDeclaration>,
	typeAliasDeclarations: ReadonlyMap<string, TSESTree.TSTypeAliasDeclaration>,
	visitedNames = new Set<string>(),
): InspectionResult {
	const ownMembersResult = inspectTypeMembers(interfaceDeclaration.body.body);

	const heritageResults = interfaceDeclaration.extends.map((heritageClause) =>
		inspectHeritageClauseFast(
			heritageClause,
			wrapperNames,
			interfaceDeclarations,
			typeAliasDeclarations,
			visitedNames,
		),
	);

	return mergeInspectionResults([ownMembersResult, ...heritageResults]);
}

function resolveAliasedSymbol(symbol: TSSymbol, checker: TypeChecker): TSSymbol {
	if ((symbol.flags & SymbolFlags.Alias) === 0) return symbol;
	return checker.getAliasedSymbol(symbol);
}

function inspectTypeSymbolAccurate(
	symbol: TSSymbol,
	checker: TypeChecker,
	wrapperNames: ReadonlySet<string>,
	visitedSymbols = new Set<TSSymbol>(),
): InspectionResult {
	const resolvedSymbol = resolveAliasedSymbol(symbol, checker);
	if (visitedSymbols.has(resolvedSymbol)) {
		return {
			hasChildren: false,
			hasManualChildren: false,
			usesApprovedWrapper: false,
		};
	}

	const nextVisitedSymbols = new Set([...visitedSymbols, resolvedSymbol]);

	if (wrapperNames.has(resolvedSymbol.getName())) {
		return {
			hasChildren: true,
			hasManualChildren: false,
			usesApprovedWrapper: true,
		};
	}

	if (KNOWN_CHILDREN_WRAPPER_NAMES.has(resolvedSymbol.getName())) {
		return {
			hasChildren: true,
			hasManualChildren: false,
			usesApprovedWrapper: false,
		};
	}

	const inspectionResults: Array<InspectionResult> = [];
	for (const declaration of resolvedSymbol.getDeclarations() ?? []) {
		const declarationResult = inspectTsDeclarationAccurate(declaration, checker, wrapperNames, nextVisitedSymbols);
		inspectionResults.push(declarationResult);
	}

	return mergeInspectionResults(inspectionResults);
}

function inspectTsDeclarationAccurate(
	declaration: Declaration,
	checker: TypeChecker,
	wrapperNames: ReadonlySet<string>,
	visitedSymbols: ReadonlySet<TSSymbol>,
): InspectionResult {
	if (isTypeAliasDeclaration(declaration)) {
		return inspectTsTypeNodeAccurate(declaration.type, checker, wrapperNames, visitedSymbols);
	}

	if (isInterfaceDeclaration(declaration)) {
		let hasManualChildren = false;
		for (const member of declaration.members) {
			if (!isTypeScriptPropertySignature(member) || member.name === undefined) continue;
			if (isTypeScriptIdentifier(member.name) && CHILDREN_PROPERTY_NAMES.has(member.name.text)) {
				hasManualChildren = true;
				break;
			}
			if (isTypeScriptStringLiteral(member.name) && CHILDREN_PROPERTY_NAMES.has(member.name.text)) {
				hasManualChildren = true;
				break;
			}
		}

		const heritageResults =
			declaration.heritageClauses?.flatMap((heritageClause) =>
				heritageClause.types.map((typeNode) =>
					inspectTsTypeNodeAccurate(typeNode, checker, wrapperNames, visitedSymbols),
				),
			) ?? [];

		return mergeInspectionResults([
			{
				hasChildren: hasManualChildren,
				hasManualChildren,
				usesApprovedWrapper: false,
			},
			...heritageResults,
		]);
	}

	return {
		hasChildren: false,
		hasManualChildren: false,
		usesApprovedWrapper: false,
	};
}

function inspectTsTypeNodeAccurate(
	typeNode: TsTypeNode,
	checker: TypeChecker,
	wrapperNames: ReadonlySet<string>,
	visitedSymbols: ReadonlySet<TSSymbol>,
): InspectionResult {
	if (isTypeLiteralNode(typeNode)) {
		for (const member of typeNode.members) {
			if (!isTypeScriptPropertySignature(member) || member.name === undefined) continue;
			if (isTypeScriptIdentifier(member.name) && CHILDREN_PROPERTY_NAMES.has(member.name.text)) {
				return {
					hasChildren: true,
					hasManualChildren: true,
					usesApprovedWrapper: false,
				};
			}
			if (isTypeScriptStringLiteral(member.name) && CHILDREN_PROPERTY_NAMES.has(member.name.text)) {
				return {
					hasChildren: true,
					hasManualChildren: true,
					usesApprovedWrapper: false,
				};
			}
		}

		return {
			hasChildren: false,
			hasManualChildren: false,
			usesApprovedWrapper: false,
		};
	}

	if (isIntersectionTypeNode(typeNode)) {
		return mergeInspectionResults(
			typeNode.types.map((memberType) =>
				inspectTsTypeNodeAccurate(memberType, checker, wrapperNames, visitedSymbols),
			),
		);
	}

	if (isExpressionWithTypeArguments(typeNode)) {
		const symbol = checker.getSymbolAtLocation(typeNode.expression);
		if (!symbol) {
			return {
				hasChildren: false,
				hasManualChildren: false,
				usesApprovedWrapper: false,
			};
		}

		return inspectTypeSymbolAccurate(symbol, checker, wrapperNames, new Set(visitedSymbols));
	}

	if (isTypeReferenceNode(typeNode)) {
		const symbol = checker.getSymbolAtLocation(typeNode.typeName);
		if (!symbol) {
			return {
				hasChildren: false,
				hasManualChildren: false,
				usesApprovedWrapper: false,
			};
		}

		return inspectTypeSymbolAccurate(symbol, checker, wrapperNames, new Set(visitedSymbols));
	}

	return {
		hasChildren: false,
		hasManualChildren: false,
		usesApprovedWrapper: false,
	};
}

function createFastModeListeners(
	context: Readonly<TSESLint.RuleContext<MessageIds, Options>>,
	options: Required<NoManualChildrenPropertyOptions>,
): TSESLint.RuleListener {
	const interfaceDeclarations = new Map<string, TSESTree.TSInterfaceDeclaration>();
	const typeAliasDeclarations = new Map<string, TSESTree.TSTypeAliasDeclaration>();
	const wrapperNames = new Set(options.wrapperNames);

	for (const statement of context.sourceCode.ast.body) {
		if (statement.type === AST_NODE_TYPES.TSInterfaceDeclaration) {
			interfaceDeclarations.set(statement.id.name, statement);
			continue;
		}

		if (statement.type === AST_NODE_TYPES.TSTypeAliasDeclaration) {
			typeAliasDeclarations.set(statement.id.name, statement);
		}
	}

	function maybeReportCandidate(candidate: ComponentCandidate): void {
		const inspectionResult = inspectTypeNodeFast(
			candidate.propertiesTypeNode,
			wrapperNames,
			interfaceDeclarations,
			typeAliasDeclarations,
		);

		if (
			!(
				inspectionResult.hasManualChildren ||
				(inspectionResult.hasChildren && !inspectionResult.usesApprovedWrapper)
			)
		) {
			return;
		}

		context.report({
			data: {
				componentName: candidate.name,
				wrapperNames: options.wrapperNames.join(", "),
			},
			messageId: "manualChildrenProperty",
			node: candidate.reportNode,
		});
	}

	return {
		FunctionDeclaration(node): void {
			if (!node.id) return;
			const candidate = getFunctionCandidate(node.id.name, node);
			if (candidate) maybeReportCandidate(candidate);
		},
		VariableDeclarator(node): void {
			if (node.id.type !== AST_NODE_TYPES.Identifier || !node.init) return;
			if (
				node.init.type !== AST_NODE_TYPES.ArrowFunctionExpression &&
				node.init.type !== AST_NODE_TYPES.FunctionExpression
			) {
				return;
			}

			const candidate = getFunctionCandidate(node.id.name, node.init);
			if (candidate) maybeReportCandidate(candidate);
		},
	};
}

function createAccurateModeListeners(
	context: Readonly<TSESLint.RuleContext<MessageIds, Options>>,
	options: Required<NoManualChildrenPropertyOptions>,
): TSESLint.RuleListener {
	const services = ESLintUtils.getParserServices(context, true);
	const { program } = services;
	if (!program) return {};

	const checker = program.getTypeChecker();
	const interfaceDeclarations = new Map<string, TSESTree.TSInterfaceDeclaration>();
	const typeAliasDeclarations = new Map<string, TSESTree.TSTypeAliasDeclaration>();
	const wrapperNames = new Set(options.wrapperNames);

	for (const statement of context.sourceCode.ast.body) {
		if (statement.type === AST_NODE_TYPES.TSInterfaceDeclaration) {
			interfaceDeclarations.set(statement.id.name, statement);
			continue;
		}

		if (statement.type === AST_NODE_TYPES.TSTypeAliasDeclaration) {
			typeAliasDeclarations.set(statement.id.name, statement);
		}
	}

	function maybeReportCandidate(candidate: ComponentCandidate): void {
		const tsFunctionNode = services.esTreeNodeToTSNodeMap.get(candidate.functionNode);
		if (!isTypeScriptFunctionLike(tsFunctionNode)) return;

		const tsTypeNode = services.esTreeNodeToTSNodeMap.get(candidate.propertiesTypeNode);
		if (!isTypeScriptTypeNode(tsTypeNode)) return;

		const accurateInspectionResult = inspectTsTypeNodeAccurate(tsTypeNode, checker, wrapperNames, new Set());
		const fastInspectionResult = inspectTypeNodeFast(
			candidate.propertiesTypeNode,
			wrapperNames,
			interfaceDeclarations,
			typeAliasDeclarations,
		);
		const inspectionResult = mergeInspectionResults([accurateInspectionResult, fastInspectionResult]);
		if (
			!(
				inspectionResult.hasManualChildren ||
				(inspectionResult.hasChildren && !inspectionResult.usesApprovedWrapper)
			)
		) {
			return;
		}

		context.report({
			data: {
				componentName: candidate.name,
				wrapperNames: options.wrapperNames.join(", "),
			},
			messageId: "manualChildrenProperty",
			node: candidate.reportNode,
		});
	}

	return {
		FunctionDeclaration(node): void {
			if (!node.id) return;
			const candidate = getFunctionCandidate(node.id.name, node);
			if (candidate) maybeReportCandidate(candidate);
		},
		VariableDeclarator(node): void {
			if (node.id.type !== AST_NODE_TYPES.Identifier || !node.init) return;
			if (
				node.init.type !== AST_NODE_TYPES.ArrowFunctionExpression &&
				node.init.type !== AST_NODE_TYPES.FunctionExpression
			) {
				return;
			}

			const candidate = getFunctionCandidate(node.id.name, node.init);
			if (candidate) maybeReportCandidate(candidate);
		},
	};
}

const noManualChildrenProperty = createRule<Options, MessageIds>({
	create(context) {
		const options: Required<NoManualChildrenPropertyOptions> = {
			...DEFAULT_OPTIONS,
			...context.options[0],
		};

		if (options.mode === "fast") return createFastModeListeners(context, options);
		if (options.mode === "accurate") return createAccurateModeListeners(context, options);

		const services = ESLintUtils.getParserServices(context, true);
		if (services.program) return createAccurateModeListeners(context, options);
		return createFastModeListeners(context, options);
	},
	defaultOptions: [DEFAULT_OPTIONS],
	meta: {
		docs: {
			description:
				"Disallow manually declaring a children prop on React component props when a configured wrapper type should be used instead.",
		},
		messages: {
			manualChildrenProperty:
				"Do not manually declare `children` on '{{componentName}}' props. Use one of the configured wrapper types instead: {{wrapperNames}}.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					mode: {
						default: "auto",
						enum: ["auto", "fast", "accurate"],
						type: "string",
					},
					wrapperNames: {
						default: ["PropertiesWithChildren"],
						items: { type: "string" },
						type: "array",
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
	name: "no-manual-children-property",
});

export default noManualChildrenProperty;
