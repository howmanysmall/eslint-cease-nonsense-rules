import { dim, red, yellow } from "picocolors";

export function formatSeverity(level: 0 | 1 | 2): string {
	switch (level) {
		case 0:
			return dim("off");

		case 1:
			return yellow("warn");

		case 2:
			return red("error");
	}
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
