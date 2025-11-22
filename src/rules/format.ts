import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { isOxfmtConfiguration, type OxfmtConfiguration } from "../types/oxfmt";
import { isErrnoException } from "../utilities/error-utilities";
import { toPrettyErrorsRaw } from "../utilities/typebox-utilities";

// oxlint-disable-next-line no-void

const OXFMT_CONFIGURATION_PATH = resolve(".", ".oxfmtrc.json");
function indentLine(line: string): string {
	return `  ${line}`;
}

async function _getOxfmtConfigurationAsync(): Promise<OxfmtConfiguration | undefined> {
	try {
		const fileContents = await readFile(OXFMT_CONFIGURATION_PATH, "utf8");
		const parsed = JSON.parse(fileContents);
		if (isOxfmtConfiguration.Check(parsed)) return parsed;

		// oxlint-disable-next-line no-array-callback-reference
		const errors = toPrettyErrorsRaw(isOxfmtConfiguration.Errors(parsed), parsed).map(indentLine).join("\n");
		// oxlint-disable-next-line no-console
		console.error(`Warning: .oxfmtrc.json is not a valid Oxfmt configuration:\n${errors}`);

		return undefined;
	} catch (error) {
		if (isErrnoException(error) && error.code === "ENOENT") return undefined;
		throw error;
	}
}
