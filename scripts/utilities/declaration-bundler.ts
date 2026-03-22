import { basename, dirname, resolve, sep } from "node:path";
import ts from "typescript";

interface DeclarationProgramOptions {
	readonly compilerOptions?: ts.CompilerOptions;
	readonly declarationDirectories?: ReadonlyArray<string>;
	readonly entryFilePaths?: ReadonlyArray<string>;
}

interface BundleDeclarationOptions {
	readonly entryFilePath: string;
	readonly program: ts.Program;
}

interface ExternalExportRecord {
	readonly kind: "external";
	readonly statement: ts.ExportDeclaration;
}

interface DefaultExportRecord {
	readonly kind: "default";
	readonly symbol: ts.Symbol;
}

interface NamedExportRecord {
	readonly kind: "named";
	readonly publicName: string;
	readonly symbol: ts.Symbol;
	readonly typeOnly: boolean;
}

type RootExportRecord = DefaultExportRecord | ExternalExportRecord | NamedExportRecord;

interface CollectedSymbolRecord {
	readonly originalName: string;
	readonly statement: SupportedDeclarationStatement;
	readonly symbol: ts.Symbol;
}

interface ExternalImportBinding {
	readonly importedName: string;
	readonly kind: "default" | "named" | "namespace";
	readonly localName: string;
	readonly moduleSpecifier: string;
	readonly symbol: ts.Symbol;
	readonly typeOnly: boolean;
}

type SupportedDeclarationStatement =
	| ts.ClassDeclaration
	| ts.EnumDeclaration
	| ts.FunctionDeclaration
	| ts.InterfaceDeclaration
	| ts.ModuleDeclaration
	| ts.TypeAliasDeclaration
	| ts.VariableStatement;

interface BundlerState {
	readonly checker: ts.TypeChecker;
	readonly collectedSymbols: Map<ts.Symbol, CollectedSymbolRecord>;
	readonly externalImports: Map<ts.Symbol, ExternalImportBinding>;
	readonly orderedSymbols: Array<ts.Symbol>;
	readonly program: ts.Program;
	readonly visitingSymbols: Set<ts.Symbol>;
}

const SUPPORTED_DECLARATION_SYNTAX_KINDS = new Set<ts.SyntaxKind>([
	ts.SyntaxKind.ClassDeclaration,
	ts.SyntaxKind.EnumDeclaration,
	ts.SyntaxKind.FunctionDeclaration,
	ts.SyntaxKind.InterfaceDeclaration,
	ts.SyntaxKind.ModuleDeclaration,
	ts.SyntaxKind.TypeAliasDeclaration,
	ts.SyntaxKind.VariableStatement,
]);

export function createDeclarationBundlerProgram(options: DeclarationProgramOptions): ts.Program {
	const rootNameSet = new Set<string>();

	for (const entryFilePath of options.entryFilePaths ?? []) rootNameSet.add(resolve(entryFilePath));

	for (const directory of options.declarationDirectories ?? []) {
		for (const filePath of ts.sys.readDirectory(directory, [".d.ts"], undefined, ["**/*.d.ts"])) {
			rootNameSet.add(resolve(filePath));
		}
	}

	const rootNames = [...rootNameSet];
	rootNames.sort((left, right) => left.localeCompare(right));

	return ts.createProgram({
		options: {
			module: ts.ModuleKind.ES2022,
			moduleResolution: ts.ModuleResolutionKind.Bundler,
			noLib: true,
			skipLibCheck: true,
			target: ts.ScriptTarget.ES2023,
			types: [],
			verbatimModuleSyntax: true,
			...options.compilerOptions,
		},
		rootNames,
	});
}

