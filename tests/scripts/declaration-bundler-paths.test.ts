import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { readDeclarationBundlerPaths } from "../../scripts/utilities/declaration-bundler-paths";

vi.setConfig({ testTimeout: 10000 });

async function withFixtureConfigAsync<Result>(
	content: string,
	runAsync: (configFilePath: string) => Promise<Result> | Result,
): Promise<Result> {
	const rootDirectory = await mkdtemp(join(tmpdir(), "declaration-bundler-paths-"));
	const configFilePath = join(rootDirectory, "tsconfig.paths.json");

	try {
		await writeFile(configFilePath, content);
		return await runAsync(configFilePath);
	} finally {
		await rm(rootDirectory, { force: true, recursive: true });
	}
}

describe("declaration-bundler-paths", () => {
	it("derives declaration bundler paths from tsconfig paths", async () => {
		expect.assertions(1);
		await withFixtureConfigAsync(
			`{
	"compilerOptions": {
		"paths": {
			"@constants/*": ["./src/constants/*"],
			"@lint-types/*": ["./src/types/*"],
			"@small-rules": ["./src/index.ts"],
		},
	},
}`,
			async (configFilePath) => {
				const paths = readDeclarationBundlerPaths(configFilePath, "src");

				expect(paths).toStrictEqual({
					"@constants/*": ["constants/*"],
					"@lint-types/*": ["types/*"],
					"@small-rules": ["index.d.ts"],
				});
			},
		);
	});
});
