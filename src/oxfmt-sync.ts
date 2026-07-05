import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { MessageChannel, receiveMessageOnPort, Worker } from "node:worker_threads";

import type { MessagePort } from "node:worker_threads";

import type { FormatConfiguration, FormatRequest, FormatResponse } from "./oxfmt-worker";

const FORMAT_TIMEOUT = 30_000;

interface OxfmtWorkerState {
	readonly controlBuffer: SharedArrayBuffer;
	readonly responsePort: MessagePort;
	readonly worker: Worker;
}

let workerState: OxfmtWorkerState | undefined;

function isFormatResponse(value: unknown): value is FormatResponse {
	return (
		typeof value === "object" &&
		value !== null &&
		(!("code" in value) || typeof value.code === "string") &&
		(!("error" in value) || typeof value.error === "string")
	);
}

export function __testingResolveWorkerPath(baseUrl: string | URL, exists: (path: string) => boolean): URL {
	// Try .js first (production/dist), then .ts (development/source)
	const jsPath = new URL("oxfmt-worker.js", baseUrl);
	const jsFilePath = fileURLToPath(jsPath);
	if (exists(jsFilePath)) return jsPath;

	const tsPath = new URL("oxfmt-worker.ts", baseUrl);
	const tsFilePath = fileURLToPath(tsPath);
	if (exists(tsFilePath)) return tsPath;

	const error = new Error(`Oxfmt worker not found at ${jsFilePath} or ${tsFilePath}. Did you run 'nr build'?`);
	Error.captureStackTrace(error, __testingResolveWorkerPath);
	throw error;
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

export function formatSync(fileName: string, sourceText: string, options: FormatConfiguration = {}): string {
	const { controlBuffer, responsePort } = getWorker();
	const control = new Int32Array(controlBuffer);

	Atomics.store(control, 0, 0);

	const request: FormatRequest = {
		controlBuffer,
		fileName,
		options,
		sourceText,
	};

	// oxlint-disable-next-line unicorn/require-post-message-target-origin -- ???
	responsePort.postMessage(request);

	const waitResult = Atomics.wait(control, 0, 0, FORMAT_TIMEOUT);
	if (waitResult === "timed-out") {
		const error = new Error(`Oxfmt timed out after ${FORMAT_TIMEOUT}ms`);
		Error.captureStackTrace(error, formatSync);
		throw error;
	}

	const received = receiveMessageOnPort(responsePort);
	if (received === undefined) {
		const error = new Error("No response received from oxfmt worker");
		Error.captureStackTrace(error, formatSync);
		throw error;
	}

	const response: unknown = received.message;
	if (!isFormatResponse(response)) {
		const error = new Error("Invalid response received from oxfmt worker");
		Error.captureStackTrace(error, formatSync);
		throw error;
	}
	if (response.error !== undefined) {
		const error = new Error(response.error);
		Error.captureStackTrace(error, formatSync);
		throw error;
	}
	if (response.code === undefined) {
		const error = new Error("Oxfmt returned undefined code");
		Error.captureStackTrace(error, formatSync);
		throw error;
	}

	return response.code;
}

export function terminateWorker(): void {
	if (workerState === undefined) return;
	// oxlint-disable-next-line sonar/void-use -- allowed.
	void workerState.worker.terminate();
	workerState = undefined;
}