export function bundleDeclarationEntryPoint(options: BundleDeclarationOptions): string {
	const entryFilePath = resolve(options.entryFilePath);
	const entrySourceFile = options.program.getSourceFile(entryFilePath);

	if (entrySourceFile === undefined) {
		throw new Error(`Declaration entrypoint not found: ${entryFilePath}`);
	}

	const checker = options.program.getTypeChecker();
	const rootExports = collectRootExports(entrySourceFile, checker);
	const state: BundlerState = {
		checker,
		collectedSymbols: new Map(),
		externalImports: new Map(),
		orderedSymbols: [],
		program: options.program,
		visitingSymbols: new Set(),
	};

	for (const rootExport of rootExports) {
		if (rootExport.kind === "external") continue;
		collectSymbol(state, rootExport.symbol);
	}

	const localSymbolNames = assignLocalSymbolNames(rootExports, state.collectedSymbols, state.orderedSymbols);
	const externalImportNames = assignExternalImportNames(state.externalImports, localSymbolNames);
	const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed, removeComments: false });
	const sections = new Array<string>();

	const printedExternalImports = [...state.externalImports.values()]
		.toSorted(compareExternalImportBindings)
		.map((binding) => printExternalImport(binding, externalImportNames));
	if (printedExternalImports.length > 0) sections.push(printedExternalImports.join("\n"));

	const printedExternalExports = rootExports
		.filter((record): record is ExternalExportRecord => record.kind === "external")
		.map(({ statement }) => printer.printNode(ts.EmitHint.Unspecified, statement, entrySourceFile));
	if (printedExternalExports.length > 0) sections.push(printedExternalExports.join("\n"));

	const printedDeclarations = state.orderedSymbols.map((symbol) => {
		const record = state.collectedSymbols.get(symbol);
		if (record === undefined) {
			throw new Error(`Missing collected declaration for symbol: ${symbol.getName()}`);
		}

		const transformed = transformStatement(record.statement, state, localSymbolNames, externalImportNames);
		return printer.printNode(ts.EmitHint.Unspecified, transformed, record.statement.getSourceFile());
	});
	if (printedDeclarations.length > 0) sections.push(printedDeclarations.join("\n\n"));

	const namedTypeExports = new Array<string>();
	const namedValueExports = new Array<string>();
	let defaultExportName: string | undefined;

	for (const rootExport of rootExports) {
		if (rootExport.kind === "external") continue;
		const emittedName = localSymbolNames.get(rootExport.symbol);
		if (emittedName === undefined) {
			throw new Error(`Missing emitted declaration name for symbol: ${rootExport.symbol.getName()}`);
		}

		if (rootExport.kind === "default") {
			defaultExportName = emittedName;
			continue;
		}

		const exportSpecifier =
			emittedName === rootExport.publicName ? emittedName : `${emittedName} as ${rootExport.publicName}`;
		if (rootExport.typeOnly) namedTypeExports.push(exportSpecifier);
		else namedValueExports.push(exportSpecifier);
	}

	const printedExports = new Array<string>();
	if (namedTypeExports.length > 0) printedExports.push(`export type { ${namedTypeExports.join(", ")} };`);
	if (namedValueExports.length > 0) printedExports.push(`export { ${namedValueExports.join(", ")} };`);
	if (defaultExportName !== undefined) printedExports.push(`export default ${defaultExportName};`);
	if (printedExports.length > 0) sections.push(printedExports.join("\n"));

	return sections
		.filter((section) => section.trim().length > 0)
		.join("\n\n")
		.concat("\n");
}

function assignExternalImportNames(
	externalImports: ReadonlyMap<ts.Symbol, ExternalImportBinding>,
	localSymbolNames: ReadonlyMap<ts.Symbol, string>,
): Map<ts.Symbol, string> {
	const assignedNames = new Set<string>(localSymbolNames.values());
	const results = new Map<ts.Symbol, string>();

	for (const binding of [...externalImports.values()].toSorted(compareExternalImportBindings)) {
		const emittedName = createUniqueName(binding.localName, binding.moduleSpecifier, assignedNames);
		results.set(binding.symbol, emittedName);
	}

	return results;
}

function assignLocalSymbolNames(
	rootExports: ReadonlyArray<RootExportRecord>,
	collectedSymbols: ReadonlyMap<ts.Symbol, CollectedSymbolRecord>,
	orderedSymbols: ReadonlyArray<ts.Symbol>,
): Map<ts.Symbol, string> {
	const assignedNames = new Set<string>();
	const results = new Map<ts.Symbol, string>();
	const preferredPublicNames = new Map<ts.Symbol, string>();

	for (const rootExport of rootExports) {
		if (rootExport.kind === "named" && !preferredPublicNames.has(rootExport.symbol)) {
			preferredPublicNames.set(rootExport.symbol, rootExport.publicName);
		}
	}

	for (const rootExport of rootExports) {
		if (rootExport.kind === "external" || results.has(rootExport.symbol)) continue;
		const collectedRecord = collectedSymbols.get(rootExport.symbol);
		if (collectedRecord === undefined) {
			throw new Error(`Missing collected declaration for exported symbol: ${rootExport.symbol.getName()}`);
		}

		const preferredName = preferredPublicNames.get(rootExport.symbol) ?? collectedRecord.originalName;
		results.set(
			rootExport.symbol,
			createUniqueName(preferredName, collectedRecord.statement.getSourceFile().fileName, assignedNames),
		);
	}

	for (const symbol of orderedSymbols) {
		if (results.has(symbol)) continue;
		const collectedRecord = collectedSymbols.get(symbol);
		if (collectedRecord === undefined) {
			throw new Error(`Missing collected declaration for symbol: ${symbol.getName()}`);
		}

		results.set(
			symbol,
			createUniqueName(
				collectedRecord.originalName,
				collectedRecord.statement.getSourceFile().fileName,
				assignedNames,
			),
		);
	}

	return results;
}

