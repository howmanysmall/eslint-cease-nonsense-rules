import Type from "typebox";
import { Compile } from "typebox/compile";

export const isLiteralErrorLike = Compile(
	Type.Object({
		message: Type.String(),
		name: Type.String(),
	}),
);
export type ErrorLike = Type.Static<typeof isLiteralErrorLike>;

export function isErrorLike(value: unknown): value is ErrorLike {
	return value instanceof Error || isLiteralErrorLike.Check(value);
}

const isErrnoProperties = Compile(
	Type.Object({
		code: Type.Optional(Type.String()),
		errno: Type.Optional(Type.Number()),
		path: Type.Optional(Type.String()),
		syscall: Type.Optional(Type.String()),
	}),
);

export function isErrnoException(value: unknown): value is NodeJS.ErrnoException {
	if (!isErrorLike(value)) return false;

	return isErrnoProperties.Check(value);
}

/**
 * Converts an unknown error value to a string message.
 *
 * If the error is an Error object, returns its message. Otherwise, coerces to
 * string.
 *
 * @param error - The error value to stringify.
 * @returns The string representation of the error.
 */
export function stringifyUnknownError(error: unknown): string {
	return isErrorLike(error) ? error.message : String(error);
}
