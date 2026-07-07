export function getLastElement<Element>(
	values: ReadonlyArray<Element>,
	message = "Expected at least one element.",
): Element {
	let lastElement: Element | undefined;

	for (const value of values) {
		lastElement = value;
	}

	if (lastElement === undefined) {
		const error = new Error(message);
		Error.captureStackTrace(error, getLastElement);
		throw error;
	}

	return lastElement;
}
