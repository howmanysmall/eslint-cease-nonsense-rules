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

function getWorker(): OxfmtWorkerState {
	if (workerState !== undefined) return workerState;

	const controlBuffer = new SharedArrayBuffer(4);
	const workerPath = new URL("./oxfmt-worker.ts", import.meta.url);

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
