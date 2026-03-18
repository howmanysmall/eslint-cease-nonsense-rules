import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
	__testing,
	bundleDeclarationEntryPoint,
	createDeclarationBundlerProgram,
} from "../../scripts/utilities/declaration-bundler";

interface FixtureContext {
	readonly bundleDirectory: string;
	readonly rootDirectory: string;
	readonly supportDirectory: string;
}

const fixtureDirectories = new Array<string>();

async function writeFixtureFileAsync(rootDirectory: string, relativePath: string, content: string): Promise<void> {
	const filePath = join(rootDirectory, relativePath);
	await mkdir(dirname(filePath), { recursive: true });
	await Bun.write(filePath, content);
}

async function createFixtureContextAsync(
	bundleFiles: Readonly<Record<string, string>>,
	supportFiles: Readonly<Record<string, string>> = {},
): Promise<FixtureContext> {
	const rootDirectory = await mkdtemp(join(tmpdir(), "declaration-bundler-"));
	const bundleDirectory = join(rootDirectory, "bundle");
	const supportDirectory = join(rootDirectory, "support");

	fixtureDirectories.push(rootDirectory);

	await Promise.all(
		Object.entries(bundleFiles).map(async ([relativePath, content]): Promise<void> => {
			await writeFixtureFileAsync(bundleDirectory, relativePath, content);
		}),
	);

	await Promise.all(
		Object.entries(supportFiles).map(async ([relativePath, content]): Promise<void> => {
			await writeFixtureFileAsync(supportDirectory, relativePath, content);
		}),
	);

	return { bundleDirectory, rootDirectory, supportDirectory };
}

function createBundledOutput(context: FixtureContext, entryFileName: string): string {
	const program = createDeclarationBundlerProgram({
		declarationDirectories: [context.bundleDirectory, context.supportDirectory],
	});

	return bundleDeclarationEntryPoint({
		entryFilePath: join(context.bundleDirectory, entryFileName),
		program,
	});
}

