import { workerData } from "node:worker_threads";
import type { FormatOptions } from "oxfmt";

export type { FormatOptions } from "oxfmt";

export interface FormatRequest {
	readonly controlBuffer: SharedArrayBuffer;
	readonly fileName: string;
	readonly options: FormatOptions;
	readonly sourceText: string;
}

export interface FormatResponse {
	readonly code?: string;
	readonly error?: string;
}

interface WorkerData {
	readonly requestPort: MessagePort;
}

// oxlint-disable-next-line consistent-type-imports
type FormatFunction = typeof import("oxfmt").format;

const OXFMT_NOT_INSTALLED_ERROR = "oxfmt is not installed. Install it with: bun add -D oxfmt (or npm install -D oxfmt)";

let oxfmtFormat: FormatFunction | undefined;
let loadError: string | undefined;

try {
	const oxfmt = await import("oxfmt");
	oxfmtFormat = oxfmt.format;
} catch {
	loadError = OXFMT_NOT_INSTALLED_ERROR;
}

function isWorkerData(value: unknown): value is WorkerData {
	return (
		typeof value === "object" &&
		value !== null &&
		"requestPort" in value &&
		value.requestPort instanceof MessagePort
	);
}

if (!isWorkerData(workerData)) {
	throw new Error("oxfmt-worker must be run as a worker thread with requestPort in workerData");
}

const port = workerData.requestPort;

port.on("message", (request: FormatRequest) => {
	void (async (): Promise<void> => {
		const control = new Int32Array(request.controlBuffer);
		try {
			if (oxfmtFormat === undefined) {
				port.postMessage({ error: loadError ?? OXFMT_NOT_INSTALLED_ERROR } satisfies FormatResponse);
				return;
			}

			const result = await oxfmtFormat(request.fileName, request.sourceText, request.options);
			if (result.errors.length > 0) {
				const errorMessages = result.errors.map(({ message }) => message).join("; ");
				port.postMessage({ error: `Oxfmt error: ${errorMessages}` } satisfies FormatResponse);
			} else port.postMessage({ code: result.code } satisfies FormatResponse);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			port.postMessage({ error: `Oxfmt error: ${message}` } satisfies FormatResponse);
		} finally {
			Atomics.store(control, 0, 1);
			Atomics.notify(control, 0);
		}
	})();
});