function collectRootExports(entrySourceFile: ts.SourceFile, checker: ts.TypeChecker): ReadonlyArray<RootExportRecord> {
	const records = new Array<RootExportRecord>();

	for (const statement of entrySourceFile.statements) {
		if (ts.isExportAssignment(statement)) {
			if (statement.isExportEquals) {
				throw new Error(`CommonJS export assignments are not supported in ${entrySourceFile.fileName}`);
			}
			if (!ts.isIdentifier(statement.expression)) {
				throw new Error(`Unsupported default export in ${entrySourceFile.fileName}`);
			}

			const symbol = checker.getSymbolAtLocation(statement.expression);
			if (symbol === undefined) {
				throw new Error(`Unable to resolve default export in ${entrySourceFile.fileName}`);
			}

			records.push({ kind: "default", symbol: resolveAliasedSymbol(symbol, checker) });
			continue;
		}

		if (ts.isExportDeclaration(statement)) {
			collectExportDeclarationRecords(records, statement, checker);
			continue;
		}

		if (!hasExportModifier(statement) || !SUPPORTED_DECLARATION_SYNTAX_KINDS.has(statement.kind)) continue;

		for (const symbol of getDeclaredStatementSymbols(statement, checker)) {
			records.push({
				kind: "named",
				publicName: getStatementSymbolName(symbol),
				symbol,
				typeOnly: isTypeOnlyDeclarationStatement(statement),
			});
		}
	}

	return records;
}

function collectExportDeclarationRecords(
	records: Array<RootExportRecord>,
	statement: ts.ExportDeclaration,
	checker: ts.TypeChecker,
): void {
	if (statement.exportClause === undefined) {
		throw new Error(`Unsupported export star declaration in ${statement.getSourceFile().fileName}`);
	}
	if (!ts.isNamedExports(statement.exportClause)) {
		throw new Error(`Unsupported namespace export declaration in ${statement.getSourceFile().fileName}`);
	}

	const moduleSpecifier = getModuleSpecifierText(statement.moduleSpecifier);
	if (moduleSpecifier !== undefined && !isRelativeModuleSpecifier(moduleSpecifier)) {
		records.push({ kind: "external", statement });
		return;
	}

	const moduleSourceSymbol =
		statement.moduleSpecifier === undefined ? undefined : checker.getSymbolAtLocation(statement.moduleSpecifier);
	const moduleExports = moduleSourceSymbol === undefined ? undefined : checker.getExportsOfModule(moduleSourceSymbol);

	for (const exportSpecifier of statement.exportClause.elements) {
		const publicName = exportSpecifier.name.text;
		const exportedName = exportSpecifier.propertyName?.text ?? exportSpecifier.name.text;

		let symbol: ts.Symbol | undefined;
		if (statement.moduleSpecifier === undefined) {
			const localSymbol = checker.getSymbolAtLocation(exportSpecifier.propertyName ?? exportSpecifier.name);
			if (localSymbol !== undefined) symbol = resolveAliasedSymbol(localSymbol, checker);
		} else if (moduleExports !== undefined) {
			symbol = moduleExports.find((candidate) => candidate.getName() === exportedName);
			if (symbol !== undefined) symbol = resolveAliasedSymbol(symbol, checker);
		}

		if (symbol === undefined) {
			throw new Error(`Unable to resolve export '${publicName}' in ${statement.getSourceFile().fileName}`);
		}

		records.push({
			kind: "named",
			publicName,
			symbol,
			typeOnly: statement.isTypeOnly || exportSpecifier.isTypeOnly,
		});
	}
}