describe("declaration-bundler", () => {
	afterEach(async () => {
		await Promise.all(
			fixtureDirectories.splice(0).map(async (directory): Promise<void> => {
				await rm(directory, { force: true, recursive: true });
			}),
		);
	});

	it("bundles aliased type exports without leaking relative re-exports", async () => {
		const context = await createFixtureContextAsync({
			"alpha.d.ts": "export interface Options {\n\treadonly alpha: string;\n}\n",
			"beta.d.ts": "export interface Options {\n\treadonly beta: number;\n}\n",
			"index.d.ts": [
				'export type { Options as AlphaOptions } from "./alpha";',
				'export type { Options as BetaOptions } from "./beta";',
			].join("\n"),
		});

		const output = createBundledOutput(context, "index.d.ts");

		expect(output).toContain("interface AlphaOptions");
		expect(output).toContain("interface BetaOptions");
		expect(output).toContain("export type { AlphaOptions, BetaOptions };");
		expect(output).not.toContain("./alpha");
		expect(output).not.toContain("./beta");
	});

	it("keeps external imports and inlines only the local declaration graph", async () => {
		const context = await createFixtureContextAsync(
			{
				"helper.d.ts": "export interface Helper {\n\treadonly value: string;\n}\n",
				"index.d.ts": 'export type { PublicThing } from "./module";\n',
				"module.d.ts": [
					'import type { Helper } from "./helper";',
					'import type { External } from "pkg";',
					"export interface PublicThing {",
					"\treadonly external: External;",
					"\treadonly helper: Helper;",
					"}",
				].join("\n"),
			},
			{
				"node_modules/pkg/index.d.ts": "export interface External {\n\treadonly tag: string;\n}\n",
			},
		);

		const output = createBundledOutput(context, "index.d.ts");

		expect(output).toContain('import type { External } from "pkg";');
		expect(output).toContain("interface Helper");
		expect(output).toContain("interface PublicThing");
		expect(output).toContain("export type { PublicThing };");
		expect(output).not.toContain("./helper");
		expect(output).not.toContain("./module");
		expect(output).not.toContain("export type { Helper }");
	});

	it("includes copied source declaration files when emitted output references .d modules", async () => {
		const context = await createFixtureContextAsync({
			"index.d.ts": [
				'import type { ReadonlyRecord } from "./types/utility-types.d";',
				"export declare const rules: ReadonlyRecord<string, number>;",
			].join("\n"),
			"types/utility-types.d.ts":
				"export type ReadonlyRecord<Key extends number | string | symbol, Value> = Readonly<Record<Key, Value>>;\n",
		});

		const output = createBundledOutput(context, "index.d.ts");

		expect(output).toContain("type ReadonlyRecord");
		expect(output).toContain("declare const rules");
		expect(output).toContain("export { rules };");
		expect(output).not.toContain("utility-types.d");
	});

	it("handles local declaration cycles without duplicating statements", async () => {
		const context = await createFixtureContextAsync({
			"a.d.ts": ['import type { B } from "./b";', "export interface A {", "\treadonly b: B;", "}"].join("\n"),
			"b.d.ts": ['import type { A } from "./a";', "export interface B {", "\treadonly a: A;", "}"].join("\n"),
			"index.d.ts": 'export type { A } from "./a";\n',
		});

		const output = createBundledOutput(context, "index.d.ts");

		expect(output.match(/interface A/g)?.length).toBe(1);
		expect(output.match(/interface B/g)?.length).toBe(1);
		expect(output).toContain("export type { A };");
	});

	it("supports direct exports, local export specifiers, default exports, and Bun-friendly external imports", async () => {
		const context = await createFixtureContextAsync(
			{
				"index.d.ts": [
					'import DefaultTool from "pkg-default";',
					'import * as Toolkit from "pkg-ns";',
					"export declare namespace Shapes {",
					"\tinterface Circle {",
					"\t\treadonly radius: number;",
					"\t}",
					"}",
					"export declare class Example {",
					"\treadonly defaultTool: DefaultTool;",
					"\treadonly widget: Toolkit.Widget;",
					"}",
					"export type ExampleAlias = Example;",
					"export declare function makeThing(input: DefaultTool): ExampleAlias;",
					"declare const plugin: ExampleAlias;",
					"export { plugin as namedPlugin };",
					"export default plugin;",
				].join("\n"),
			},
			{
				"node_modules/pkg-default/index.d.ts": [
					"declare class DefaultTool {",
					"\treadonly id: string;",
					"}",
					"export default DefaultTool;",
				].join("\n"),
				"node_modules/pkg-ns/index.d.ts": "export interface Widget {\n\treadonly label: string;\n}\n",
			},
		);

		const output = createBundledOutput(context, "index.d.ts");

		expect(output).toContain('import DefaultTool from "pkg-default";');
		expect(output).toContain('import * as Toolkit from "pkg-ns";');
		expect(output).toContain("declare namespace Shapes");
		expect(output).toContain("declare class Example");
		expect(output).toContain("type ExampleAlias = Example;");
		expect(output).toContain("declare function makeThing(input: DefaultTool): ExampleAlias;");
		expect(output).toContain("declare const namedPlugin: ExampleAlias;");
		expect(output).toContain("export type { ExampleAlias };");
		expect(output).toContain("export { Shapes, Example, makeThing, namedPlugin };");
		expect(output).toContain("export default namedPlugin;");
	});

	it("throws for unsupported export stars", async () => {
		const context = await createFixtureContextAsync({
			"index.d.ts": 'export * from "./other";\n',
			"other.d.ts": "export interface Other {\n\treadonly value: string;\n}\n",
		});

		expect(() => createBundledOutput(context, "index.d.ts")).toThrow("Unsupported export star declaration");
	});

	it("throws when the entrypoint does not exist", async () => {
		const context = await createFixtureContextAsync({});
		const program = createDeclarationBundlerProgram({ declarationDirectories: [context.bundleDirectory] });

		expect(() =>
			bundleDeclarationEntryPoint({
				entryFilePath: join(context.bundleDirectory, "missing.d.ts"),
				program,
			}),
		).toThrow("Declaration entrypoint not found");
	});

	it("exposes stable testing helpers for scope and name generation", () => {
		const usedNames = new Set(["Options", "FeatureOptions"]);

		expect(__testing.getFileStem("/tmp/types/utility-types.d.ts")).toBe("utility-types");
		expect(__testing.getFileStem("/tmp/generated/index.ts")).toBe("generated");
		expect(__testing.toPascalCase("feature-options")).toBe("FeatureOptions");
		expect(__testing.createScopeName("/tmp/feature-options.d.ts")).toBe("FeatureOptions");
		expect(__testing.createUniqueName("Options", "/tmp/feature-options.d.ts", usedNames)).toBe("FeatureOptions2");
	});
});
