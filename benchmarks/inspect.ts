import { inspect } from "node:util";

export interface InspectOptions extends Record<string, unknown> {
	readonly breakLength?: number;
	readonly colors?: boolean;
	readonly compact?: boolean;
	readonly depth?: number | null;
}
export type InspectFunction = (value: unknown, options?: InspectOptions) => string;

export function getInspectAsync(): InspectFunction {
	return inspect;
}
