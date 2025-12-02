import { version } from "../../package.json";

function stringifyUnknownError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

const buildMetadata: Bun.BunPlugin = {
	name: "build-metadata",
	setup(build: Bun.PluginBuilder) {
		build.onStart(async () => {
			try {
				const { stdout } = await Bun.$`git rev-parse HEAD`.quiet();
				const commit = stdout.toString("utf8").trim();
				const metadata = { commit, time: new Date().toISOString(), version };
				await Bun.write("./dist/build-metadata.json", JSON.stringify(metadata, undefined, 2));
			} catch (error) {
				// oxlint-disable-next-line no-console
				console.warn(`[build-metadata] Failed to write metadata - ${stringifyUnknownError(error)}`);
			}
		});
	},
};

export default buildMetadata;
