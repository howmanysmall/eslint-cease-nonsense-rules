import { inspect } from "node:util";
import type { TLocalizedValidationError } from "typebox/error";
import Value from "typebox/value";

function stringifyType(value: ReadonlyArray<string> | string): string {
	if (typeof value === "string") return value;
	return value.join(" | ");
}
function stringifyUnknown(value: unknown): string {
	if (typeof value === "string") return value;
	return inspect(value, { depth: 2 });
}

export function toPrettyErrorsRaw(
	errors: ReadonlyArray<TLocalizedValidationError>,
	value: unknown,
): ReadonlyArray<string> {
	return errors.map(({ keyword, params, message, instancePath }) => {
		if (keyword === "required") return `Missing property: ${params.requiredProperties.join(", ")}`;
		if (keyword === "type") {
			const pointer = Value.Pointer.Get(value, instancePath);
			const currentValue = stringifyUnknown(pointer);
			return `Invalid type at "${instancePath || "(root)"}": expected ${stringifyType(params.type)}, got "${currentValue}"`;
		}
		return `Error at "${instancePath || "(root)"}": ${message}`;
	});
}

export function toPrettyErrors(errors: ReadonlyArray<TLocalizedValidationError>, value: unknown): string {
	return ["Validation Errors:", toPrettyErrorsRaw(errors, value).map((line) => `  - ${line}`)].join("\n");
}
