import Typebox from "typebox";
import { Compile } from "typebox/compile";

export const isLiteralErrorLike = Compile(
	Typebox.Object({
		message: Typebox.String(),
		name: Typebox.String(),
	}),
);
export type ErrorLike = Typebox.Static<typeof isLiteralErrorLike>;

export function isErrorLike(value: unknown): value is ErrorLike {
	return value instanceof Error || isLiteralErrorLike.Check(value);
}

const isErrnoProperties = Compile(
	Typebox.Object({
		code: Typebox.Optional(Typebox.String()),
		errno: Typebox.Optional(Typebox.Number()),
		path: Typebox.Optional(Typebox.String()),
		syscall: Typebox.Optional(Typebox.String()),
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