function collectSymbol(state: BundlerState, symbol: ts.Symbol): void {
	const resolvedSymbol = resolveAliasedSymbol(symbol, state.checker);
	if (state.collectedSymbols.has(resolvedSymbol) || state.visitingSymbols.has(resolvedSymbol)) return;

	const statement = getTopLevelStatementForSymbol(resolvedSymbol, state.checker);
	if (statement === undefined || !isLocalDeclarationSourceFile(statement.getSourceFile(), state.program)) return;

	state.visitingSymbols.add(resolvedSymbol);
	collectStatementDependencies(state, statement);
	state.visitingSymbols.delete(resolvedSymbol);

	const originalName = getStatementPrimaryName(statement);
	if (originalName === undefined) {
		throw new Error(`Unsupported declaration statement in ${statement.getSourceFile().fileName}`);
	}

	state.collectedSymbols.set(resolvedSymbol, {
		originalName,
		statement,
		symbol: resolvedSymbol,
	});
	state.orderedSymbols.push(resolvedSymbol);
}

function collectStatementDependencies(state: BundlerState, statement: SupportedDeclarationStatement): void {
	const ownSymbols = new Set(getDeclaredStatementSymbols(statement, state.checker));

	function visit(node: ts.Node): void {
		if (ts.isIdentifier(node)) collectIdentifierDependency(state, node, ownSymbols);
		ts.forEachChild(node, visit);
	}

	visit(statement);
}

function collectIdentifierDependency(
	state: BundlerState,
	identifier: ts.Identifier,
	ownSymbols: ReadonlySet<ts.Symbol>,
): void {
	const symbol = state.checker.getSymbolAtLocation(identifier);
	if (symbol === undefined) return;

	const importBinding = getExternalOrLocalImportBinding(symbol);
	if (importBinding !== undefined) {
		if (isRelativeModuleSpecifier(importBinding.moduleSpecifier)) {
			const targetSymbol = state.checker.getAliasedSymbol(symbol);
			collectSymbol(state, targetSymbol);
		} else if (!state.externalImports.has(symbol)) state.externalImports.set(symbol, importBinding);

		return;
	}

	const resolvedSymbol = resolveAliasedSymbol(symbol, state.checker);
	if (ownSymbols.has(resolvedSymbol)) return;

	const statement = getTopLevelStatementForSymbol(resolvedSymbol, state.checker);
	if (statement === undefined || !isLocalDeclarationSourceFile(statement.getSourceFile(), state.program)) return;
	collectSymbol(state, resolvedSymbol);
}

function compareExternalImportBindings(left: ExternalImportBinding, right: ExternalImportBinding): number {
	const moduleComparison = left.moduleSpecifier.localeCompare(right.moduleSpecifier);
	if (moduleComparison !== 0) return moduleComparison;

	const kindComparison = left.kind.localeCompare(right.kind);
	if (kindComparison !== 0) return kindComparison;

	return left.localName.localeCompare(right.localName);
}

function createUniqueName(preferredName: string, scopeSource: string, usedNames: Set<string>): string {
	if (!usedNames.has(preferredName)) {
		usedNames.add(preferredName);
		return preferredName;
	}

	const scopeName = createScopeName(scopeSource);
	const capitalizedPreferredName = capitalizeIdentifier(preferredName);
	const scopedName = scopeName.endsWith(capitalizedPreferredName)
		? scopeName
		: `${scopeName}${capitalizedPreferredName}`;
	if (!usedNames.has(scopedName)) {
		usedNames.add(scopedName);
		return scopedName;
	}

	let counter = 2;
	while (usedNames.has(`${scopedName}${counter}`)) counter += 1;

	const uniqueName = `${scopedName}${counter}`;
	usedNames.add(uniqueName);
	return uniqueName;
}

function createScopeName(scopeSource: string): string {
	const fileStem = getFileStem(scopeSource);
	return toPascalCase(fileStem.length > 0 ? fileStem : basename(dirname(scopeSource)));
}

function getDeclaredStatementSymbols(statement: ts.Statement, checker: ts.TypeChecker): ReadonlyArray<ts.Symbol> {
	const symbols = new Array<ts.Symbol>();

	for (const identifier of getStatementNameIdentifiers(statement)) {
		const symbol = checker.getSymbolAtLocation(identifier);
		if (symbol !== undefined) symbols.push(resolveAliasedSymbol(symbol, checker));
	}

	return symbols;
}

