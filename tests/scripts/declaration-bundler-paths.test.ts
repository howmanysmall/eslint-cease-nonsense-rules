import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { readDeclarationBundlerPaths } from "../../scripts/utilities/declaration-bundler-paths";

const fixtureDirectories = new Array<string>();
vi.setConfig({ testTimeout: 10000 });

async function createFixtureConfigAsync(content: string): Promise<string> {
	const rootDirectory = await mkdtemp(join(tmpdir(), "declaration-bundler-paths-"));
	const configFilePath = join(rootDirectory, "tsconfig.paths.json");

	fixtureDirectories.push(rootDirectory);
	await writeFile(configFilePath, content);

	return configFilePath;
}

describe("declaration-bundler-paths", () => {
	afterEach(async () => {
		await Promise.all(
			fixtureDirectories.splice(0).map(async (directory): Promise<void> => {
				await rm(directory, { force: true, recursive: true });
			}),
		);
	});

	it("derives declaration bundler paths from tsconfig paths", async () => {
		expect.assertions(1);
		const configFilePath = await createFixtureConfigAsync(`{
	"compilerOptions": {
		"paths": {
			"@constants/*": ["./src/constants/*"],
			"@lint-types/*": ["./src/types/*"],
			"@small-rules": ["./src/index.ts"],
		},
	},
}`);

		const paths = readDeclarationBundlerPaths(configFilePath, "src");

		expect(paths).toEqual({
			"@constants/*": ["constants/*"],
			"@lint-types/*": ["types/*"],
			"@small-rules": ["index.d.ts"],
		});
	});
});
