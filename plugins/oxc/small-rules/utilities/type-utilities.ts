export function isRecord(object: unknown): object is Record<string, unknown> {
	return typeof object === "object" && object !== null && !Array.isArray(object);
}

export function isStringArray(object: unknown): object is ReadonlyArray<string> {
	if (!Array.isArray(object)) return false;
	for (const value of object) if (typeof value !== "string") return false;
	return true;
}

export function isStringRecord(object: unknown): object is Record<string, string> {
	if (!isRecord(object)) return false;
	for (const value of Object.values(object)) if (typeof value !== "string") return false;
	return true;
}