function getExternalOrLocalImportBinding(symbol: ts.Symbol): ExternalImportBinding | undefined {
	for (const declaration of symbol.getDeclarations() ?? []) {
		if (ts.isImportSpecifier(declaration)) {
			const importDeclaration = getImportDeclaration(declaration);
			const moduleSpecifier = getModuleSpecifierText(importDeclaration.moduleSpecifier);
			if (moduleSpecifier === undefined) continue;
			return {
				importedName: declaration.propertyName?.text ?? declaration.name.text,
				kind: "named",
				localName: declaration.name.text,
				moduleSpecifier,
				symbol,
				typeOnly:
					ts.isTypeOnlyImportDeclaration(declaration) ||
					(importDeclaration.importClause !== undefined &&
						ts.isTypeOnlyImportDeclaration(importDeclaration.importClause)),
			};
		}

		if (ts.isNamespaceImport(declaration)) {
			const importDeclaration = getImportDeclaration(declaration);
			const moduleSpecifier = getModuleSpecifierText(importDeclaration.moduleSpecifier);
			if (moduleSpecifier === undefined) continue;
			return {
				importedName: declaration.name.text,
				kind: "namespace",
				localName: declaration.name.text,
				moduleSpecifier,
				symbol,
				typeOnly:
					importDeclaration.importClause !== undefined &&
					ts.isTypeOnlyImportDeclaration(importDeclaration.importClause),
			};
		}

		if (ts.isImportClause(declaration) && declaration.name !== undefined) {
			const importDeclaration = getImportDeclaration(declaration);
			const moduleSpecifier = getModuleSpecifierText(importDeclaration.moduleSpecifier);
			if (moduleSpecifier === undefined) continue;
			return {
				importedName: declaration.name.text,
				kind: "default",
				localName: declaration.name.text,
				moduleSpecifier,
				symbol,
				typeOnly: ts.isTypeOnlyImportDeclaration(declaration),
			};
		}
	}

	return undefined;
}

function getFileStem(filePath: string): string {
	const baseName = basename(filePath);
	if (baseName.endsWith(".d.ts")) {
		const fileStem = baseName.slice(0, Math.max(0, baseName.length - 5));
		if (fileStem === "index") return basename(dirname(filePath));
		return fileStem;
	}

	const extension = baseName.lastIndexOf(".");
	const fileStem = extension > 0 ? baseName.slice(0, extension) : baseName;
	if (fileStem === "index") return basename(dirname(filePath));
	return fileStem;
}

function getImportDeclaration(node: ts.ImportClause | ts.ImportSpecifier | ts.NamespaceImport): ts.ImportDeclaration {
	let currentNode: ts.Node = node;
	while (!ts.isImportDeclaration(currentNode)) {
		if (currentNode.parent === undefined) break;
		currentNode = currentNode.parent;
	}

	if (ts.isImportDeclaration(currentNode)) return currentNode;
	throw new Error("Expected import binding parent to be an import declaration");
}

function getModuleSpecifierText(node: ts.Expression | undefined): string | undefined {
	return node !== undefined && ts.isStringLiteralLike(node) ? node.text : undefined;
}

function getStatementNameIdentifiers(statement: ts.Statement): ReadonlyArray<ts.Identifier> {
	if (
		ts.isClassDeclaration(statement) ||
		ts.isEnumDeclaration(statement) ||
		ts.isFunctionDeclaration(statement) ||
		ts.isInterfaceDeclaration(statement) ||
		ts.isTypeAliasDeclaration(statement)
	) {
		return statement.name === undefined ? [] : [statement.name];
	}

	if (ts.isModuleDeclaration(statement)) return ts.isIdentifier(statement.name) ? [statement.name] : [];

	if (ts.isVariableStatement(statement)) {
		const identifiers = new Array<ts.Identifier>();
		for (const declaration of statement.declarationList.declarations) {
			if (ts.isIdentifier(declaration.name)) identifiers.push(declaration.name);
		}
		return identifiers;
	}

	return [];
}

function getStatementPrimaryName(statement: SupportedDeclarationStatement): string | undefined {
	const [identifier] = getStatementNameIdentifiers(statement);
	return identifier?.text;
}

