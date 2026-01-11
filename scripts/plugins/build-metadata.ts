import { Temporal } from "temporal-polyfill";
import { version } from "../../package.json";

function stringifyUnknownError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

const buildMetadata: Bun.BunPlugin = {
	name: "build-metadata",
	setup(pluginBuilder: Bun.PluginBuilder) {
		pluginBuilder.onStart(async () => {
			try {
				const { stdout } = await Bun.$`git rev-parse HEAD`.quiet();
				const commit = stdout.toString("utf8").trim();
				const time = Temporal.Now.instant().toString({ smallestUnit: "millisecond" });
				await Bun.write("./dist/build-metadata.json", JSON.stringify({ commit, time, version }, undefined, 2));
			} catch (error) {
				console.warn(`[build-metadata] Failed to write metadata - ${stringifyUnknownError(error)}`);
			}
		});
	},
};

export default buildMetadata;
