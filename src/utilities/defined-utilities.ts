export function getDefinedValue<Value>(value: Value | undefined, message = "Expected value to be defined."): Value {
	if (value === undefined) {
		const error = new Error(message);
		Error.captureStackTrace(error, getDefinedValue);
		throw error;
	}

	return value;
}
