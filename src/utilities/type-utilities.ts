export function isObject(object: unknown): object is object {
	return typeof object === "object";
}

export function isNumber(value: unknown): value is number {
	return typeof value === "number";
}

export function isBoolean(value: unknown): value is boolean {
	return typeof value === "boolean";
}

export function isFunction(value: unknown): value is (...parameters: Array<unknown>) => unknown {
	return typeof value === "function";
}

export function isString(value: unknown): value is string {
	return typeof value === "string";
}

export function isRecordFast(object: unknown): object is Record<string, unknown> {
	return isObject(object) && object !== null;
}
export function isRecord(object: unknown): object is Record<string, unknown> {
	return isRecordFast(object) && !Array.isArray(object);
}
