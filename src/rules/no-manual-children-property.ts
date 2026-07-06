import { createRule } from "$utilities/create-rule";
import { getDefinedValue } from "$utilities/defined-utilities";
import { isLikelyReactComponentName } from "$utilities/react-component-utilities";
import { AST_NODE_TYPES, ESLintUtils } from "@typescript-eslint/utils";
import {
	isExpressionWithTypeArguments,
	isInterfaceDeclaration,
	isIntersectionTypeNode,
	isTypeAliasDeclaration,
	isTypeLiteralNode,
	isTypeReferenceNode,
	isIdentifier as isTypeScriptIdentifier,
	isPropertySignature as isTypeScriptPropertySignature,
	isStringLiteral as isTypeScriptStringLiteral,
	SymbolFlags,
} from "typescript";

import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import type { Declaration, Node as TsNode, Symbol as TSSymbol, TypeElement, TypeChecker } from "typescript";

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

function createEmptyInspectionResult(): InspectionResult {
	return {
		hasChildren: false,
		hasManualChildren: false,
		usesApprovedWrapper: false,
	};
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

interface TypeDeclarations {
	readonly interfaces: ReadonlyMap<string, TSESTree.TSInterfaceDeclaration>;
	readonly typeAliases: ReadonlyMap<string, TSESTree.TSTypeAliasDeclaration>;
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

function getParameterTypeAnnotation(parameter: TSESTree.Node): TSESTree.TypeNode | undefined {
	if (parameter.type === AST_NODE_TYPES.Identifier) return parameter.typeAnnotation?.typeAnnotation;
	if (parameter.type === AST_NODE_TYPES.AssignmentPattern) return getParameterTypeAnnotation(parameter.left);
	if (parameter.type === AST_NODE_TYPES.RestElement) return getParameterTypeAnnotation(parameter.argument);
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

function collectTypeDeclarations(sourceCode: TSESLint.SourceCode): TypeDeclarations {
	const interfaces = new Map<string, TSESTree.TSInterfaceDeclaration>();
	const typeAliases = new Map<string, TSESTree.TSTypeAliasDeclaration>();

	for (const statement of sourceCode.ast.body) {
		if (statement.type === AST_NODE_TYPES.TSInterfaceDeclaration) {
			interfaces.set(statement.id.name, statement);
			continue;
		}

		if (statement.type === AST_NODE_TYPES.TSTypeAliasDeclaration) {
			typeAliases.set(statement.id.name, statement);
		}
	}

	return { interfaces, typeAliases };
}

function shouldReportInspectionResult(inspectionResult: InspectionResult): boolean {
	return (
		inspectionResult.hasManualChildren || (inspectionResult.hasChildren && !inspectionResult.usesApprovedWrapper)
	);
}

function reportCandidate(
	context: Readonly<TSESLint.RuleContext<MessageIds, Options>>,
	options: Required<NoManualChildrenPropertyOptions>,
	candidate: ComponentCandidate,
): void {
	context.report({
		data: {
			componentName: candidate.name,
			wrapperNames: options.wrapperNames.join(", "),
		},
		messageId: "manualChildrenProperty",
		node: candidate.reportNode,
	});
}

function createComponentCandidateListeners(
	maybeReportCandidate: (candidate: ComponentCandidate) => void,
): TSESLint.RuleListener {
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

function getRightmostReferenceName(referenceText: string): string {
	const separatorIndex = referenceText.lastIndexOf(".");
	return separatorIndex === -1 ? referenceText : referenceText.slice(separatorIndex + 1);
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
	sourceCode: TSESLint.SourceCode,
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
					sourceCode,
					wrapperNames,
					interfaceDeclarations,
					typeAliasDeclarations,
					visitedNames,
				),
			),
		);
	}

	if (typeNode.type === AST_NODE_TYPES.TSTypeReference) {
		const referenceName = getRightmostReferenceName(sourceCode.getText(typeNode.typeName));
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
				sourceCode,
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
				sourceCode,
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
	sourceCode: TSESLint.SourceCode,
	wrapperNames: ReadonlySet<string>,
	interfaceDeclarations: ReadonlyMap<string, TSESTree.TSInterfaceDeclaration>,
	typeAliasDeclarations: ReadonlyMap<string, TSESTree.TSTypeAliasDeclaration>,
	visitedNames = new Set<string>(),
): InspectionResult {
	const referenceName = getRightmostReferenceName(sourceCode.getText(heritageClause.expression));
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
			sourceCode,
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
			sourceCode,
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
	sourceCode: TSESLint.SourceCode,
	wrapperNames: ReadonlySet<string>,
	interfaceDeclarations: ReadonlyMap<string, TSESTree.TSInterfaceDeclaration>,
	typeAliasDeclarations: ReadonlyMap<string, TSESTree.TSTypeAliasDeclaration>,
	visitedNames = new Set<string>(),
): InspectionResult {
	const ownMembersResult = inspectTypeMembers(interfaceDeclaration.body.body);

	const heritageResults = interfaceDeclaration.extends.map((heritageClause) =>
		inspectHeritageClauseFast(
			heritageClause,
			sourceCode,
			wrapperNames,
			interfaceDeclarations,
			typeAliasDeclarations,
			visitedNames,
		),
	);

	return mergeInspectionResults([ownMembersResult, ...heritageResults]);
}

function hasSymbolFlag(flags: SymbolFlags, flag: SymbolFlags): boolean {
	return Math.trunc(flags / flag) % 2 === 1;
}

function resolveAliasedSymbol(symbol: TSSymbol, checker: TypeChecker): TSSymbol {
	if (!hasSymbolFlag(symbol.flags, SymbolFlags.Alias)) return symbol;
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

function hasManualChildrenMember(members: ReadonlyArray<TypeElement>): boolean {
	for (const member of members) {
		if (!isTypeScriptPropertySignature(member) || member.name === undefined) continue;
		if (isTypeScriptIdentifier(member.name) && CHILDREN_PROPERTY_NAMES.has(member.name.text)) return true;
		if (isTypeScriptStringLiteral(member.name) && CHILDREN_PROPERTY_NAMES.has(member.name.text)) return true;
	}

	return false;
}

function inspectTypeSymbolFromLocation(
	node: TsNode,
	checker: TypeChecker,
	wrapperNames: ReadonlySet<string>,
	visitedSymbols: ReadonlySet<TSSymbol>,
): InspectionResult {
	if (isExpressionWithTypeArguments(node)) {
		const symbol = checker.getSymbolAtLocation(node.expression);
		if (symbol === undefined) return createEmptyInspectionResult();
		return inspectTypeSymbolAccurate(symbol, checker, wrapperNames, new Set(visitedSymbols));
	}

	if (isTypeReferenceNode(node)) {
		const symbol = getDefinedValue(
			checker.getSymbolAtLocation(node.typeName),
			"Expected TypeScript to bind type reference nodes.",
		);
		return inspectTypeSymbolAccurate(symbol, checker, wrapperNames, new Set(visitedSymbols));
	}

	return createEmptyInspectionResult();
}

function inspectTsTypeNodeAccurate(
	typeNode: TsNode,
	checker: TypeChecker,
	wrapperNames: ReadonlySet<string>,
	visitedSymbols: ReadonlySet<TSSymbol>,
): InspectionResult {
	if (isTypeLiteralNode(typeNode)) {
		if (hasManualChildrenMember(typeNode.members)) {
			return {
				hasChildren: true,
				hasManualChildren: true,
				usesApprovedWrapper: false,
			};
		}

		return createEmptyInspectionResult();
	}

	if (isIntersectionTypeNode(typeNode)) {
		return mergeInspectionResults(
			typeNode.types.map((memberType) =>
				inspectTsTypeNodeAccurate(memberType, checker, wrapperNames, visitedSymbols),
			),
		);
	}

	return inspectTypeSymbolFromLocation(typeNode, checker, wrapperNames, visitedSymbols);
}

function createFastModeListeners(
	context: Readonly<TSESLint.RuleContext<MessageIds, Options>>,
	options: Required<NoManualChildrenPropertyOptions>,
): TSESLint.RuleListener {
	const declarations = collectTypeDeclarations(context.sourceCode);
	const wrapperNames = new Set(options.wrapperNames);

	function maybeReportCandidate(candidate: ComponentCandidate): void {
		const inspectionResult = inspectTypeNodeFast(
			candidate.propertiesTypeNode,
			context.sourceCode,
			wrapperNames,
			declarations.interfaces,
			declarations.typeAliases,
		);

		if (shouldReportInspectionResult(inspectionResult)) reportCandidate(context, options, candidate);
	}

	return createComponentCandidateListeners(maybeReportCandidate);
}

function inspectCandidateAccurately(
	candidate: ComponentCandidate,
	tsTypeNode: TsNode,
	sourceCode: TSESLint.SourceCode,
	checker: TypeChecker,
	wrapperNames: ReadonlySet<string>,
	declarations: TypeDeclarations,
): InspectionResult {
	const accurateInspectionResult = inspectTsTypeNodeAccurate(tsTypeNode, checker, wrapperNames, new Set());
	const fastInspectionResult = inspectTypeNodeFast(
		candidate.propertiesTypeNode,
		sourceCode,
		wrapperNames,
		declarations.interfaces,
		declarations.typeAliases,
	);
	return mergeInspectionResults([accurateInspectionResult, fastInspectionResult]);
}

function createAccurateModeListeners(
	context: Readonly<TSESLint.RuleContext<MessageIds, Options>>,
	options: Required<NoManualChildrenPropertyOptions>,
): TSESLint.RuleListener {
	const services = ESLintUtils.getParserServices(context, true);
	const { program } = services;
	if (!program) return {};

	const checker = program.getTypeChecker();
	const declarations = collectTypeDeclarations(context.sourceCode);
	const wrapperNames = new Set(options.wrapperNames);

	function maybeReportCandidate(candidate: ComponentCandidate): void {
		const tsTypeNode = services.esTreeNodeToTSNodeMap.get(candidate.propertiesTypeNode);
		const inspectionResult = inspectCandidateAccurately(
			candidate,
			tsTypeNode,
			context.sourceCode,
			checker,
			wrapperNames,
			declarations,
		);
		if (shouldReportInspectionResult(inspectionResult)) reportCandidate(context, options, candidate);
	}

	return createComponentCandidateListeners(maybeReportCandidate);
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
	meta: {
		defaultOptions: [DEFAULT_OPTIONS],
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