function getStatementSymbolName(symbol: ts.Symbol): string {
	const declarationStatement = getTopLevelStatementForSymbol(symbol, undefined);
	if (declarationStatement !== undefined) {
		const statementName = getStatementPrimaryName(declarationStatement);
		if (statementName !== undefined) return statementName;
	}

	return symbol.getName();
}

function getTopLevelStatementForSymbol(
	symbol: ts.Symbol,
	checker: ts.TypeChecker | undefined,
): SupportedDeclarationStatement | undefined {
	const resolvedSymbol = checker === undefined ? symbol : resolveAliasedSymbol(symbol, checker);

	for (const declaration of resolvedSymbol.getDeclarations() ?? []) {
		let currentNode: ts.Node = declaration;
		while (currentNode.parent !== undefined && !ts.isSourceFile(currentNode.parent)) {
			currentNode = currentNode.parent;
		}

		if (
			SUPPORTED_DECLARATION_SYNTAX_KINDS.has(currentNode.kind) &&
			isSupportedDeclarationStatement(currentNode) &&
			(checker === undefined || isStatementDeclaredBySymbol(currentNode, resolvedSymbol, checker))
		) {
			return currentNode;
		}
	}

	return undefined;
}

function isStatementDeclaredBySymbol(
	statement: SupportedDeclarationStatement,
	symbol: ts.Symbol,
	checker: ts.TypeChecker,
): boolean {
	for (const nameIdentifier of getStatementNameIdentifiers(statement)) {
		const statementSymbol = checker.getSymbolAtLocation(nameIdentifier);
		if (statementSymbol !== undefined && resolveAliasedSymbol(statementSymbol, checker) === symbol) return true;
	}

	return false;
}

function hasExportModifier(statement: ts.Statement): boolean {
	if (!ts.canHaveModifiers(statement)) return false;

	for (const modifier of ts.getModifiers(statement) ?? []) {
		if (modifier.kind === ts.SyntaxKind.ExportKeyword) return true;
	}
	return false;
}

function isLocalDeclarationSourceFile(sourceFile: ts.SourceFile, program: ts.Program): boolean {
	const normalizedPath = resolve(sourceFile.fileName);
	if (program.isSourceFileDefaultLibrary(sourceFile)) return false;
	return !normalizedPath.includes(`${sep}node_modules${sep}`);
}

function isRelativeModuleSpecifier(moduleSpecifier: string): boolean {
	return moduleSpecifier.startsWith(".") || moduleSpecifier.startsWith("/");
}

function isSupportedDeclarationStatement(node: ts.Node): node is SupportedDeclarationStatement {
	return SUPPORTED_DECLARATION_SYNTAX_KINDS.has(node.kind);
}

function isTypeOnlyDeclarationStatement(statement: ts.Statement): boolean {
	return ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement);
}

function printExternalImport(
	binding: ExternalImportBinding,
	externalImportNames: ReadonlyMap<ts.Symbol, string>,
): string {
	const emittedName = externalImportNames.get(binding.symbol);
	if (emittedName === undefined) {
		throw new Error(`Missing emitted external import name for symbol: ${binding.symbol.getName()}`);
	}

	if (binding.kind === "default") {
		return `${binding.typeOnly ? "import type" : "import"} ${emittedName} from ${JSON.stringify(binding.moduleSpecifier)};`;
	}

	if (binding.kind === "namespace") {
		return `${binding.typeOnly ? "import type" : "import"} * as ${emittedName} from ${JSON.stringify(binding.moduleSpecifier)};`;
	}

	const importName =
		emittedName === binding.importedName ? binding.importedName : `${binding.importedName} as ${emittedName}`;
	return `${binding.typeOnly ? "import type" : "import"} { ${importName} } from ${JSON.stringify(binding.moduleSpecifier)};`;
}

function removeExportModifiers(
	modifiers: ReadonlyArray<ts.ModifierLike> | undefined,
): ReadonlyArray<ts.ModifierLike> | undefined {
	if (modifiers === undefined) return undefined;

	const filtered = modifiers.filter(
		(modifier) => modifier.kind !== ts.SyntaxKind.DefaultKeyword && modifier.kind !== ts.SyntaxKind.ExportKeyword,
	);

	return filtered.length > 0 ? filtered : undefined;
}

function resolveAliasedSymbol(symbol: ts.Symbol, checker: ts.TypeChecker): ts.Symbol {
	return symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
}

