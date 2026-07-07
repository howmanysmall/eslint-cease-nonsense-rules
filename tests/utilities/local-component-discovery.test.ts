import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import nodePath from "node:path";
import { describe, expect, it } from "vitest";
import { discoverLocalComponent, inspectLocalComponentFile } from "$utilities/local-component-discovery";

const widgetDefinition = {
	componentName: "Widget",
	fileNames: ["widget"],
	markers: ["target"],
} as const;

function createProject(): string {
	const project = mkdtempSync(nodePath.join(tmpdir(), "local-component-discovery-"));
	writeFileSync(nodePath.join(project, "package.json"), "{}");
	return project;
}

function writeProjectFile(project: string, relativePath: string, text: string): string {
	const filePath = nodePath.join(project, relativePath);
	mkdirSync(nodePath.dirname(filePath), { recursive: true });
	writeFileSync(filePath, text);
	return filePath;
}

describe("local-component-discovery", () => {
	it("inspects named and default component exports", () => {
		expect.assertions(2);

		const project = createProject();
		const named = writeProjectFile(project, "src/widget.tsx", "export function Widget() { return target; }");
		const defaulted = writeProjectFile(
			project,
			"src/nested/widget.tsx",
			"function Widget() { return target; }\nexport default Widget;",
		);

		expect(inspectLocalComponentFile(named, widgetDefinition)).toStrictEqual({
			importStyle: "named",
			matches: true,
		});
		expect(inspectLocalComponentFile(defaulted, widgetDefinition)).toStrictEqual({
			importStyle: "default",
			matches: true,
		});
	});

	it("rejects ignored, declaration, wrong-name, and markerless files", () => {
		expect.assertions(6);

		const project = createProject();
		const ignored = writeProjectFile(project, "tests/widget.tsx", "export function Widget() { return target; }");
		const declaration = writeProjectFile(project, "src/widget.d.ts", "export declare function Widget(): void;");
		const wrongName = writeProjectFile(
			project,
			"src/not-widget.tsx",
			"export function Widget() { return target; }",
		);
		const missingMarker = writeProjectFile(project, "src/widget.ts", "export function Widget() { return null; }");
		const missingComponent = writeProjectFile(project, "src/widget.jsx", "export const NotWidget = target;");
		const missingExport = writeProjectFile(project, "src/widget.js", "const Widget = target;");

		expect(inspectLocalComponentFile(ignored, widgetDefinition).matches).toBe(false);
		expect(inspectLocalComponentFile(declaration, widgetDefinition).matches).toBe(false);
		expect(inspectLocalComponentFile(wrongName, widgetDefinition).matches).toBe(false);
		expect(inspectLocalComponentFile(missingMarker, widgetDefinition).matches).toBe(false);
		expect(inspectLocalComponentFile(missingComponent, widgetDefinition).matches).toBe(false);
		expect(inspectLocalComponentFile(missingExport, widgetDefinition).matches).toBe(false);
	});

	it("discovers a single matching local component import source", () => {
		expect.assertions(2);

		const project = createProject();
		const source = writeProjectFile(project, "src/screens/example.tsx", "export const Example = 1;");
		writeProjectFile(project, "src/components/widget.tsx", "export const Widget = target;");

		expect(discoverLocalComponent(source, widgetDefinition)).toStrictEqual({
			found: true,
			importSource: "../components/widget",
			importStyle: "named",
			path: nodePath.join(project, "src/components/widget.tsx"),
		});
		expect(discoverLocalComponent(source, widgetDefinition)).toStrictEqual({
			found: true,
			importSource: "../components/widget",
			importStyle: "named",
			path: nodePath.join(project, "src/components/widget.tsx"),
		});
	});

	it("does not discover missing or ambiguous components", () => {
		expect.assertions(2);

		const missingProject = createProject();
		const missingSource = writeProjectFile(missingProject, "src/screens/example.tsx", "export const Example = 1;");

		const ambiguousProject = createProject();
		const ambiguousSource = writeProjectFile(
			ambiguousProject,
			"src/screens/example.tsx",
			"export const Example = 1;",
		);
		writeProjectFile(ambiguousProject, "src/a/widget.tsx", "export const Widget = target;");
		writeProjectFile(ambiguousProject, "src/b/widget.tsx", "export const Widget = target;");

		expect(discoverLocalComponent(missingSource, widgetDefinition)).toStrictEqual({ found: false });
		expect(discoverLocalComponent(ambiguousSource, widgetDefinition)).toStrictEqual({ found: false });
	});

	it("discovers same-directory components with explicit relative import sources", () => {
		expect.assertions(1);

		const project = createProject();
		const source = writeProjectFile(project, "src/example.tsx", "export const Example = 1;");
		const component = writeProjectFile(project, "src/widget.tsx", "export const Widget = target;");

		expect(discoverLocalComponent(source, widgetDefinition)).toStrictEqual({
			found: true,
			importSource: "./widget",
			importStyle: "named",
			path: component,
		});
	});

	it("ignores hidden and declaration candidates while discovering components", () => {
		expect.assertions(1);

		const project = createProject();
		const source = writeProjectFile(project, "src/example.tsx", "export const Example = 1;");
		writeProjectFile(project, ".cache/widget.tsx", "export const Widget = target;");
		writeProjectFile(project, "src/widget.d.ts", "export declare const Widget: typeof target;");

		expect(discoverLocalComponent(source, widgetDefinition)).toStrictEqual({ found: false });
	});

	it("ignores fixture directories while discovering components", () => {
		expect.assertions(1);

		const project = createProject();
		const source = writeProjectFile(project, "src/example.tsx", "export const Example = 1;");
		writeProjectFile(project, "fixtures/widget.tsx", "export const Widget = target;");

		expect(discoverLocalComponent(source, widgetDefinition)).toStrictEqual({ found: false });
	});

	it("does not discover components without a project root", () => {
		expect.assertions(1);

		const directory = mkdtempSync(nodePath.join(tmpdir(), "local-component-discovery-rootless-"));
		const source = writeProjectFile(directory, "example.tsx", "export const Example = 1;");

		expect(discoverLocalComponent(source, widgetDefinition)).toStrictEqual({ found: false });
	});

	it("inspects standalone files without a project root", () => {
		expect.assertions(1);

		const directory = mkdtempSync(nodePath.join(tmpdir(), "local-component-discovery-standalone-"));
		const component = writeProjectFile(directory, "widget.tsx", "export const Widget = target;");

		expect(inspectLocalComponentFile(component, widgetDefinition)).toStrictEqual({
			importStyle: "named",
			matches: true,
		});
	});
});
