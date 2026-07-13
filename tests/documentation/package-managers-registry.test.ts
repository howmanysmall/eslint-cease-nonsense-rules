import { describe, expect, it } from "vitest";

import {
	buildPackageManagerCommand,
	defaultManagerOrder,
	defaultSelectedManager,
	getCustomPackageManagerIconEntries,
	packageManagerRegistry,
	publishedPackageName,
} from "../../documentation/src/utilities/package-managers/registry";

describe("package manager registry", () => {
	it("defaults to pnpm and keeps the install tab order", () => {
		expect.assertions(3);
		expect(defaultSelectedManager).toBe("pnpm");
		expect(defaultManagerOrder).toStrictEqual(["ni", "pnpm", "aube", "bun", "yarn", "vlt", "npm"]);
		expect(packageManagerRegistry.ni.label).toBe("@antfu/ni");
	}, 1000);

	it("uses Starlight icons for managers that have built-in marks", () => {
		expect.assertions(4);
		expect(packageManagerRegistry.pnpm.icon).toBe("pnpm");
		expect(packageManagerRegistry.bun.icon).toBe("bun");
		expect(packageManagerRegistry.npm.icon).toBe("seti:npm");
		expect(packageManagerRegistry.yarn.icon).toBe("seti:yarn");
	}, 1000);

	it("exposes public SVG paths for managers without Starlight icons", () => {
		expect.assertions(4);
		expect(packageManagerRegistry.ni.icon).toBeUndefined();
		expect(packageManagerRegistry.aube.icon).toBeUndefined();
		expect(packageManagerRegistry.vlt.icon).toBeUndefined();
		expect(getCustomPackageManagerIconEntries()).toStrictEqual([
			{ iconSrc: "icons/ni.svg", label: "@antfu/ni" },
			{ iconSrc: "icons/aube.svg", label: "aube" },
			{ iconSrc: "icons/vlt.svg", label: "vlt" },
		]);
	}, 1000);

	it("builds install and local-bin commands with the right package name", () => {
		expect.assertions(4);
		expect(
			buildPackageManagerCommand("pnpm", {
				development: true,
				packageName: publishedPackageName,
				type: "add",
			}),
		).toBe(`pnpm add -D ${publishedPackageName}`);
		expect(buildPackageManagerCommand("aube", { parameters: "eslint .", type: "run" })).toBe("aube exec eslint .");
		expect(buildPackageManagerCommand("ni", { parameters: "eslint .", type: "run" })).toBe("nlx eslint .");
		expect(buildPackageManagerCommand("vlt", { parameters: "eslint .", type: "run" })).toBe("vlt exec eslint .");
	}, 1000);
});
