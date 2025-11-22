import Type from "typebox";
import { Compile } from "typebox/compile";

export interface ErrorLike {
	name: string;
	message: string;
}

export function isLiteralErrorLike(value: unknown): value is ErrorLike {
	if (typeof value !== "object" || value === null) return false;
	return "name" in value && typeof value.name === "string" && "message" in value && typeof value.message === "string";
}

export function isErrorLike(value: unknown): value is ErrorLike {
	return value instanceof Error || isLiteralErrorLike(value);
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
