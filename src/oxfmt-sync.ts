import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { MessageChannel, receiveMessageOnPort, Worker } from "node:worker_threads";

import type { FormatOptions } from "oxfmt";
import type { FormatRequest, FormatResponse } from "./oxfmt-worker";

const FORMAT_TIMEOUT = 30_000;

interface OxfmtWorkerState {
	readonly controlBuffer: SharedArrayBuffer;
	readonly responsePort: MessagePort;
	readonly worker: Worker;
}

let workerState: OxfmtWorkerState | undefined;

export function __testingResolveWorkerPath(baseUrl: string | URL, exists: (path: string) => boolean): URL {
	// Try .js first (production/dist), then .ts (development/source)
	const jsPath = new URL("./oxfmt-worker.js", baseUrl);
	const jsFilePath = fileURLToPath(jsPath);
	if (exists(jsFilePath)) return jsPath;

	const tsPath = new URL("./oxfmt-worker.ts", baseUrl);
	const tsFilePath = fileURLToPath(tsPath);
	if (exists(tsFilePath)) return tsPath;

	throw new Error(`Oxfmt worker not found at ${jsFilePath} or ${tsFilePath}. Did you run 'bun run build'?`);
}

function resolveWorkerPath(): URL {
	return __testingResolveWorkerPath(import.meta.url, existsSync);
}


function getWorker(): OxfmtWorkerState {
	if (workerState !== undefined) return workerState;

	const controlBuffer = new SharedArrayBuffer(4);
	const workerPath = resolveWorkerPath();

	const { port1: responsePort, port2: requestPort } = new MessageChannel();

	const worker = new Worker(workerPath, {
		stderr: true,
		stdout: true,
		transferList: [requestPort],
		workerData: { requestPort },
	});

	worker.unref();

	workerState = { controlBuffer, responsePort, worker };
	return workerState;
}

export function formatSync(fileName: string, sourceText: string, options: FormatOptions = {}): string {
	const { controlBuffer, responsePort } = getWorker();
	const control = new Int32Array(controlBuffer);

	Atomics.store(control, 0, 0);

	const request: FormatRequest = {
		controlBuffer,
		fileName,
		options,
		sourceText,
	};

	responsePort.postMessage(request);

	const waitResult = Atomics.wait(control, 0, 0, FORMAT_TIMEOUT);
	if (waitResult === "timed-out") throw new Error(`Oxfmt timed out after ${FORMAT_TIMEOUT}ms`);

	const received = receiveMessageOnPort(responsePort);
	if (received === undefined) throw new Error("No response received from oxfmt worker");

	const response = received.message as FormatResponse;
	if (response.error !== undefined) throw new Error(response.error);
	if (response.code === undefined) throw new Error("Oxfmt returned undefined code");

	return response.code;
}

export function terminateWorker(): void {
	if (workerState === undefined) return;
	void workerState.worker.terminate();
	workerState = undefined;
}
