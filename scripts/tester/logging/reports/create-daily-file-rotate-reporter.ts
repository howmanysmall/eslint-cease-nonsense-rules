import type { ConsolaReporter, LogObject } from "consola";
import type { FileSize, Interval } from "rotating-file-stream";
import { createStream } from "rotating-file-stream";

function alwaysTrue(): boolean {
	return true;
}

function stringify(parameter: unknown): string {
	return typeof parameter === "string" ? parameter : JSON.stringify(parameter);
}

export interface DailyFileRotateReporterOptions {
	readonly directory: string;
	readonly filename: string;
	readonly interval?: Interval;
	readonly levelFilter?: (level: number) => boolean;
	readonly maxFiles?: number;
	readonly size?: FileSize;
}

export default function createDailyFileRotateReporter({
	directory,
	filename,
	interval = "1d",
	levelFilter = alwaysTrue,
	maxFiles = 14,
	size = "20M",
}: DailyFileRotateReporterOptions): ConsolaReporter {
	const stream = createStream(filename, {
		compress: "gzip",
		interval,
		maxFiles,
		path: directory,
		size,
	});

	return {
		log: ({ date, level, tag, args }: LogObject): void => {
			if (!levelFilter(level)) return;

			// oxlint-disable-next-line unicorn/no-array-callback-reference
			const message = args.map(stringify).join(" ");

			const logEntry = JSON.stringify({
				level: level <= 1 ? "error" : level === 2 ? "warn" : "info",
				message,
				tag,
				timestamp: date.toISOString(),
			});

			stream.write(`${logEntry}\n`);
		},
	};
}