function stripExportModifiers(statement: SupportedDeclarationStatement): SupportedDeclarationStatement {
	const modifiers = ts.canHaveModifiers(statement) ? removeExportModifiers(ts.getModifiers(statement)) : undefined;

	if (ts.isClassDeclaration(statement)) {
		return ts.factory.updateClassDeclaration(
			statement,
			modifiers,
			statement.name,
			statement.typeParameters,
			statement.heritageClauses,
			statement.members,
		);
	}

	if (ts.isEnumDeclaration(statement)) {
		return ts.factory.updateEnumDeclaration(statement, modifiers, statement.name, statement.members);
	}

	if (ts.isFunctionDeclaration(statement)) {
		return ts.factory.updateFunctionDeclaration(
			statement,
			modifiers,
			statement.asteriskToken,
			statement.name,
			statement.typeParameters,
			statement.parameters,
			statement.type,
			statement.body,
		);
	}

	if (ts.isInterfaceDeclaration(statement)) {
		return ts.factory.updateInterfaceDeclaration(
			statement,
			modifiers,
			statement.name,
			statement.typeParameters,
			statement.heritageClauses,
			statement.members,
		);
	}

	if (ts.isModuleDeclaration(statement)) {
		return ts.factory.updateModuleDeclaration(statement, modifiers, statement.name, statement.body);
	}

	if (ts.isTypeAliasDeclaration(statement)) {
		return ts.factory.updateTypeAliasDeclaration(
			statement,
			modifiers,
			statement.name,
			statement.typeParameters,
			statement.type,
		);
	}

	return ts.factory.updateVariableStatement(statement, modifiers, statement.declarationList);
}

const ALPHA_NUMERIC = /[A-Za-z0-9]/;

function toPascalCase(value: string): string {
	let output = "";
	let shouldCapitalize = true;

	for (const character of value) {
		const isAlphaNumeric = ALPHA_NUMERIC.test(character);
		if (!isAlphaNumeric) {
			shouldCapitalize = true;
			continue;
		}

		output += shouldCapitalize ? character.toUpperCase() : character;
		shouldCapitalize = false;
	}

	return output.length > 0 ? output : "Declaration";
}

function transformStatement(
	statement: SupportedDeclarationStatement,
	state: BundlerState,
	localSymbolNames: ReadonlyMap<ts.Symbol, string>,
	externalImportNames: ReadonlyMap<ts.Symbol, string>,
): SupportedDeclarationStatement {
	const transformer: ts.TransformerFactory<SupportedDeclarationStatement> = (context) => {
		const visit: ts.Visitor = (node) => {
			if (ts.isIdentifier(node)) {
				const renamed = tryRenameIdentifier(node, state.checker, localSymbolNames, externalImportNames);
				if (renamed !== undefined) return renamed;
			}

			return ts.visitEachChild(node, visit, context);
		};

		return (rootNode) => {
			const visitedNode = ts.visitNode(rootNode, visit);
			return visitedNode !== undefined && isSupportedDeclarationStatement(visitedNode) ? visitedNode : rootNode;
		};
	};

	const transformResult = ts.transform(statement, [transformer]);
	const [firstStatement] = transformResult.transformed;
	transformResult.dispose();

	if (firstStatement === undefined || !isSupportedDeclarationStatement(firstStatement)) {
		throw new Error(`Failed to transform declaration statement in ${statement.getSourceFile().fileName}`);
	}

	return stripExportModifiers(firstStatement);
}

function tryRenameIdentifier(
	identifier: ts.Identifier,
	checker: ts.TypeChecker,
	localSymbolNames: ReadonlyMap<ts.Symbol, string>,
	externalImportNames: ReadonlyMap<ts.Symbol, string>,
): ts.Identifier | undefined {
	const symbol = checker.getSymbolAtLocation(identifier);
	if (symbol === undefined) return undefined;

	const externalImportName = externalImportNames.get(symbol);
	if (externalImportName !== undefined && externalImportName !== identifier.text) {
		return ts.factory.createIdentifier(externalImportName);
	}

	const localSymbolName = localSymbolNames.get(resolveAliasedSymbol(symbol, checker));
	if (localSymbolName !== undefined && localSymbolName !== identifier.text) {
		return ts.factory.createIdentifier(localSymbolName);
	}

	return undefined;
}

function capitalizeIdentifier(value: string): string {
	return value.length === 0 ? value : `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

export const __testing = {
	createScopeName,
	createUniqueName,
	getFileStem,
	toPascalCase,
};
