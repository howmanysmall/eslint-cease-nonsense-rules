import { createStream } from "rotating-file-stream";

import type { ConsolaReporter, LogObject } from "consola";
import type { FileSize, Interval } from "rotating-file-stream";

function alwaysTrue(): boolean {
	return true;
}

function stringify(parameter: unknown): string {
	return typeof parameter === "string" ? parameter : JSON.stringify(parameter);
}

interface DailyFileRotateReporterOptions {
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
		// oxlint-disable-next-line small-rules/prevent-abbreviations -- out of my control!
		log: ({ date, level, tag, args }: LogObject): void => {
			if (!levelFilter(level)) return;

			const message = args.map(stringify).join(" ");

			const logEntry = JSON.stringify({
				level: getLevel(level),
				message,
				tag,
				timestamp: date.toISOString(),
			});

			stream.write(`${logEntry}\n`);
		},
	};
}

function getLevel(level: number): string {
	if (level <= 1) return "error";
	return level === 2 ? "warn" : "info";
}
